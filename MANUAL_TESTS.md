# Pruebas manuales — NaokiTrader v0.3.0

Ejecútalas contra un **proyecto Supabase de desarrollo** (ver `README.md`) con `npm run dev`, o con `npm run build && npm start`.
Repite cada punto en **escritorio (≥ 1280 px)** y **móvil (≈ 360–430 px)**, idealmente en un teléfono real. Navegadores mínimos: Chrome, Firefox y Safari (iOS). Anota fecha, navegador, dispositivo y resultado.

**Estado: ninguna casilla marcada. Estas pruebas manuales NO se han ejecutado.**

## 0. Qué ya se comprobó de forma automática (no sustituye a esta lista)
Ejecutado en Chromium sin cabeza contra un servidor Supabase **simulado con datos ficticios**, sobre la versión actual:
- 7 pantallas (inicio de sesión, panel con datos, panel vacío, operaciones con datos, operaciones vacío, calendario, configuración) × 6 anchos (360, 390, 430, 768, 1024, 1440 px): sin desbordamiento horizontal, sin errores de consola y sin violaciones de axe-core (WCAG 2.0/2.1 A y AA, incluido contraste).
- Etiqueta «Notas» en tarjetas móviles: oculta si la nota es nula, vacía o solo espacios; visible con contenido.
- Contraste del placeholder (5,41:1) y del separador de la cabecera (5,68:1).
Evidencia: `docs/visual-review/` y `INFORME.md`. **No cubre**: formularios enviados de verdad, Supabase real, teclado completo, lector de pantalla, otros navegadores, dispositivos físicos.

## A. Acceso
- [ ] `/dashboard`, `/trades`, `/calendar` y `/settings` sin sesión redirigen a `/login`.
- [ ] Registro con correo y contraseña de ≥ 8 caracteres; una contraseña corta es rechazada.
- [ ] Inicio de sesión correcto → `/dashboard`. Contraseña incorrecta → mensaje rojo con icono; el botón vuelve a estar activo.
- [ ] Durante el envío, el botón muestra «Procesando…» con indicador y no admite un segundo clic.
- [ ] Con sesión iniciada, `/login` redirige a `/dashboard`. «Cerrar sesión» vuelve a `/login` y Atrás no muestra datos.
- [ ] Sin conexión (modo avión) al iniciar sesión: mensaje claro de error de conexión.
- [ ] Escritorio: panel de marca a la izquierda (ilustración y lema) y formulario a la derecha. Móvil: solo el formulario con la marca encima.

## B. Navegación y estructura
- [ ] Escritorio: sidebar fija con Panel, Operaciones, Calendario y Configuración; la sección actual aparece resaltada; la cabecera muestra «NaokiTrader / sección» y «Cerrar sesión».
- [ ] Móvil: barra de pestañas inferior con las mismas 4 rutas, la actual resaltada, sin tapar contenido al final de la página (incluido el último elemento) ni en teléfonos con barra de gestos.
- [ ] Móvil: «Cerrar sesión» es solo un icono con nombre accesible; funciona.
- [ ] Las rutas y destinos son los mismos que antes; Atrás/Adelante funcionan.

## C. Panel
- [ ] Cuenta nueva: capital $150.00; P&L, rentabilidad, win rate y drawdown en **N/D**; estado vacío con botón «Registrar operación».
- [ ] Con 3 o más operaciones: capital, P&L (con signo y color), rentabilidad, drawdown máx./actual, win rate, conteos (ganadas/perdidas/breakeven/días operados) coinciden con un cálculo a mano.
- [ ] «Capital inicial» y «Depósitos y retiros netos» son correctos; un depósito cambia el capital pero **no** la rentabilidad.
- [ ] Gráficos de equity y de resultados diarios: ejes legibles, tooltip con cifras, verde/rojo correctos, sin cortes en el borde.
- [ ] Botón «Registrar operación» de la cabecera lleva a `/trades`.
- [ ] Móvil: mosaicos en 2 columnas, textos sin recortes, gráficos sin desbordar.

