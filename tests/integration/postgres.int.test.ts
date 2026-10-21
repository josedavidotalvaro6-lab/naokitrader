/**
 * Verifica migraciones, RLS y límite diario sobre un PostgreSQL REAL (no Supabase).
 * Requiere PG_TEST_URL (superusuario de una instancia local de pruebas). Si falta, la suite se OMITE.
 * Usa un shim mínimo de `auth` (supabase/test/auth_shim.sql); no prueba GoTrue ni PostgREST.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const URL_ = process.env.PG_TEST_URL;
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const sql = (f: string) => readFileSync(new URL(`../../supabase/${f}`, import.meta.url), "utf8");
const dbName = "naoki_test_" + Math.random().toString(36).slice(2, 8);
let admin: Client; let testUrl: string;

async function connect() { const c = new Client({ connectionString: testUrl }); await c.connect(); return c; }
/** Ejecuta fn como usuario autenticado `uid` dentro de una transacción (role authenticated + JWT claims). */
async function asUser<T>(uid: string, fn: (c: Client) => Promise<T>, c?: Client): Promise<T> {
  const cl = c ?? (await connect());
  try {
    await cl.query("begin");
    await cl.query("set local role authenticated");
    await cl.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]);
    const r = await fn(cl);
    await cl.query("commit");
    return r;
  } catch (e) { await cl.query("rollback").catch(() => {}); throw e; }
  finally { if (!c) await cl.end(); }
}

