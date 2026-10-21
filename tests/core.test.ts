import { describe, it, expect } from "vitest";
import { analyze, plannedRiskCents, statusOf, toCents, daysWithoutTrading, canAddTrade, firstNegativeCapitalDate, type Trade, type CashFlow } from "../lib/finance/core";

const S = { initialCapitalCents: 15000, riskPct: 3 };
const T = (id: string, date: string, usd: number): Trade => ({ id, date, netCents: toCents(usd) });
const F = (id: string, date: string, usd: number): CashFlow => ({ id, date, amountCents: toCents(usd) });

describe("capital y riesgo", () => {
  it("riesgo inicial de $4,50 sobre $150 al 3%", () => {
    expect(plannedRiskCents(15000, 3)).toBe(450);
  });
  it("capital = inicial + resultados; riesgo planificado usa capital al inicio de cada operación", () => {
    const a = analyze([T("a", "2026-01-05", 10), T("b", "2026-01-06", -5)], [], S);
    expect(a.metrics.currentCents).toBe(15500);
    expect(a.rows[0].plannedRiskCents).toBe(450);
    expect(a.rows[1].capitalBeforeCents).toBe(16000);
    expect(a.rows[1].plannedRiskCents).toBe(480);
  });
  it("el riesgo planificado no es la pérdida real", () => {
    const a = analyze([T("a", "2026-01-05", -1.2)], [], S);
    expect(a.rows[0].plannedRiskCents).toBe(450);
    expect(a.metrics.pnlCents).toBe(-120);
  });
});

describe("estados y métricas", () => {
  it("cero es breakeven y cuenta como operación, no como ganada", () => {
    expect(statusOf(0)).toBe("breakeven");
    const a = analyze([T("a", "2026-01-05", 5), T("b", "2026-01-06", 0), T("c", "2026-01-07", -2), T("d", "2026-01-08", 3)], [], S);
    expect(a.metrics.trades).toBe(4);
    expect(a.metrics.wins).toBe(2);
    expect(a.metrics.breakevens).toBe(1);
    expect(a.metrics.winRate).toBe(0.5);
  });
  it("sin datos devuelve N/D (null)", () => {
    const a = analyze([], [], S);
    expect(a.metrics.winRate).toBeNull();
    expect(a.metrics.returnTwr).toBeNull();
    expect(a.metrics.maxDrawdown).toBeNull();
    expect(a.metrics.currentCents).toBe(15000);
  });
  it("días sin operar no son operaciones", () => {
    const ts = [T("a", "2026-01-05", 5), T("b", "2026-01-07", 5)];
    expect(analyze(ts, [], S).metrics.trades).toBe(2);
    expect(daysWithoutTrading(ts, "2026-01-05", "2026-01-09")).toBe(3);
    expect(daysWithoutTrading(ts, "2026-01-03", "2026-01-09", true)).toBe(3); // sáb/dom excluidos
  });
});

describe("rentabilidad y drawdown", () => {
  it("TWR encadena retornos diarios", () => {
    const a = analyze([T("a", "2026-01-05", 15), T("b", "2026-01-06", -16.5)], [], S); // +10%, -10%
    expect(a.metrics.returnTwr).toBeCloseTo(1.1 * 0.9 - 1, 10);
  });
  it("drawdown y recuperación", () => {
    const a = analyze([T("a", "2026-01-05", 15), T("b", "2026-01-06", -33), T("c", "2026-01-07", 100)], [], S);
    // 150 -> 165 (pico) -> 132 : dd 20%
    expect(a.days[1].drawdown).toBeCloseTo(0.2, 10);
    expect(a.metrics.maxDrawdown).toBeCloseTo(0.2, 10);
    expect(a.metrics.currentDrawdown).toBe(0); // 232 supera el pico
  });
});

describe("depósitos y retiros", () => {
  it("un depósito cambia el capital pero no la rentabilidad", () => {
    const a = analyze([T("a", "2026-01-05", 15)], [F("f", "2026-01-04", 150)], S);
    expect(a.metrics.currentCents).toBe(31500 - 0 + 0); // 150+150+15
    expect(a.metrics.netFlowsCents).toBe(15000);
    expect(a.metrics.returnTwr).toBeCloseTo(15 / 300, 10);
  });
  it("un retiro no se confunde con drawdown", () => {
    const a = analyze([T("a", "2026-01-05", 15), T("b", "2026-01-07", 0)], [F("w", "2026-01-06", -100)], S);
    expect(a.metrics.maxDrawdown).toBe(0);
    expect(a.metrics.currentCents).toBe(6500);
  });
  it("detecta retiro que deja capital negativo", () => {
    expect(firstNegativeCapitalDate([], [F("w", "2026-01-06", -200)], S)).toBe("2026-01-06");
  });
});

describe("correcciones históricas y límite diario", () => {
  it("editar un registro pasado recalcula toda la cadena", () => {
    const base = [T("a", "2026-01-05", 10), T("b", "2026-01-06", 10)];
    const before = analyze(base, [], S);
    const edited = analyze([T("a", "2026-01-05", -10), base[1]], [], S);
    expect(before.metrics.currentCents).toBe(17000);
    expect(edited.metrics.currentCents).toBe(15000);
    expect(edited.rows[1].capitalBeforeCents).toBe(14000);
  });
  it("bloquea doble registro diario pero permite corregir el existente", () => {
    const ex = [T("a", "2026-01-05", 5)];
    expect(canAddTrade(ex, "2026-01-05", 1)).toBe(false);
    expect(canAddTrade(ex, "2026-01-05", 1, "a")).toBe(true);
    expect(canAddTrade(ex, "2026-01-06", 1)).toBe(true);
    expect(canAddTrade(ex, "2026-01-05", null)).toBe(true);
  });
  it("el orden de entrada no altera el resultado", () => {
    const ts = [T("b", "2026-01-06", -4), T("a", "2026-01-05", 7)];
    expect(analyze(ts, [], S).metrics.currentCents).toBe(15300);
  });
});
