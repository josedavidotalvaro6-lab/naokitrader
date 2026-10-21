import { describe, it, expect } from "vitest";
import { friendlyDbError } from "../lib/dberrors";
import { analyze, compareTrades, toCents } from "../lib/finance/core";

describe("mensajes de error de base de datos", () => {
  it("NT001 (capital negativo)", () => expect(friendlyDbError({ code: "NT001", message: "LEDGER: negative_capital el 2026-01-05" })).toContain("capital negativo"));
  it("no_capital_to_trade", () => expect(friendlyDbError({ code: "NT001", message: "LEDGER: no_capital_to_trade el 2026-01-05" })).toContain("no hay capital"));
  it("límite diario P0001", () => expect(friendlyDbError({ code: "P0001", message: "Límite diario de operaciones alcanzado para 2026-01-05" })).toContain("máximo"));
  it("RLS 42501 y CHECK 23514", () => { expect(friendlyDbError({ code: "42501", message: "x" })).toContain("permiso"); expect(friendlyDbError({ code: "23514", message: "x" })).toContain("rango"); });
  it("error desconocido conserva el mensaje", () => expect(friendlyDbError({ message: "boom" })).toContain("boom"));
});

describe("orden determinista independiente del locale (debe coincidir con la base de datos)", () => {
  const T = (id: string) => ({ id, date: "2026-01-01", netCents: 0, time: null, createdAt: "2026-01-01T00:00:00.000Z" });
  it("desempate por id en orden de unidades de código", () => {
    const ids = ["b0000000", "A0000000", "a0000000", "00000000", "9f000000"];
    expect(ids.map(T).sort(compareTrades).map((t) => t.id)).toEqual([...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  });
  it("la métrica no depende del orden de entrada con empates totales", () => {
    const ts = [T("c"), T("a"), T("b")].map((t, i) => ({ ...t, netCents: toCents(i - 1) }));
    const a = analyze(ts, [], { initialCapitalCents: 15000, riskPct: 3 }).rows.map((r) => r.id);
    const b = analyze([...ts].reverse(), [], { initialCapitalCents: 15000, riskPct: 3 }).rows.map((r) => r.id);
    expect(a).toEqual(b);
  });
});
