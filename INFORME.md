# Informe de verificación — NaokiTrader v0.3.0 (20-oct-2026)

Documentos relacionados: `VISUAL_REDESIGN_REPORT.md` (detalle del rediseño visual y de la revisión final), `MANUAL_TESTS.md` (pruebas manuales pendientes), `README.md` (instalación y configuración).

Entorno de las comprobaciones: Node 22.22, npm 10.9, PostgreSQL 16 local (**no es Supabase**), Chromium sin cabeza (build `@sparticuz/chromium`) con `puppeteer-core` y `axe-core` instalados **fuera** del proyecto.
**Supabase real: NO verificado.** No se ha ejecutado ninguna prueba contra un proyecto Supabase.
**Pruebas manuales: NO ejecutadas.** Todo lo marcado como "aprobado" abajo es una comprobación automática que se ejecutó de verdad.

## 1. Estado de la versión
- Lógica financiera, base de datos y autenticación: sin cambios desde la verificación anterior (migraciones 0001–0003 intactas).
- Interfaz: rediseño visual completo (tokens de diseño, sidebar en escritorio, barra de pestañas inferior en móvil, panel, gráficos, calendario con marcadores `+`/`−`/`=`).
- En móvil (< 768 px) el historial de operaciones se presenta como **tarjetas apiladas** (solo CSS, sin cambiar los datos ni las acciones); desde 768 px es una tabla con desplazamiento horizontal interno. La etiqueta «Notas» solo aparece cuando la operación tiene notas con contenido; si están vacías o solo tienen espacios, la celda se oculta en móvil.
- Revisión final (esta versión): corregida la etiqueta «Notas» huérfana y elevado el contraste del texto tenue (`--color-faint`) a ≥ 4,67:1 sobre todas las superficies donde se usa.

## 2. Comprobaciones automáticas ejecutadas y aprobadas
| Comprobación | Resultado real |
|---|---|
| `npm ci` + `npm audit` (completo) | 0 vulnerabilidades |
| `npx tsc --noEmit` | sin errores |
| `npm test` (unitarias: núcleo financiero, orden y capital negativo, mensajes de error) | 3 archivos, **39/39** |
| `npm run test:pg` (PostgreSQL local: migraciones en orden, RLS, límite diario, integridad del capital, concurrencia, paridad SQL↔TypeScript) | 2 archivos, **28/28** |
| `npm run build` (variables ficticias solo para compilar) | exitoso, 7 rutas + middleware |
| 30 archivos no visuales (núcleo, acciones, middleware, migraciones, pruebas, configuración) contra su hash original | **30/30 idénticos** |
| `package.json`, `package-lock.json`, `postcss.config.mjs`, `tsconfig.json`, `next.config.mjs`, `vitest.config.mts` frente al paquete anterior | idénticos byte a byte |
| Navegador (Chromium): 7 pantallas × 6 anchos (360, 390, 430, 768, 1024, 1440 px) = 42 combinaciones | 0 desbordamientos horizontales, 0 errores o avisos de consola, 0 violaciones de axe-core (WCAG 2.0/2.1 A y AA, incluye contraste) |
| Navegador: celdas de notas en móvil (360 y 390 px; 108 filas de prueba, 50 con texto) | 50 visibles con contenido; 58 vacías o de solo espacios, ocultas; 0 etiquetas huérfanas; 0 notas con texto ocultas |
| Navegador: celdas de notas en escritorio (1440 px) | las 108 celdas se mantienen (alineación de la tabla intacta) |
| Contraste medido en el navegador: placeholder del campo de resultado | 5,41:1 (123,139,163 sobre 13,18,28) |
| Contraste del separador decorativo «/» de la cabecera (token sobre `#080B12`) | 5,68:1 |
| Campos nativos de fecha y hora vacíos | usan el color de texto normal (≈ 16:1) |

Pruebas del núcleo y de la base de datos (heredadas, siguen aprobadas): orden determinista por hora, capital negativo prohibido, correcciones históricas, 8 retiros simultáneos → 1 éxito, carrera «eliminar depósito vs insertar pérdida dependiente» sin estados inválidos, límite diario concurrente (12 → 1), y paridad en 400 escenarios aleatorios entre `ledger_first_violation` (SQL) y `validateTimeline` (TypeScript).

Evidencia de que las correcciones de base de datos eran necesarias: solo con 0001, 12 inserciones simultáneas con límite 1 dejaron pasar 11, 12, 11, 6 y 10 registros; con 0001+0002 pero sin 0003, la carrera «eliminar depósito vs insertar pérdida» dejó capital negativo en 20 de 20 rondas; con 0003, en ninguna.

