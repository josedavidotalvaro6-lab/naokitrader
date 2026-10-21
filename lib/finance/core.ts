/**
 * Núcleo financiero de NaokiTrader. Sin dependencias de UI ni de base de datos.
 * Todo el dinero se maneja en CENTAVOS enteros para evitar errores de coma flotante.
 *
 * Reglas:
 * - Los flujos externos (depósitos/retiros) de un día se aplican ANTES de la operación de ese día.
 * - Riesgo planificado = capital al inicio de la operación (tras flujos del día) × riesgo%.
 * - Rentabilidad = rentabilidad ponderada por tiempo (TWR): encadena P&L diario / capital de inicio.
 *   Los depósitos y retiros NO cuentan como rendimiento.
 * - Drawdown = caída del índice de crecimiento (TWR) respecto a su máximo histórico,
 *   por lo que un retiro no se confunde con una pérdida.
 * - Días sin operar no generan operaciones ni afectan el win rate.
 * - Resultado 0 => breakeven (cuenta como operación, no como ganadora).
 *
 * Orden de operaciones dentro de un mismo día (determinista):
 *   1) hora de ejecución (HH:MM[:SS], hora local America/Bogota); las que no tienen hora van después de las que sí;
 *   2) fecha/hora de creación del registro;
 *   3) id (desempate final).
 *
 * Capital negativo (regla de validación, no se permite guardar):
 *   - un retiro, o un cambio de capital inicial, no puede dejar el capital < 0;
 *   - una operación no puede dejar el capital < 0 (la pérdida máxima registrable es el capital disponible);
 *   - con capital 0 solo se admiten depósitos y operaciones con resultado 0.
 *   `analyze` devuelve `violation` con la primera infracción en orden cronológico.
 */

export type Trade = { id: string; date: string; netCents: number; time?: string | null; createdAt?: string | null };
export type CashFlow = { id: string; date: string; amountCents: number }; // + depósito, - retiro
export type Settings = { initialCapitalCents: number; riskPct: number };

export type TradeStatus = "win" | "loss" | "breakeven";

export const toCents = (usd: number): number => Math.round(usd * 100);
export const fromCents = (c: number): number => c / 100;

export function statusOf(netCents: number): TradeStatus {
  return netCents > 0 ? "win" : netCents < 0 ? "loss" : "breakeven";
}

export function plannedRiskCents(capitalCents: number, riskPct: number): number {
  return Math.round((capitalCents * riskPct) / 100);
}

export type DayPoint = {
  date: string;
  startCents: number; // capital tras flujos del día, antes de operar
  flowCents: number;
  pnlCents: number;
  endCents: number;
  trades: number;
  index: number; // índice de crecimiento TWR (base 1)
  drawdown: number; // fracción >= 0 respecto al máximo del índice
};

export type TradeRow = Trade & {
  status: TradeStatus;
  capitalBeforeCents: number;
  plannedRiskCents: number;
};

export type Metrics = {
  initialCents: number;
  currentCents: number;
  pnlCents: number;
  netFlowsCents: number;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  returnTwr: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  tradingDays: number;
};

export type Violation = {
  kind: "negative_capital" | "no_capital_to_trade";
  date: string;
  tradeId?: string;
  capitalBeforeCents: number;
  attemptedCents: number; // resultado de la operación o flujo que causó la infracción
};

export type Analysis = {
  days: DayPoint[];
  rows: TradeRow[];
  metrics: Metrics;
  violation: Violation | null;
};

const normTime = (t?: string | null) => (t ? (t.length === 5 ? t + ":00" : t.slice(0, 8)) : "99:99:99");

/** Orden determinista de operaciones (ver cabecera del archivo). */
const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0); // por unidad de código: igual en cualquier locale
export function compareTrades(a: Trade, b: Trade): number {
  return cmp(a.date, b.date) || cmp(normTime(a.time), normTime(b.time)) || cmp(a.createdAt ?? "", b.createdAt ?? "") || cmp(a.id, b.id);
}

