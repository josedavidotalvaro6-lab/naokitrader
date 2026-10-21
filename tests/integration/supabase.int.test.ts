/**
 * Prueba de integración contra un proyecto Supabase REAL (de desarrollo, NO producción).
 * Se OMITE si faltan SUPABASE_TEST_URL y SUPABASE_TEST_ANON_KEY. Solo usa la anon key (pública).
 * Requisitos en el proyecto de prueba: migraciones 0001 y 0002 aplicadas y "Confirm email" DESACTIVADO
 * (si no, signUp no devuelve sesión y la prueba falla con un mensaje explícito).
 * Cada ejecución crea 2 usuarios nuevos (correos aleatorios); sin service_role no se pueden borrar desde aquí:
 * elimínalos luego en Authentication → Users.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_TEST_URL; const KEY = process.env.SUPABASE_TEST_ANON_KEY;
const mk = () => createClient(URL_!, KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const run = Math.random().toString(36).slice(2, 8);
const cred = (n: string) => ({ email: `naoki.${n}.${run}@example.com`, password: `Pw-${run}-${n}-9!` });
let a: SupabaseClient; let b: SupabaseClient; let aId = ""; let bId = "";

describe.skipIf(!URL_ || !KEY)("Supabase real: registro, login, persistencia, RLS y límite diario", () => {
  beforeAll(async () => {
    a = mk(); b = mk();
    for (const [c, n] of [[a, "a"], [b, "b"]] as const) {
      const r = await c.auth.signUp(cred(n));
      if (r.error) throw new Error("signUp falló: " + r.error.message);
      if (!r.data.session) throw new Error("signUp no devolvió sesión: desactiva 'Confirm email' en el proyecto de pruebas.");
    }
    aId = (await a.auth.getUser()).data.user!.id; bId = (await b.auth.getUser()).data.user!.id;
  });

  it("registro e inicio de sesión con contraseña", async () => {
    const c = mk(); const r = await c.auth.signInWithPassword(cred("a"));
    expect(r.error).toBeNull(); expect(r.data.user?.id).toBe(aId);
    const bad = await mk().auth.signInWithPassword({ ...cred("a"), password: "incorrecta-123" });
    expect(bad.error).not.toBeNull();
  });
  it("settings por defecto creadas por el trigger de alta", async () => {
    const r = await a.from("settings").select("initial_capital,risk_pct,max_trades_per_day").single();
    expect(r.error).toBeNull(); expect(Number(r.data!.initial_capital)).toBe(150); expect(Number(r.data!.risk_pct)).toBe(3); expect(r.data!.max_trades_per_day).toBe(1);
  });
  it("persistencia: lo guardado se recupera con una sesión nueva", async () => {
    const ins = await a.from("trades").insert({ trade_date: "2026-02-01", net_result: 7.85, notes: "int-test" });
    expect(ins.error).toBeNull();
    const fresh = mk(); await fresh.auth.signInWithPassword(cred("a"));
    const r = await fresh.from("trades").select("trade_date,net_result,status,notes");
    expect(r.error).toBeNull(); expect(r.data).toHaveLength(1);
    expect(r.data![0]).toMatchObject({ trade_date: "2026-02-01", status: "win", notes: "int-test" });
    expect(Number(r.data![0].net_result)).toBe(7.85);
  });
  it("aislamiento RLS entre dos usuarios", async () => {
    expect((await b.from("trades").select("id")).data).toHaveLength(0);
    const upd = await b.from("trades").update({ net_result: 999 }).eq("notes", "int-test").select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await b.from("trades").delete().eq("notes", "int-test").select();
    expect(del.data ?? []).toHaveLength(0);
    const forged = await b.from("trades").insert({ user_id: aId, trade_date: "2026-03-01", net_result: 1 });
    expect(forged.error).not.toBeNull();
    expect((await b.from("settings").select("user_id").eq("user_id", aId)).data).toHaveLength(0);
    expect((await a.from("trades").select("net_result")).data).toHaveLength(1); // intacto
    expect(bId).not.toBe(aId);
  });
  it("sin sesión (anon) no se leen datos", async () => {
    const r = await mk().from("trades").select("id");
    expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
  });
  it("límite diario: el segundo registro del día se rechaza; corregir el existente funciona", async () => {
    const dup = await a.from("trades").insert({ trade_date: "2026-02-01", net_result: 1 });
    expect(dup.error).not.toBeNull();
    const fix = await a.from("trades").update({ net_result: 8 }).eq("trade_date", "2026-02-01").select();
    expect(fix.error).toBeNull(); expect(fix.data).toHaveLength(1);
  });
  it("límite diario concurrente: 10 inserciones simultáneas → exactamente 1", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, () => a.from("trades").insert({ trade_date: "2026-04-10", net_result: 1 })));
    expect(rs.filter((r) => !r.error)).toHaveLength(1);
    expect((await a.from("trades").select("id").eq("trade_date", "2026-04-10")).data).toHaveLength(1);
  });
});

// ---- Integridad del libro mayor (migración 0003) a través de PostgREST ----
describe.skipIf(!URL_ || !KEY)("Supabase real: integridad del capital (0003)", () => {
  let c: SupabaseClient;
  beforeAll(async () => {
    c = mk(); const r = await c.auth.signUp({ email: `naoki.ledger.${run}@example.com`, password: `Pw-${run}-L-9!` });
    if (r.error || !r.data.session) throw new Error("signUp falló o requiere confirmación de correo: " + (r.error?.message ?? "sin sesión"));
  });
  it("rechaza retiro y pérdida mayores que el capital (150)", async () => {
    expect((await c.from("cash_flows").insert({ flow_date: "2026-05-01", amount: -151 })).error?.code).toBe("NT001");
    expect((await c.from("trades").insert({ trade_date: "2026-05-01", net_result: -150.01 })).error?.code).toBe("NT001");
  });
  it("correcciones históricas: no se puede borrar un depósito del que dependen pérdidas posteriores", async () => {
    const dep = await c.from("cash_flows").insert({ flow_date: "2026-05-02", amount: 100 }).select("id").single(); expect(dep.error).toBeNull();
    expect((await c.from("trades").insert({ trade_date: "2026-05-03", net_result: -240 })).error).toBeNull(); // 250-240
    expect((await c.from("cash_flows").delete().eq("id", dep.data!.id)).error?.code).toBe("NT001");
    expect((await c.from("settings").update({ initial_capital: 0 }).gt("risk_pct", 0)).error?.code).toBe("NT001");
  });
  it("concurrencia: 6 retiros simultáneos de $5 con capital disponible $10 → exactamente 2 éxitos", async () => {
    const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => c.from("cash_flows").insert({ flow_date: `2026-06-${String(i + 1).padStart(2, "0")}`, amount: -5 })));
    expect(rs.filter((r) => !r.error)).toHaveLength(2);
    expect(rs.filter((r) => r.error).every((r) => r.error!.code === "NT001")).toBe(true);
  });
});
