# Informe del rediseño visual — NaokiTrader (20-oct-2026, con revisión final)

Alcance: **solo capa visual**. Se trabajó sobre el proyecto existente, sin reconstruirlo.
Evidencia visual: `docs/visual-review/` (capturas JPEG y los 6 informes JSON de la medición).

## 0. Revisión final (20-oct-2026): tres defectos corregidos
Alcance: solo los tres puntos pedidos. Archivos de código tocados: `app/globals.css` y `app/(app)/trades/page.tsx` (un atributo `data-empty`). Nada más.

1. **Etiqueta «NOTAS» vacía en tarjetas móviles.** La causa era doble: mi primera corrección (`td:empty`) no cubría notas con solo espacios, y el JPEG empaquetado se había generado *antes* de esa corrección. Ahora la celda de notas lleva `data-empty` cuando no hay contenido (`notes?.trim()` vacío) y, solo en móvil (< 768 px), se oculta. Comprobado en navegador con 4 casos de prueba (nota nula, solo espacios, cadena vacía, con contenido): en 360 y 390 px, de 108 filas, 50 con texto quedan visibles y 58 sin contenido ocultas, con **0** etiquetas huérfanas y **0** notas con texto ocultas; en escritorio (1440 px) las 108 celdas se mantienen. Captura nueva: `docs/visual-review/trades-390-notas.jpg` (y regenerada `trades-390-superior.jpg`).
2. **Contraste de `--color-faint`.** Usos encontrados: `.input::placeholder` y un separador decorativo «/» en la cabecera (únicos). `#64748B` daba 4,14 / 3,94 / 3,67 / 3,40:1 sobre `bg` / `bg2` / `panel` / `panel2`. Nuevo valor **`#7B8BA3`**: 5,68 / 5,41 / 5,04 / 4,67:1 (mínimo 4,67:1 incluso sobre la superficie más clara) y sigue por debajo del texto secundario (`#94A3B8`, 7,31:1), conservando la jerarquía. Medido en el navegador: placeholder 5,41:1; separador 5,68:1; campos nativos de fecha/hora vacíos ≈ 16:1 (usan el color de texto normal). Es una **desviación consciente** respecto al valor inicial de la especificación (`#64748B`).
3. **Documentación.** `INFORME.md` y `MANUAL_TESTS.md` reescritos para coincidir con este informe y con el comportamiento real (tabla en escritorio, **tarjetas apiladas en móvil**, barra de pestañas inferior, etc.), separando comprobaciones automáticas ejecutadas de pruebas manuales pendientes.

Verificación de esta revisión (todo ejecutado de verdad): `tsc` OK; unitarias 39/39; PostgreSQL 28/28; `test:supabase` 10 omitidas (sin credenciales); `npm run build` OK; `npm audit` 0; 30/30 archivos protegidos idénticos; configuración y dependencias idénticas al paquete anterior; matriz de navegador **42/42** sin desbordamiento, sin consola y sin violaciones de axe. Cambios de código frente al paquete anterior: exactamente 2 archivos.

## 1. Resultados reales de verificación

| Comprobación | Antes (línea base) | Después |
|---|---|---|
| `npx tsc --noEmit` | OK | OK |
| `npm test` (unitarias) | 39/39 | **39/39** |
| `npm run test:pg` (PostgreSQL local, 28 pruebas) | 28/28 | **28/28** |
| `npm run test:supabase` | 10 omitidas (sin credenciales) | 10 omitidas (sin credenciales) |
| `npm run build` (variables ficticias, solo para compilar) | OK, 7 rutas | OK, 7 rutas |
| `npm audit` | 0 vulnerabilidades | 0 vulnerabilidades |
| 30 archivos no visuales (sha256 contra la copia previa) | — | **30/30 idénticos, 0 diferencias** |
| `package.json`, `package-lock.json`, `postcss.config.mjs`, `tsconfig.json`, `next.config.mjs`, `vitest.config.mts` | — | idénticos byte a byte |

Incidente honesto: en la primera ejecución final de `test:pg`, las 2 suites aparecieron como "failed / 28 skipped" porque el servicio PostgreSQL local se había apagado (se reinició mi shell). No era un fallo del código: con el servicio activo se repitió y dio 28/28. Lo mismo ocurrió en la línea base inicial (se omitieron 28 y se repitió con la base activa).