Importante: los datos de la verificación en navegador son **ficticios** (un servidor Supabase simulado fuera del proyecto). No demuestran ninguna conexión real.

## 3. Pruebas fallidas o incidentes durante el desarrollo (todos resueltos)
- Una expectativa errónea en una prueba de PostgreSQL (`initial_capital = -1` lo rechaza antes el CHECK de la tabla, `23514`, no `NT001`): se corrigió la prueba, no el código.
- Tras añadir el override de PostCSS, `npm install` dejó una copia obsoleta; se resolvió con reinstalación limpia.
- Varias veces las suites de PostgreSQL aparecieron como "failed / skipped" porque el servicio local se había apagado al reiniciarse la shell; con el servicio activo dieron 28/28. No fue un fallo del código.
- Mediciones de navegador inválidas al inicio (un servidor antiguo servía archivos estáticos con hashes obsoletos): se detectó, se descartaron y se repitió todo.
- Defectos visuales detectados por inspección y corregidos: contraste del rojo sobre fondos teñidos (4,06–4,33:1; ahora token `--color-lossfg`), logotipo vacío en móvil por `id` SVG duplicado, desborde de la tabla a 768 px por texto `sr-only` absoluto, y etiqueta «Notas» vacía.
- La primera corrección de «Notas» (`:empty`) fue incompleta: no cubría notas con solo espacios, y la captura empaquetada era anterior a la corrección. Se sustituyó por un atributo explícito (`data-empty`), se verificó con casos de nota nula, vacía, solo espacios y con contenido, y se regeneraron todas las capturas.

## 4. Implementado pero NO verificado
- **Supabase real**: `npm run test:supabase` (registro, login, persistencia, RLS entre 2 usuarios, límite diario, integridad del capital y concurrencia) está escrito, pero sus **10 pruebas se omiten** sin credenciales. Nada se afirma sobre GoTrue, PostgREST ni los triggers bajo el pool real.
- Las migraciones se probaron en PostgreSQL 16 con un simulador mínimo de `auth`; Supabase puede diferir.
- En navegador real y manualmente (ver `MANUAL_TESTS.md`, sin ejecutar): envío de formularios, mensajes de error del servidor, exportación CSV con datos reales, navegación completa por teclado, lector de pantalla, estados hover/foco/activo, estado de carga del inicio de sesión, esqueleto de carga, `prefers-reduced-motion`, instalación PWA.
- Otros navegadores y dispositivos: solo se usó Chromium; no Safari, Firefox ni teléfonos físicos. El diseño móvil se revisó con viewport estrecho y emulación táctil.
- `next dev` con el override de PostCSS (se ejercitó `next build` y `next start`).

## 5. Pendiente
- Crear un proyecto Supabase de desarrollo, aplicar 0001→0003 y ejecutar `npm run test:supabase`.
- Ejecutar `MANUAL_TESTS.md` en escritorio y móvil, en Chrome, Firefox y Safari.
- Repetir `npm audit` justo antes de publicar.
- Despliegue (no realizado), pruebas E2E automatizadas, exportación XLSX, iconos PNG y service worker para la PWA, edición de depósitos/retiros (hoy solo agregar/eliminar).

## 6. Vulnerabilidades y dependencias
Al inicio: `next@15.5.28` (última 15.x) fijaba `postcss@8.4.31` (vulnerable) y `tailwindcss@3.4.19` arrastraba una cadena vulnerable sin corrección dentro de la v3 (`braces`, `micromatch`, `chokidar`, etc.).
Resolución: `overrides: {"next": {"postcss": "$postcss"}}` (un único `postcss@8.5.31`, misma versión mayor) y migración a Tailwind 4.3.3. `npm audit` = **0 vulnerabilidades**.
Riesgo residual: el override no está declarado por Next (verificado con `next build` y `next start`, no con `next dev`); la base de avisos de npm cambia con el tiempo, así que repite `npm audit` antes de publicar.

## 7. Limitaciones conocidas
- La integridad del capital y el límite diario asumen nivel de aislamiento `READ COMMITTED` (predeterminado de Supabase) y serializan las escrituras de un mismo usuario.
- Cada escritura recalcula el historial del usuario (O(n)), adecuado para uso personal.
- Sin claves privadas en el código; solo `NEXT_PUBLIC_SUPABASE_URL` y la clave anon (públicas por diseño).
