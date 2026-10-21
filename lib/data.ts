import { supabaseServer } from "@/lib/supabase/server";
import { analyze, toCents, type Trade, type CashFlow } from "@/lib/finance/core";

export type DbTrade = { id: string; trade_date: string; trade_time: string | null; created_at: string; net_result: number; status: string; notes: string | null };
export type DbFlow = { id: string; flow_date: string; amount: number; notes: string | null };
export type DbSettings = { initial_capital: number; risk_pct: number; max_trades_per_day: number | null; timezone: string };

export const todayBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export async function loadAll() {
  const sb = await supabaseServer();
  const [t, f, s] = await Promise.all([
    sb.from("trades").select("id,trade_date,trade_time,created_at,net_result,status,notes").order("trade_date", { ascending: false }),
    sb.from("cash_flows").select("id,flow_date,amount,notes").order("flow_date", { ascending: false }),
    sb.from("settings").select("initial_capital,risk_pct,max_trades_per_day,timezone").maybeSingle(),
  ]);
  const error = t.error?.message ?? f.error?.message ?? s.error?.message ?? null;
  const dbTrades = (t.data ?? []) as DbTrade[];
  const dbFlows = (f.data ?? []) as DbFlow[];
  const settings: DbSettings = (s.data as DbSettings | null) ?? { initial_capital: 150, risk_pct: 3, max_trades_per_day: 1, timezone: "America/Bogota" };
  const trades: Trade[] = dbTrades.map((x) => ({ id: x.id, date: x.trade_date, time: x.trade_time, createdAt: x.created_at, netCents: toCents(Number(x.net_result)) }));
  const flows: CashFlow[] = dbFlows.map((x) => ({ id: x.id, date: x.flow_date, amountCents: toCents(Number(x.amount)) }));
  const analysis = analyze(trades, flows, { initialCapitalCents: toCents(Number(settings.initial_capital)), riskPct: Number(settings.risk_pct) });
  return { error, dbTrades, dbFlows, settings, trades, flows, analysis };
}