describe.skipIf(!URL_)("PostgreSQL real: migraciones, RLS y límite diario", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: URL_ }); await admin.connect();
    await admin.query(`create database ${dbName}`);
    const u = new globalThis.URL(URL_!); u.pathname = "/" + dbName; testUrl = u.toString();
    const c = await connect();
    await c.query(sql("test/auth_shim.sql"));
    await c.query(sql("migrations/0001_init.sql"));
    await c.query(sql("migrations/0002_trade_time_and_atomic_daily_limit.sql"));
    await c.query(sql("migrations/0003_ledger_integrity.sql"));
    await c.query("insert into auth.users (id, email) values ($1,'a@t.local'),($2,'b@t.local')", [A, B]);
    await c.end();
  });
  afterAll(async () => { await admin.query(`drop database if exists ${dbName} with (force)`); await admin.end(); });

  it("las migraciones se aplican y RLS está activo en las 3 tablas", async () => {
    const c = await connect();
    const r = await c.query("select relname, relrowsecurity from pg_class where relname in ('settings','trades','cash_flows') and relkind='r'");
    expect(r.rows).toHaveLength(3);
    expect(r.rows.every((x) => x.relrowsecurity)).toBe(true);
    const cols = await c.query("select 1 from information_schema.columns where table_name='trades' and column_name='trade_time'");
    expect(cols.rowCount).toBe(1);
    await c.end();
  });

  it("al crear un usuario se crean sus settings por defecto (150 / 3% / 1 por día)", async () => {
    const c = await connect();
    const r = await c.query("select initial_capital::float8 ic, risk_pct::float8 rp, max_trades_per_day m, timezone from public.settings where user_id=$1", [A]);
    expect(r.rows[0]).toMatchObject({ ic: 150, rp: 3, m: 1, timezone: "America/Bogota" });
    await c.end();
  });

  it("persistencia y estado generado: win/loss/breakeven", async () => {
    await asUser(A, async (c) => { await c.query("insert into public.trades (trade_date, net_result, trade_time) values ('2026-02-01', 5.5, '09:30'),('2026-02-02', -2,null)"); });
    await asUser(A, async (c) => { await c.query("update public.settings set max_trades_per_day = null"); await c.query("insert into public.trades (trade_date, net_result) values ('2026-02-03', 0)"); });
    const rows = await asUser(A, async (c) => (await c.query("select trade_date::text d, status, trade_time::text t from public.trades order by trade_date")).rows);
    expect(rows.map((r) => r.status)).toEqual(["win", "loss", "breakeven"]);
    expect(rows[0].t).toBe("09:30:00");
    await asUser(A, async (c) => { await c.query("update public.settings set max_trades_per_day = 1"); });
  });

  it("aislamiento RLS: B no ve, no modifica, no borra ni inserta como A", async () => {
    const seen = await asUser(B, async (c) => (await c.query("select count(*)::int n from public.trades")).rows[0].n);
    expect(seen).toBe(0);
    const upd = await asUser(B, async (c) => (await c.query("update public.trades set net_result = 999")).rowCount);
    expect(upd).toBe(0);
    const del = await asUser(B, async (c) => (await c.query("delete from public.trades")).rowCount);
    expect(del).toBe(0);
    await expect(asUser(B, async (c) => { await c.query("insert into public.trades (user_id, trade_date, net_result) values ($1,'2026-03-01',1)", [A]); })).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(B, async (c) => { await c.query("insert into public.cash_flows (user_id, flow_date, amount) values ($1,'2026-03-01',10)", [A]); })).rejects.toMatchObject({ code: "42501" });
    const sOther = await asUser(B, async (c) => (await c.query("select count(*)::int n from public.settings where user_id=$1", [A])).rows[0].n);
    expect(sOther).toBe(0);
    const stillThere = await asUser(A, async (c) => (await c.query("select count(*)::int n from public.trades")).rows[0].n);
    expect(stillThere).toBe(3);
  });

  it("anon no tiene acceso a las tablas", async () => {
    const c = await connect();
    await c.query("begin"); await c.query("set local role anon");
    await expect(c.query("select * from public.trades")).rejects.toMatchObject({ code: "42501" });
    await c.query("rollback"); await c.end();
  });

  it("límite diario secuencial: el segundo registro del día se rechaza; corregir el existente sí se permite", async () => {
    await expect(asUser(A, async (c) => { await c.query("insert into public.trades (trade_date, net_result) values ('2026-02-01', 1)"); })).rejects.toMatchObject({ code: "P0001" });
    await asUser(A, async (c) => { await c.query("update public.trades set net_result = 6, trade_date = trade_date where trade_date = '2026-02-01'"); });
    // mover una operación a un día ocupado también se rechaza
    await expect(asUser(A, async (c) => { await c.query("update public.trades set trade_date = '2026-02-01' where trade_date = '2026-02-02'"); })).rejects.toMatchObject({ code: "P0001" });
  });

  it("límite diario concurrente: 12 inserciones simultáneas en la misma fecha → exactamente 1 éxito", async () => {
    const N = 12;
    const clients = await Promise.all(Array.from({ length: N }, connect));
    const results = await Promise.allSettled(clients.map((c) => asUser(A, async (cl) => { await cl.query("insert into public.trades (trade_date, net_result) values ('2026-04-10', 1)"); }, c)));
    await Promise.all(clients.map((c) => c.end()));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rej).toHaveLength(N - 1);
    expect(rej.every((r) => r.reason.code === "P0001")).toBe(true);
    const n = await asUser(A, async (c) => (await c.query("select count(*)::int n from public.trades where trade_date='2026-04-10'")).rows[0].n);
    expect(n).toBe(1);
  });

  it("límite diario concurrente con límite 3: nunca se superan 3", async () => {
    await asUser(A, async (c) => { await c.query("update public.settings set max_trades_per_day = 3"); });
    const N = 10;
    const clients = await Promise.all(Array.from({ length: N }, connect));
    const results = await Promise.allSettled(clients.map((c) => asUser(A, async (cl) => { await cl.query("insert into public.trades (trade_date, net_result) values ('2026-05-05', 1)"); }, c)));
    await Promise.all(clients.map((c) => c.end()));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const n = await asUser(A, async (c) => (await c.query("select count(*)::int n from public.trades where trade_date='2026-05-05'")).rows[0].n);
    expect(n).toBe(3);
  });

  it("restricciones: riesgo fuera de rango y límite inválido se rechazan", async () => {
    await expect(asUser(A, async (c) => { await c.query("update public.settings set risk_pct = 0"); })).rejects.toMatchObject({ code: "23514" });
    await expect(asUser(A, async (c) => { await c.query("update public.settings set max_trades_per_day = 0"); })).rejects.toMatchObject({ code: "23514" });
    await expect(asUser(A, async (c) => { await c.query("insert into public.cash_flows (flow_date, amount) values ('2026-01-01', 0)"); })).rejects.toMatchObject({ code: "23514" });
  });
});