### Verificación visual en navegador (sí se hizo)
- Navegador: Chromium sin cabeza (build `@sparticuz/chromium`) con `puppeteer-core` y `axe-core`, instalados **fuera** del proyecto, en un directorio aparte.
- Backend: un servidor **Supabase simulado** con **datos ficticios** (108 operaciones, un depósito y un retiro), solo para poder renderizar las pantallas autenticadas. **No es evidencia de ninguna conexión real a Supabase.**
- Matriz: 7 pantallas (inicio de sesión, panel con datos, panel vacío, operaciones con datos, operaciones vacío, calendario, configuración) × 6 anchos (**360, 390, 430, 768, 1024, 1440 px**) = **42 combinaciones**, sobre el código final.
- Resultado (repetido sobre el código final de la revisión): **0** con desbordamiento horizontal; **0** con errores o avisos de consola (sin errores de hidratación); **0** violaciones de axe-core con las reglas WCAG 2.0/2.1 A y AA (incluye contraste). Nota: axe no evalúa placeholders; por eso se midieron aparte en el navegador.
- Se inspeccionaron visualmente capturas de panel (escritorio y móvil), operaciones (móvil), calendario (móvil), inicio de sesión (escritorio) y el montaje móvil en viewport.

Defectos encontrados por esa inspección y corregidos (todos eran míos):
1. Contraste insuficiente del rojo `#F43F5E` sobre fondos teñidos de rojo (4,33:1 y 4,06:1). Se añadió el token `--color-lossfg: #FB7185` solo para texto sobre superficies teñidas.
2. El logotipo se veía vacío en el móvil: el `id` del degradado SVG se repetía entre la barra lateral (oculta) y la cabecera. Ahora es único por instancia (`useId`).
3. `/trades` desbordaba a 768 px por texto `sr-only` absoluto dentro de la tabla; se resolvió con un contenedor posicionado (`.table-wrap`). También se reemplazó un `md:panel` inválido.
4. En las tarjetas móviles, la etiqueta heredaba negrita y aparecía una etiqueta "NOTAS" vacía sin notas.
5. Mis primeras mediciones fueron inválidas (servidor antiguo sirviendo hashes de archivos obsoletos); se detectó, se descartaron y se repitió todo.
6. (Revisión final) La corrección de «NOTAS» era incompleta y la captura empaquetada obsoleta; ver sección 0.
7. (Revisión final) El texto tenue y los placeholders no alcanzaban 4,5:1; ver sección 0.

## 2. Archivos visuales modificados o creados
Modificados (12; en la revisión final solo cambiaron `app/globals.css` y `app/(app)/trades/page.tsx`): `app/globals.css`, `app/layout.tsx` (solo el valor `themeColor`), `app/login/page.tsx` (solo el marcado; lógica intacta), `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/trades/page.tsx`, `app/(app)/calendar/page.tsx`, `app/(app)/settings/page.tsx`, `components/Charts.tsx`, `components/Flash.tsx`, `public/icon.svg`, `public/manifest.webmanifest` (solo colores).
Nuevos (6 de código + documentación): `app/(app)/loading.tsx`, `components/Brand.tsx`, `components/Icons.tsx`, `components/Nav.tsx`, `components/PageHeader.tsx`, `components/fmt.ts`; y documentación: `VISUAL_REDESIGN_REPORT.md` y `docs/visual-review/` (capturas, 6 JSON de la matriz y `checks-notas-y-contraste.json`). `INFORME.md` y `MANUAL_TESTS.md` se reescribieron en la revisión final; `README.md` no cambió.

