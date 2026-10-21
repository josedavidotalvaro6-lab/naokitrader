# NaokiTrader

Seguimiento privado de rendimiento de trading. Next.js 15 (App Router) · TypeScript · Tailwind 4 · Supabase (Auth + Postgres + RLS) · Recharts.

Estado de verificación real: ver `INFORME.md`. Pruebas manuales en navegador y móvil: `MANUAL_TESTS.md`.

## 1. Requisitos
Node 20 o 22 y npm 10. Un proyecto de Supabase (usa uno **de desarrollo** distinto del de producción).

## 2. Instalación
```bash
npm ci
cp .env.example .env.local      # completa los dos valores (ver sección 3)
npm run dev                     # http://localhost:3000
```

## 3. Configurar un proyecto Supabase de desarrollo (paso a paso)
1. En https://supabase.com crea un proyecto nuevo (guarda la contraseña de la base; no se usa en la app).
2. **Migraciones, en este orden exacto**, cada una en el *SQL Editor* → *New query* → pegar → *Run*, esperando "Success":
   1. `supabase/migrations/0001_init.sql` — tablas, RLS, trigger de alta de usuario, límite diario.
   2. `supabase/migrations/0002_trade_time_and_atomic_daily_limit.sql` — hora de ejecución y límite diario a prueba de concurrencia.
   3. `supabase/migrations/0003_ledger_integrity.sql` — capital nunca negativo, validado en la base y a prueba de concurrencia.

   `0002` y `0003` se pueden volver a ejecutar sin error; `0001` no (falla porque las tablas ya existen). Alternativa con la CLI de Supabase: `supabase link --project-ref <ref>` y `supabase db push`.
3. **Authentication** → Sign In / Providers → Email: habilitado. En el proyecto **de desarrollo**, desactiva "Confirm email" (la prueba de integración lo necesita; el nombre y la ubicación exactos pueden variar según la versión del panel). En producción déjalo activado.
4. **Claves**: Project Settings → API (o "API Keys"). Copia la **Project URL** y la clave pública **anon / publishable**.
5. En `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave anon/publishable>
   ```
6. **Nunca uses la clave `service_role` / secret** en esta app ni en el cliente. `.env.local` está en `.gitignore`; no lo subas al repositorio. La seguridad de los datos la dan las políticas RLS, no el secreto de la clave anon.
7. Arranca con `npm run dev`, crea tu cuenta en `/login` y recorre `MANUAL_TESTS.md`.
8. Para producción (más adelante, no hecho): crea otro proyecto, aplica las 3 migraciones, define las dos variables en la plataforma de despliegue, añade la URL pública en Authentication → URL Configuration y, si la app es solo para ti, desactiva los registros nuevos tras crear tu cuenta.

## 4. Pruebas (comandos exactos)
| Comando | Qué hace | Requiere |
|---|---|---|
| `npm test` | 39 pruebas unitarias del núcleo financiero y mensajes de error | nada |
| `PG_TEST_URL=postgres://usuario:clave@localhost:5432/postgres npm run test:pg` | 28 pruebas en un PostgreSQL local: migraciones en orden, RLS, límite diario, integridad del capital, concurrencia y paridad SQL↔TypeScript | PostgreSQL local con superusuario; crea y borra bases `naoki_test_*` y `naoki_ledger_*`; usa un simulador mínimo de `auth` (`supabase/test/auth_shim.sql`) |
| `SUPABASE_TEST_URL=https://<ref>.supabase.co SUPABASE_TEST_ANON_KEY=<anon> npm run test:supabase` | 10 pruebas contra Supabase **real**: registro, login, persistencia con sesión nueva, aislamiento RLS entre 2 usuarios, límite diario secuencial y concurrente, integridad del capital | proyecto de **desarrollo** con las 3 migraciones y "Confirm email" desactivado |
| `npx tsc --noEmit` | verificación de tipos | `npm ci` |
| `npm run build` | compilación de producción (acepta variables ficticias solo para compilar) | `npm ci` |
| `npm run audit:prod` / `npm audit` | auditoría de dependencias | red |

Las credenciales de las pruebas se pasan **por variables de entorno del shell**, no se guardan en archivos versionados. La prueba de Supabase crea 3 usuarios nuevos por ejecución (correos aleatorios `@example.com`); sin la clave `service_role` no puede borrarlos: elimínalos en Authentication → Users. Si el proyecto limita el alta de usuarios, espera o reduce las ejecuciones.

## 5. Reglas financieras (núcleo en `lib/finance/core.ts`, centavos enteros)
- Los flujos externos (depósitos/retiros) de un día se aplican antes de las operaciones de ese día.
- Orden de operaciones dentro de un día: hora de ejecución (opcional; sin hora van al final) → fecha de creación → id. Riesgo planificado = capital al inicio de cada operación × riesgo %, encadenado.
- Estado: > 0 ganada, < 0 perdida, = 0 breakeven (cuenta como operación, no como ganada). Días sin operar no cuentan. Sin datos → N/D.
- Rentabilidad = ponderada por tiempo (TWR); depósitos y retiros no son rendimiento. Drawdown = caída del índice TWR desde su máximo (incluye caídas intradía).
- **Capital negativo prohibido**: ninguna operación, retiro, edición, eliminación o cambio de capital inicial puede dejar el capital < 0 en ningún punto del historial; con capital 0 solo se admiten depósitos y operaciones de resultado 0.

## 6. Integridad en la base de datos (migraciones 0002 y 0003)
- Todo escritor de un usuario toma primero un *advisory lock* de transacción por usuario; las escrituras de ese usuario se serializan.
- Tras cada INSERT/UPDATE/DELETE en `trades`, `cash_flows` y `settings` (capital inicial), un trigger recalcula la línea de tiempo completa (`ledger_first_violation`) y aborta con el código `NT001` si queda inválida. Así se protegen también las ediciones y eliminaciones que afectan al historial posterior.
- Límite diario: el trigger `enforce_daily_trade_limit` usa el mismo lock; error `P0001`.
- La app valida además en el servidor (mejor mensaje) y traduce los errores de la base (`lib/dberrors.ts`).
- Supuesto: nivel de aislamiento `READ COMMITTED` (el predeterminado de Supabase/PostgREST). Coste: cada escritura recalcula el historial del usuario (O(n)), adecuado para un uso personal de cientos o pocos miles de registros.

## 7. Dependencias y seguridad
- `package.json` incluye `"overrides": {"next": {"postcss": "$postcss"}}`: Next 15.5.28 (última 15.x) fija `postcss@8.4.31`, vulnerable; el override lo resuelve a la misma versión que el `postcss` directo (8.5.31, misma versión mayor 8). No es una excepción de auditoría: cambia la versión realmente instalada. Revisa si puedes quitarlo cuando Next publique una versión que declare un PostCSS corregido.
- Tailwind se migró de 3 a 4 para eliminar la cadena de dependencias vulnerables de Tailwind 3 (sin corrección dentro de la v3). Revisión visual pendiente (`MANUAL_TESTS.md`, sección K).
- No hay claves privadas en el código; solo `NEXT_PUBLIC_SUPABASE_URL` y la clave anon.

## 8. Respaldo
Exporta CSV desde Operaciones o Configuración con regularidad; activa los respaldos de tu proyecto Supabase (según el plan) y haz `pg_dump` periódicos.
