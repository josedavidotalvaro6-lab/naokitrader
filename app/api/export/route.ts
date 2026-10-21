import { loadAll } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";
const esc = (v: string) => /^[=+\-@\t\r]/.test(v) ? `"'${v.replace(/"/g, '""')}"` : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
export async function GET() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const { error, dbTrades, analysis } = await loadAll();
  if (error) return new Response(error, { status: 500 });
  const by = new Map(analysis.rows.map((r) => [r.id, r]));
  const lines = ["fecha,hora,resultado_usd,estado,capital_previo_usd,riesgo_planificado_usd,notas",
    ...[...dbTrades].sort((a, b) => a.trade_date.localeCompare(b.trade_date) || (a.trade_time ?? "99").localeCompare(b.trade_time ?? "99")).map((t) => { const r = by.get(t.id);
      return [t.trade_date, t.trade_time?.slice(0, 5) ?? "", Number(t.net_result).toFixed(2), t.status, r ? (r.capitalBeforeCents / 100).toFixed(2) : "", r ? (r.plannedRiskCents / 100).toFixed(2) : "", esc(t.notes ?? "")].join(","); })];
  return new Response("\uFEFF" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="naokitrader-operaciones.csv"' } });
}