## 3. Archivos funcionales que permanecieron intactos (30, verificados por hash)
`lib/finance/core.ts`, `lib/data.ts`, `lib/format.ts`, `lib/dberrors.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `app/actions.ts`, `app/api/export/route.ts`, `middleware.ts`, `supabase/migrations/0001_init.sql`, `0002_trade_time_and_atomic_daily_limit.sql`, `0003_ledger_integrity.sql`, `supabase/rls_test.sql`, `supabase/test/auth_shim.sql`, las 6 pruebas en `tests/` (`core`, `ordering-and-capital`, `dberrors` y las 3 de `integration/`), `package.json`, `package-lock.json`, `postcss.config.mjs`, `tsconfig.json`, `next.config.mjs`, `vitest.config.mts`, `.env.example`, `.gitignore`, `css.d.ts`, `next-env.d.ts`.
Sin dependencias nuevas: los iconos son SVG propios.

## 4. Elementos modificados por pantalla
**Global**: tokens de color/tipografía/radios/sombras en `@theme` (paleta pedida más `lossfg`); fuentes del sistema (sans y monoespaciada para cifras, sin cargar recursos externos); botones primario/secundario/ghost/peligro; campos con foco, error, deshabilitado y prefijos `$`/`%`; insignias con icono + texto; `prefers-reduced-motion`; marca NaokiTrader (símbolo N geométrico + logotipo).
**Layout**: sidebar de escritorio con estado activo; cabecera superior con ruta de sección y "Cerrar sesión" (misma acción); en móvil, barra de pestañas inferior con las mismas 4 rutas; esqueleto de carga.
**Inicio de sesión/registro**: panel de marca en escritorio (ilustración geométrica), formulario sobrio, estado de carga con spinner, mensajes con icono. Mismos campos, validaciones y flujo.
**Panel**: capital actual protagonista; P&L, rentabilidad (TWR), drawdown y win rate en mosaicos con signo y color; franja de conteos; gráficos con ejes discretos, rejilla sutil, tooltips en monoespaciada y sin animación de series; estado vacío ilustrado.
**Operaciones**: formulario agrupado, campo de resultado con prefijo `$`, filtros compactos, tabla con insignias de estado; en móvil, cada fila pasa a tarjeta con etiquetas (solo CSS). Mismos nombres de campo, acciones y enlaces.
**Calendario**: leyenda; días con marcador `+`/`−`/`=` además del color; resaltado del día actual; contraste revisado.
**Configuración**: secciones agrupadas, prefijos de unidad, lista de movimientos, botones destructivos diferenciados.

## 5. Contenido que NO existía en la interfaz anterior (decide si lo conservas)
No se calculó nada nuevo; se muestran campos que `analyze()` ya devolvía:
- Panel: "Capital inicial", "Depósitos y retiros netos", "Ganadas/Perdidas/Breakeven/Días operados", "Actual: x%" de drawdown y "N ganadas de M".
- Panel: botón "Registrar operación" en la cabecera (antes solo en el estado vacío); lleva a la ruta existente `/trades`.
- Calendario: leyenda y resaltado de hoy (usa `todayBogota()` existente).
- Se añadió `app/(app)/loading.tsx` (esqueleto): archivo de ruta nuevo, solo presentación.
Si prefieres exactitud estricta con la interfaz anterior, se pueden retirar sin tocar la lógica.

## 6. Decisiones de diseño y desviaciones
- **Texto de los botones primarios en azul oscuro `#050A14`**, no blanco: blanco sobre `#3B82F6` da 3,7:1 (no cumple AA); el oscuro da 5,3:1.
- **Texto tenue**: el token `--color-faint` pasó de `#64748B` a `#7B8BA3` (≥ 4,67:1 sobre todas las superficies donde se usa) para cumplir 4,5:1; es una desviación del valor inicial de la especificación, documentada en la sección 0.
- No existía botón para contraer el sidebar, por lo que no se añadió. No hay selector de periodo ni lista de operaciones recientes en el panel, por lo que no se inventaron.
- Los resultados cero siguen siendo "breakeven" y se distinguen de "sin operación" en el calendario. No existe el estado "pendiente" en los datos.

## 7. Limitaciones no verificadas
- Solo Chromium; **no** Safari, Firefox ni dispositivos físicos. Sin pruebas táctiles reales ni zoom del 200 %.
- No se ejercitaron envíos de formularios ni errores del servidor (Flash), ni el estado de carga del inicio de sesión, ni el esqueleto de carga, ni hover/foco/activo por captura. `prefers-reduced-motion` está implementado pero no se probó.
- axe-core cubre solo una parte de WCAG: **no** se probaron navegación completa por teclado ni lector de pantalla.
- Los datos de las capturas son ficticios (servidor simulado). **Supabase real sigue sin verificarse.**
- El diseño de móvil se revisó en viewport estrecho de escritorio con emulación táctil, no en un teléfono.
- `INFORME.md` y `MANUAL_TESTS.md` están actualizados a esta versión; `README.md` no cambió (sigue siendo válido). `MANUAL_TESTS.md` **sigue sin ejecutarse**: todas sus casillas están sin marcar.