export function analyze(trades: Trade[], flows: CashFlow[], s: Settings): Analysis {
  const dates = Array.from(new Set([...trades.map((t) => t.date), ...flows.map((f) => f.date)])).sort();
  const days: DayPoint[] = [];
  const rows: TradeRow[] = [];
  let capital = s.initialCapitalCents;
  let index = 1;
  let peak = 1;
  let maxDd = 0;
  let violation: Violation | null = null;

  if (capital < 0) violation = { kind: "negative_capital", date: dates[0] ?? "", capitalBeforeCents: capital, attemptedCents: capital };

  for (const date of dates) {
    const dayFlows = flows.filter((f) => f.date === date);
    const dayTrades = trades.filter((t) => t.date === date).sort(compareTrades);
    const flow = dayFlows.reduce((a, f) => a + f.amountCents, 0);
    const start = capital + flow;
    if (!violation && start < 0) violation = { kind: "negative_capital", date, capitalBeforeCents: capital, attemptedCents: flow };
    let running = start;
    for (const t of dayTrades) {
      if (!violation && t.netCents !== 0) {
        if (running <= 0) violation = { kind: "no_capital_to_trade", date, tradeId: t.id, capitalBeforeCents: running, attemptedCents: t.netCents };
        else if (running + t.netCents < 0) violation = { kind: "negative_capital", date, tradeId: t.id, capitalBeforeCents: running, attemptedCents: t.netCents };
      }
      rows.push({ ...t, status: statusOf(t.netCents), capitalBeforeCents: running, plannedRiskCents: plannedRiskCents(Math.max(running, 0), s.riskPct) });
      // Rentabilidad por operación; el producto de los retornos de un día equivale a final/inicio del día.
      if (running > 0) index *= 1 + t.netCents / running;
      running += t.netCents;
      peak = Math.max(peak, index);
      if (peak > 0) maxDd = Math.max(maxDd, (peak - index) / peak);
    }
    const dd = peak > 0 ? (peak - index) / peak : 0;
    capital = running;
    days.push({ date, startCents: start, flowCents: flow, pnlCents: running - start, endCents: running, trades: dayTrades.length, index, drawdown: dd });
  }

  const wins = rows.filter((r) => r.status === "win").length;
  const losses = rows.filter((r) => r.status === "loss").length;
  const breakevens = rows.filter((r) => r.status === "breakeven").length;
  const n = rows.length;

  const metrics: Metrics = {
    initialCents: s.initialCapitalCents,
    currentCents: capital,
    pnlCents: rows.reduce((a, r) => a + r.netCents, 0),
    netFlowsCents: flows.reduce((a, f) => a + f.amountCents, 0),
    trades: n,
    wins,
    losses,
    breakevens,
    winRate: n > 0 ? wins / n : null,
    returnTwr: n > 0 ? index - 1 : null,
    maxDrawdown: n > 0 ? maxDd : null,
    currentDrawdown: n > 0 ? (peak - index) / peak : null,
    tradingDays: new Set(rows.map((r) => r.date)).size,
  };
  return { days, rows, metrics, violation };
}

/** Días calendario sin operar entre dos fechas ISO (inclusive), excluyendo fines de semana si weekdaysOnly. */
export function daysWithoutTrading(trades: Trade[], from: string, to: string, weekdaysOnly = false): number {
  const traded = new Set(trades.map((t) => t.date));
  let count = 0;
  for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (weekdaysOnly && (wd === 0 || wd === 6)) continue;
    if (!traded.has(d.toISOString().slice(0, 10))) count++;
  }
  return count;
}

/** ¿Se puede agregar una operación en esa fecha dado el límite diario? Editar un registro existente se excluye con ignoreId. */
export function canAddTrade(existing: Trade[], date: string, maxPerDay: number | null, ignoreId?: string): boolean {
  if (maxPerDay === null) return true;
  return existing.filter((t) => t.date === date && t.id !== ignoreId).length < maxPerDay;
}

/** Primera infracción de capital negativo en la línea de tiempo (o null si es válida). */
export function validateTimeline(trades: Trade[], flows: CashFlow[], s: Settings): Violation | null {
  return analyze(trades, flows, s).violation;
}

export function describeViolation(v: Violation): string {
  const usd = (c: number) => (c < 0 ? "-" : "") + "$" + (Math.abs(c) / 100).toFixed(2);
  if (v.kind === "no_capital_to_trade") return `El ${v.date} el capital disponible es ${usd(v.capitalBeforeCents)}; no se puede registrar una operación con resultado distinto de 0. Registra antes un depósito.`;
  return v.tradeId
    ? `La operación del ${v.date} (${usd(v.attemptedCents)}) dejaría el capital negativo (capital previo ${usd(v.capitalBeforeCents)}). La pérdida máxima registrable es el capital disponible.`
    : `El cambio dejaría el capital negativo el ${v.date}.`;
}

/** Compatibilidad: fecha de la primera infracción de capital negativo, o null. */
export function firstNegativeCapitalDate(trades: Trade[], flows: CashFlow[], s: Settings): string | null {
  return validateTimeline(trades, flows, s)?.date ?? null;
}