## D. Operaciones
- [ ] Guardar una operación (fecha de hoy en hora de Bogotá por defecto, resultado con prefijo `$`, hora opcional, notas) → aviso verde y aparece en el historial.
- [ ] Estado: > 0 «Ganada» (verde), < 0 «Perdida» (rojo), 0 «Breakeven» (neutro); cada uno con icono además del color.
- [ ] Tras recargar y tras cerrar/abrir sesión, los registros siguen ahí.
- [ ] Con límite 1: una segunda operación el mismo día se rechaza con mensaje claro. Con límite vacío o 3: varias el mismo día; con horas distintas, «Capital previo» y «Riesgo planif.» se encadenan por hora.
- [ ] Editar: el formulario se rellena y cambia a «Editar operación» / «Guardar cambios»; «Cancelar» lo limpia.
- [ ] Editar a la baja una operación antigua que invalide las posteriores → mensaje de capital negativo; no se guarda. Eliminar una ganancia de la que dependen pérdidas posteriores → rechazado. Una pérdida mayor que el capital → rechazada.
- [ ] Filtros (desde, hasta, estado), «Filtrar» y «Limpiar» funcionan; sin coincidencias aparece un estado vacío.
- [ ] **Escritorio (≥ 768 px)**: tabla con columnas Fecha, Hora, Resultado, Estado, Capital previo, Riesgo planif., Notas y acciones; cifras alineadas a la derecha; si no cabe, se desplaza horizontalmente **dentro del panel**, nunca la página entera.
- [ ] **Móvil (< 768 px)**: cada operación es una **tarjeta apilada** (Fecha/Hora, Resultado/Estado, Capital previo/Riesgo planif.) con botones «Editar» y «Eliminar» de ancho completo.
- [ ] Móvil: la etiqueta «NOTAS» aparece **solo** si la operación tiene notas con contenido; sin notas (vacías o solo espacios) no aparece ninguna etiqueta suelta. Escritorio: la columna Notas se mantiene siempre.
- [ ] Una nota larga se ajusta en varias líneas en la tarjeta móvil y se recorta con «…» en la tabla de escritorio.
- [ ] El campo numérico del resultado admite negativos y decimales con el teclado táctil.

## E. Calendario
- [ ] 12 meses del año; en cada día con operación, color **y** marcador (`+` ganancia, `−` pérdida, `=` breakeven); sin operación, celda neutra; el día de hoy tiene un contorno cian; leyenda visible.
- [ ] Total mensual con signo y color; coincide con la suma de operaciones del mes.
- [ ] Botones de año anterior/siguiente funcionan. Un día con operación coincide con el historial.
- [ ] Móvil: una columna de meses (dos desde ≈ 640 px), celdas con tamaño táctil razonable.

## F. Configuración
- [ ] Cambiar capital inicial, riesgo (%) y límite diario → «Configuración guardada»; panel y riesgo se recalculan.
- [ ] Riesgo 0 o > 100 y límite 0 → rechazados con mensaje.
- [ ] Bajar el capital inicial por debajo de lo que exige el historial → rechazado.
- [ ] Agregar depósito y retiro; un retiro mayor que el capital → rechazado; eliminar un depósito del que dependen pérdidas posteriores → rechazado. El botón «Eliminar» tiene nombre accesible con fecha y monto.

## G. Exportación y respaldo
- [ ] «Exportar CSV» (Operaciones y Configuración) descarga `naokitrader-operaciones.csv`; abre en Excel/Sheets con acentos correctos y columnas fecha, hora, resultado, estado, capital previo, riesgo y notas.
- [ ] Una nota que empieza por `=` o `+` aparece neutralizada (con comilla inicial). Sin sesión, `/api/export` redirige a `/login`.

## H. Concurrencia y aislamiento
- [ ] En dos pestañas, enviar casi a la vez dos operaciones del mismo día (límite 1): solo una se guarda.
- [ ] En dos pestañas, retirar a la vez montos que juntos superan el capital: solo uno se guarda.
- [ ] Con dos cuentas (dos perfiles de navegador), cada una ve únicamente sus datos en todas las pantallas y en el CSV.

## I. Errores y estados límite
- [ ] Con Supabase inaccesible, las páginas muestran un aviso rojo con icono, no una pantalla en blanco.
- [ ] Al navegar entre secciones aparece brevemente el esqueleto de carga, sin saltos bruscos de diseño.
- [ ] Zoom 200 %, alto contraste y `prefers-reduced-motion`: sin pérdida de contenido; las animaciones se desactivan.

## J. Teclado y lector de pantalla
- [ ] Solo con teclado: se puede iniciar sesión, recorrer el menú, guardar/editar/eliminar una operación, usar filtros, y cambiar configuración; el foco (contorno cian) siempre es visible.
- [ ] VoiceOver o NVDA: formularios con etiquetas, la tabla/tarjetas se anuncian como tabla con encabezados, los avisos se leen, y el gráfico tiene nombre accesible.

## K. Apariencia (rediseño visual)
- [ ] Fondo azul marino oscuro, paneles elevados, bordes sutiles, azul para acciones, verde/rojo solo para resultados; sin brillos excesivos.
- [ ] Las cifras financieras usan tipografía monoespaciada y se alinean bien en columnas.
- [ ] Botones primarios con texto oscuro legible sobre el azul; botón «Eliminar» claramente diferenciado.
- [ ] Placeholders y textos secundarios legibles (el color tenue ahora es `#7B8BA3`).
- [ ] Hover y pulsación de botones, filas y celdas del calendario son discretos y no desplazan el diseño.
- [ ] Comparar con las capturas de `docs/visual-review/` en cada pantalla y ancho.

## L. PWA
- [ ] `/manifest.webmanifest` carga; Chrome ofrece instalar (falta un icono PNG: pendiente conocido). La app instalada abre `/dashboard`.
