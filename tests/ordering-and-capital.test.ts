import { describe, it, expect } from "vitest";
import { analyze, validateTimeline, describeViolation, toCents, type Trade, type CashFlow } from "../lib/finance/core";

const S = { initialCapitalCents: 15000, riskPct: 3 };
const T = (id: string, date: string, usd: number, time?: string | null, createdAt?: string | null): Trade => ({ id, date, netCents: toCents(usd), time, createdAt });
const F = (id: string, date: string, usd: number): CashFlow => ({ id, date, amountCents: toCents(usd) });

describe("varias operaciones en la misma fecha", () => {
  it("ordena por hora de ejecución, sin importar el orden de entrada ni el id", () => {
    const a = analyze([T("a", "2026-03-02", 10, "15:00"), T("b", "2026-03-02", -5, "09:00")], [], S);
    expect(a.rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(a.rows[0].capitalBeforeCents).toBe(15000);
    expect(a.rows[0].plannedRiskCents).toBe(450);
    expect(a.rows[1].capitalBeforeCents).toBe(14500); // 150 - 5
    expect(a.rows[1].plannedRiskCents).toBe(435); // 3% de 145.00
  });
  it("acepta HH:MM y HH:MM:SS como equivalentes", () => {
    const a = analyze([T("a", "2026-03-02", 1, "09:30:30"), T("b", "2026-03-02", 1, "09:30")], [], S);
    expect(a.rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("sin hora: van después de las que tienen hora y se ordenan por creación, luego por id", () => {
    const a = analyze(
      [T("z", "2026-03-02", 1, null, "2026-03-02T10:00:00Z"), T("y", "2026-03-02", 1, null, "2026-03-02T09:00:00Z"), T("w", "2026-03-02", 1, "23:59"), T("x", "2026-03-02", 1, null, "2026-03-02T09:00:00Z")],
      [], S);
    expect(a.rows.map((r) => r.id)).toEqual(["w", "x", "y", "z"]);
  });
  it("el resultado es idéntico en cualquier permutación de entrada", () => {
    const ts = [T("a", "2026-03-02", 7, "10:00"), T("b", "2026-03-02", -3, "11:00"), T("c", "2026-03-02", 2, "12:00")];
    const base = analyze(ts, [], S).rows.map((r) => [r.id, r.capitalBeforeCents, r.plannedRiskCents]);
    for (const p of [[2, 0, 1], [1, 2, 0], [2, 1, 0]]) expect(analyze(p.map((i) => ts[i]), [], S).rows.map((r) => [r.id, r.capitalBeforeCents, r.plannedRiskCents])).toEqual(base);
  });
  it("encadena el riesgo: cada operación usa el capital tras la anterior", () => {
    const a = analyze([T("a", "2026-03-02", 50, "09:00"), T("b", "2026-03-02", 0, "10:00"), T("c", "2026-03-02", -20, "11:00")], [], S);
    expect(a.rows.map((r) => r.capitalBeforeCents)).toEqual([15000, 20000, 20000]);
    expect(a.rows.map((r) => r.plannedRiskCents)).toEqual([450, 600, 600]);
    expect(a.metrics.currentCents).toBe(18000);
  });
  it("los flujos del día se aplican antes de la primera operación del día", () => {
    const a = analyze([T("a", "2026-03-02", 10, "09:00")], [F("f", "2026-03-02", 150)], S);
    expect(a.rows[0].capitalBeforeCents).toBe(30000);
    expect(a.rows[0].plannedRiskCents).toBe(900);
  });
  it("el retorno del día equivale a final/inicio aunque haya varias operaciones", () => {
    const a = analyze([T("a", "2026-03-02", 15, "09:00"), T("b", "2026-03-02", -16.5, "10:00")], [], S);
    expect(a.metrics.returnTwr).toBeCloseTo(a.days[0].endCents / a.days[0].startCents - 1, 12);
  });
  it("el drawdown intradía cuenta aunque el día cierre en máximo", () => {
    const a = analyze([T("a", "2026-03-02", -30, "09:00"), T("b", "2026-03-02", 60, "10:00")], [], S);
    expect(a.metrics.maxDrawdown).toBeCloseTo(0.2, 10);
    expect(a.metrics.currentDrawdown).toBe(0);
  });
});

describe("capital negativo", () => {
  it("rechaza una pérdida mayor que el capital disponible", () => {
    const v = validateTimeline([T("a", "2026-03-02", -150.01)], [], S);
    expect(v?.kind).toBe("negative_capital");
    expect(v?.tradeId).toBe("a");
    expect(v?.capitalBeforeCents).toBe(15000);
  });
  it("permite perder exactamente todo el capital (queda en 0)", () => {
    expect(validateTimeline([T("a", "2026-03-02", -150)], [], S)).toBeNull();
  });
  it("con capital 0 rechaza ganancias/pérdidas pero permite breakeven y depósitos", () => {
    const base = [T("a", "2026-03-02", -150, "09:00")];
    expect(validateTimeline([...base, T("b", "2026-03-03", 5)], [], S)?.kind).toBe("no_capital_to_trade");
    expect(validateTimeline([...base, T("b", "2026-03-03", -5)], [], S)?.kind).toBe("no_capital_to_trade");
    expect(validateTimeline([...base, T("b", "2026-03-03", 0)], [], S)).toBeNull();
    expect(validateTimeline([...base, T("b", "2026-03-03", 5)], [F("d", "2026-03-03", 100)], S)).toBeNull();
  });
  it("el orden intradía importa: perder antes de ganar puede ser inválido, ganar antes es válido", () => {
    expect(validateTimeline([T("a", "2026-03-02", -200, "09:00"), T("b", "2026-03-02", 100, "10:00")], [], S)?.tradeId).toBe("a");
    expect(validateTimeline([T("a", "2026-03-02", 100, "09:00"), T("b", "2026-03-02", -200, "10:00")], [], S)).toBeNull();
  });
  it("un retiro mayor que el capital es inválido; uno igual al capital es válido", () => {
    expect(validateTimeline([], [F("w", "2026-03-02", -150.01)], S)?.kind).toBe("negative_capital");
    expect(validateTimeline([], [F("w", "2026-03-02", -150)], S)).toBeNull();
  });
  it("eliminar un depósito que financiaba pérdidas posteriores se detecta", () => {
    const ts = [T("a", "2026-03-03", -200)];
    const dep = F("d", "2026-03-02", 100);
    expect(validateTimeline(ts, [dep], S)).toBeNull();
    expect(validateTimeline(ts, [], S)?.tradeId).toBe("a");
  });
  it("corregir al alza/baja una operación histórica puede invalidar las posteriores", () => {
    const ok = [T("a", "2026-03-02", 100), T("b", "2026-03-03", -240)];
    expect(validateTimeline(ok, [], S)).toBeNull();
    const edited = [T("a", "2026-03-02", -50), ok[1]];
    expect(validateTimeline(edited, [], S)?.tradeId).toBe("b");
    expect(validateTimeline(ok.filter((t) => t.id !== "a"), [], S)?.tradeId).toBe("b"); // eliminar a
  });
  it("capital inicial negativo es inválido", () => {
    expect(validateTimeline([], [], { ...S, initialCapitalCents: -1 })?.kind).toBe("negative_capital");
  });
  it("sin infracciones devuelve null y describeViolation da un mensaje útil", () => {
    expect(validateTimeline([T("a", "2026-03-02", 5)], [], S)).toBeNull();
    const v = validateTimeline([T("a", "2026-03-02", -999)], [], S)!;
    expect(describeViolation(v)).toContain("2026-03-02");
  });
  it("no produce NaN/Infinity en métricas cuando el capital llega a 0", () => {
    const a = analyze([T("a", "2026-03-02", -150), T("b", "2026-03-03", 0)], [], S);
    for (const v of [a.metrics.returnTwr, a.metrics.maxDrawdown, a.metrics.currentDrawdown, a.metrics.winRate]) expect(Number.isFinite(v)).toBe(true);
    expect(a.metrics.maxDrawdown).toBeCloseTo(1, 10);
  });
});
