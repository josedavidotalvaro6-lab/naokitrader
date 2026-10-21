/**
 * Integridad del libro mayor en PostgreSQL REAL (migración 0003): capital nunca negativo, correcciones históricas,
 * concurrencia y paridad con el núcleo TypeScript. Requiere PG_TEST_URL (superusuario de una instancia local de pruebas).
 * No es Supabase: usa el shim de `auth` de supabase/test/auth_shim.sql.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { validateTimeline, toCents, type Trade, type CashFlow } from "../../lib/finance/core";

const URL_ = process.env.PG_TEST_URL;
const sql = (f: string) => readFileSync(new URL(`../../supabase/${f}`, import.meta.url), "utf8");
const dbName = "naoki_ledger_" + Math.random().toString(36).slice(2, 8);
let admin: Client; let testUrl: string;

const connect = async () => { const c = new Client({ connectionString: testUrl }); await c.connect(); return c; };
async function asUser<T>(uid: string, fn: (c: Client) => Promise<T>, c?: Client): Promise<T> {
  const cl = c ?? (await connect());
  try {
    await cl.query("begin"); await cl.query("set local role authenticated");
    await cl.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]);
    const r = await fn(cl); await cl.query("commit"); return r;
  } catch (e) { await cl.query("rollback").catch(() => {}); throw e; }
  finally { if (!c) await cl.end(); }
}
async function newUser(initial?: number, max: number | null = null): Promise<string> {
  const id = randomUUID();
  await admin2.query("insert into auth.users (id,email) values ($1,$2)", [id, id + "@t.local"]);
  await admin2.query("update public.settings set max_trades_per_day=$2" + (initial !== undefined ? ", initial_capital=$3" : "") + " where user_id=$1", initial !== undefined ? [id, max, initial] : [id, max]);
  return id;
}
let admin2: Client;
const q = (u: string, text: string, params: unknown[] = []) => asUser(u, (c) => c.query(text, params));
const addFlow = (u: string, date: string, amt: number) => q(u, "insert into public.cash_flows (flow_date, amount) values ($1,$2) returning id", [date, amt]);
const addTrade = (u: string, date: string, net: number, time: string | null = null) => q(u, "insert into public.trades (trade_date, net_result, trade_time) values ($1,$2,$3) returning id", [date, net, time]);
const violation = async (u: string) => (await admin2.query("select * from public.ledger_first_violation($1)", [u])).rows[0] ?? null;
const NT001 = { code: "NT001" };

describe.skipIf(!URL_)("Libro mayor en PostgreSQL real (migración 0003)", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: URL_ }); await admin.connect();
    await admin.query(`create database ${dbName}`);
    const u = new globalThis.URL(URL_!); u.pathname = "/" + dbName; testUrl = u.toString();
    admin2 = await connect();
    for (const f of ["test/auth_shim.sql", "migrations/0001_init.sql", "migrations/0002_trade_time_and_atomic_daily_limit.sql", "migrations/0003_ledger_integrity.sql"]) await admin2.query(sql(f));
  });
  afterAll(async () => { await admin2.end(); await admin.query(`drop database if exists ${dbName} with (force)`); await admin.end(); });

  describe("reglas secuenciales (la base es la autoridad)", () => {
    it("rechaza una pérdida mayor que el capital; permite perder exactamente todo", async () => {
      const u = await newUser();
      await expect(addTrade(u, "2026-01-05", -150.01)).rejects.toMatchObject(NT001);
      await addTrade(u, "2026-01-05", -150);
      expect(await violation(u)).toBeNull();
    });
    it("con capital 0: rechaza ganancias/pérdidas, permite breakeven y depósitos", async () => {
      const u = await newUser(); await addTrade(u, "2026-01-05", -150);
      await expect(addTrade(u, "2026-01-06", 5)).rejects.toMatchObject(NT001);
      await addTrade(u, "2026-01-06", 0);
      await addFlow(u, "2026-01-07", 50); await addTrade(u, "2026-01-07", 5);
    });
    it("rechaza un retiro mayor que el capital; uno igual es válido", async () => {
      const u = await newUser();
      await expect(addFlow(u, "2026-01-05", -150.01)).rejects.toMatchObject(NT001);
      await addFlow(u, "2026-01-05", -150);
    });
    it("el orden por hora decide: perder antes de ganar es inválido, ganar antes es válido", async () => {
      const u = await newUser(); await addTrade(u, "2026-02-02", 100, "10:00");
      await expect(addTrade(u, "2026-02-02", -200, "09:00")).rejects.toMatchObject(NT001); // pérdida primero: 150-200 < 0
      await addTrade(u, "2026-02-02", -200, "11:00"); // 250-200 = 50
      expect(await violation(u)).toBeNull();
    });
    it("los flujos del día se aplican antes de las operaciones del día", async () => {
      const u = await newUser(); await addFlow(u, "2026-02-02", 100);
      await addTrade(u, "2026-02-02", -240, "08:00");
    });
  });

  describe("correcciones históricas: edición y eliminación que afectan al historial posterior", () => {
    async function seed() {
      const u = await newUser(); // 150
      const dep = (await addFlow(u, "2026-03-01", 100)).rows[0].id; // 250
      const t1 = (await addTrade(u, "2026-03-02", 100)).rows[0].id; // 350
      const t2 = (await addTrade(u, "2026-03-03", -340)).rows[0].id; // 10
      return { u, dep, t1, t2 };
    }
    it("bajar una operación anterior que deja inválidas las posteriores se rechaza", async () => {
      const { u, t1 } = await seed();
      await expect(q(u, "update public.trades set net_result=-50 where id=$1", [t1])).rejects.toMatchObject(NT001);
      await q(u, "update public.trades set net_result=120 where id=$1", [t1]); // sube: válido
      expect(await violation(u)).toBeNull();
    });
    it("eliminar una ganancia anterior o un depósito del que dependen pérdidas posteriores se rechaza", async () => {
      const { u, t1, dep } = await seed();
      await expect(q(u, "delete from public.trades where id=$1", [t1])).rejects.toMatchObject(NT001);
      await expect(q(u, "delete from public.cash_flows where id=$1", [dep])).rejects.toMatchObject(NT001);
    });
    it("eliminar primero la pérdida posterior sí permite luego eliminar lo anterior", async () => {
      const { u, t1, t2, dep } = await seed();
      await q(u, "delete from public.trades where id=$1", [t2]);
      await q(u, "delete from public.trades where id=$1", [t1]);
      await q(u, "delete from public.cash_flows where id=$1", [dep]);
      expect(await violation(u)).toBeNull();
    });
    it("mover una operación de fecha puede invalidar el historial; y se valida", async () => {
      const { u, t1 } = await seed();
      await expect(q(u, "update public.trades set trade_date='2026-03-10' where id=$1", [t1])).rejects.toMatchObject(NT001); // la pérdida pasa a ir antes
    });
    it("cambiar solo las notas siempre es válido", async () => {
      const { u, t1 } = await seed();
      await q(u, "update public.trades set notes='nota' where id=$1", [t1]);
    });
    it("el capital inicial no puede bajar a un valor que invalide el historial; subir es válido", async () => {
      const { u } = await seed();
      await expect(q(u, "update public.settings set initial_capital=0")).rejects.toMatchObject(NT001);
      await q(u, "update public.settings set initial_capital=500");
      await expect(q(u, "update public.settings set initial_capital=-1")).rejects.toMatchObject({ code: "23514" }); // lo frena antes el CHECK de la tabla
    });
    it("una transacción de varias sentencias que termina inválida se revierte completa", async () => {
      const { u } = await seed();
      await expect(asUser(u, async (c) => {
        await c.query("insert into public.cash_flows (flow_date, amount) values ('2026-03-20', 10)");
        await c.query("insert into public.cash_flows (flow_date, amount) values ('2026-03-21', -9999)");
      })).rejects.toMatchObject(NT001);
      expect((await q(u, "select count(*)::int n from public.cash_flows")).rows[0].n).toBe(1);
    });
  });

  describe("concurrencia", () => {
    const parallel = async <T>(u: string, jobs: ((c: Client) => Promise<T>)[]) => {
      const clients = await Promise.all(jobs.map(connect));
      const res = await Promise.allSettled(jobs.map((j, i) => asUser(u, j, clients[i])));
      await Promise.all(clients.map((c) => c.end()));
      return res;
    };
    const ok = (r: PromiseSettledResult<unknown>[]) => r.filter((x) => x.status === "fulfilled").length;

    it("8 retiros simultáneos de $100 con capital $150 → exactamente 1 éxito, capital final ≥ 0", async () => {
      const u = await newUser();
      const r = await parallel(u, Array.from({ length: 8 }, (_, i) => (c: Client) => c.query("insert into public.cash_flows (flow_date, amount) values ($1,-100)", [`2026-04-${String(i + 1).padStart(2, "0")}`])));
      expect(ok(r)).toBe(1);
      expect((r.filter((x) => x.status === "rejected") as PromiseRejectedResult[]).every((x) => x.reason.code === "NT001")).toBe(true);
      expect(await violation(u)).toBeNull();
    });
    it("8 pérdidas simultáneas de $100 en fechas distintas con capital $150 → exactamente 1", async () => {
      const u = await newUser();
      const r = await parallel(u, Array.from({ length: 8 }, (_, i) => (c: Client) => c.query("insert into public.trades (trade_date, net_result) values ($1,-100)", [`2026-04-${String(i + 1).padStart(2, "0")}`])));
      expect(ok(r)).toBe(1);
      expect(await violation(u)).toBeNull();
    });
    it("carrera eliminar-depósito vs insertar-pérdida-que-depende-de-él (10 rondas) → nunca ambos", async () => {
      for (let round = 0; round < 10; round++) {
        const u = await newUser();
        const dep = (await addFlow(u, "2026-05-01", 100)).rows[0].id; // 250
        const r = await parallel(u, [
          (c) => c.query("delete from public.cash_flows where id=$1", [dep]),
          (c) => c.query("insert into public.trades (trade_date, net_result) values ('2026-05-02', -200)"),
        ]);
        expect(ok(r)).toBe(1);
        expect(await violation(u)).toBeNull();
      }
    });
    it("carrera editar-histórico vs insertar-posterior (10 rondas) → el resultado final siempre es válido", async () => {
      for (let round = 0; round < 10; round++) {
        const u = await newUser();
        const t1 = (await addTrade(u, "2026-05-01", 100)).rows[0].id; // 250
        const r = await parallel(u, [
          (c) => c.query("update public.trades set net_result=-100 where id=$1", [t1]), // válido solo (50)
          (c) => c.query("insert into public.trades (trade_date, net_result) values ('2026-05-02', -240)"), // válido solo (10)
        ]);
        expect(ok(r)).toBe(1);
        expect(await violation(u)).toBeNull();
      }
    });
    it("20 operaciones mixtas aleatorias simultáneas: el estado final es siempre válido", async () => {
      for (let round = 0; round < 5; round++) {
        const u = await newUser(150, null);
        const jobs = Array.from({ length: 20 }, (_, i) => (c: Client) => i % 3 === 0
          ? c.query("insert into public.cash_flows (flow_date, amount) values ($1,$2)", [`2026-06-${String((i % 7) + 1).padStart(2, "0")}`, (i % 2 ? -1 : 1) * (20 + i * 7)])
          : c.query("insert into public.trades (trade_date, net_result, trade_time) values ($1,$2,$3)", [`2026-06-${String((i % 7) + 1).padStart(2, "0")}`, (i % 2 ? -1 : 1) * (10 + i * 9), `${String(8 + (i % 10)).padStart(2, "0")}:00`]));
        const r = await parallel(u, jobs);
        expect(ok(r)).toBeGreaterThan(0);
        expect((r.filter((x) => x.status === "rejected") as PromiseRejectedResult[]).every((x) => x.reason.code === "NT001")).toBe(true);
        expect(await violation(u)).toBeNull();
      }
    });
    it("el límite diario sigue protegido con el bloqueo por usuario (12 simultáneas → 1)", async () => {
      const u = await newUser(150, 1);
      const r = await parallel(u, Array.from({ length: 12 }, () => (c: Client) => c.query("insert into public.trades (trade_date, net_result) values ('2026-07-01', 1)")));
      expect(ok(r)).toBe(1);
    });
  });

  describe("paridad SQL ↔ TypeScript (validateTimeline) con 400 escenarios aleatorios, incluidos inválidos", () => {
    let seed = 20261019; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    it("misma infracción (tipo, fecha y operación) o ambas válidas", async () => {
      let invalid = 0;
      for (let n = 0; n < 400; n++) {
        const initial = ri(0, 30000); // centavos
        const dates = Array.from({ length: 6 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
        const trades: Trade[] = Array.from({ length: ri(0, 10) }, () => ({
          id: randomUUID(), date: dates[ri(0, 5)], netCents: ri(-9000, 12000) * (rnd() < 0.1 ? 0 : 1),
          time: rnd() < 0.4 ? null : `${String(ri(0, 23)).padStart(2, "0")}:${String(ri(0, 59)).padStart(2, "0")}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, ri(0, 4))).toISOString(),
        }));
        const flows: CashFlow[] = Array.from({ length: ri(0, 4) }, () => ({ id: randomUUID(), date: dates[ri(0, 5)], amountCents: (rnd() < 0.5 ? -1 : 1) * ri(1, 15000) }));
        const ts = validateTimeline(trades, flows, { initialCapitalCents: initial, riskPct: 3 });
        const uid = randomUUID();
        await admin2.query("begin");
        try {
          await admin2.query("set local session_replication_role = replica"); // sin triggers: permite insertar escenarios inválidos
          await admin2.query("insert into auth.users (id,email) values ($1,$2)", [uid, uid + "@t.local"]);
          await admin2.query("insert into public.settings (user_id, initial_capital) values ($1,$2)", [uid, (initial / 100).toFixed(2)]);
          for (const t of trades) await admin2.query("insert into public.trades (id,user_id,trade_date,trade_time,net_result,created_at) values ($1,$2,$3,$4,$5,$6)", [t.id, uid, t.date, t.time, (t.netCents / 100).toFixed(2), t.createdAt]);
          for (const f of flows) await admin2.query("insert into public.cash_flows (id,user_id,flow_date,amount) values ($1,$2,$3,$4)", [f.id, uid, f.date, (f.amountCents / 100).toFixed(2)]);
          const sqlV = (await admin2.query("select kind, vdate::text d, trade_id from public.ledger_first_violation($1)", [uid])).rows[0] ?? null;
          if (ts) { invalid++; expect(sqlV, `escenario ${n}`).not.toBeNull(); expect(sqlV.kind, `escenario ${n}`).toBe(ts.kind); expect(sqlV.d ?? null, `escenario ${n}`).toBe(ts.date || null); expect(sqlV.trade_id ?? undefined, `escenario ${n}`).toBe(ts.tradeId); }
          else expect(sqlV, `escenario ${n}`).toBeNull();
        } finally { await admin2.query("rollback"); }
      }
      expect(invalid).toBeGreaterThan(40); // el generador sí produce casos inválidos
      expect(invalid).toBeLessThan(380);   // y también válidos
    }, 120000);
  });
});
