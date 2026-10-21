"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { loadAll } from "@/lib/data";
import { friendlyDbError } from "@/lib/dberrors";
import { canAddTrade, describeViolation, toCents, validateTimeline, type CashFlow, type Trade } from "@/lib/finance/core";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)").optional().or(z.literal(""));
const money = z.coerce.number().finite().refine((n) => Math.abs(n) < 1e9, "Monto fuera de rango");
const back = (path: string, kind: "ok" | "err", msg: string): never => redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user: user! };
}

const cfg = (all: Awaited<ReturnType<typeof loadAll>>, initial?: number) => ({
  initialCapitalCents: toCents(initial ?? Number(all.settings.initial_capital)),
  riskPct: Number(all.settings.risk_pct),
});

export async function saveTrade(fd: FormData) {
  const { sb, user } = await requireUser();
  const p = z.object({ id: z.string().uuid().optional().or(z.literal("")), trade_date: date, trade_time: time, net_result: money, notes: z.string().max(2000).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return back("/trades", "err", p.error.issues[0].message);
  const { id, trade_date, trade_time, net_result, notes } = p.data;
  const all = await loadAll();
  if (all.error) return back("/trades", "err", "No se pudo verificar el historial: " + all.error);
  if (!canAddTrade(all.trades, trade_date, all.settings.max_trades_per_day, id || undefined))
    return back("/trades", "err", `Ya existe una operación el ${trade_date}. Edítala desde el historial.`);
  // Validación de capital: se simula la línea de tiempo completa con el cambio propuesto.
  const prev = id ? all.trades.find((t) => t.id === id) : undefined;
  const cand: Trade = { id: id || "__new__", date: trade_date, netCents: toCents(net_result), time: trade_time || null, createdAt: prev?.createdAt ?? new Date().toISOString() };
  const v = validateTimeline([...all.trades.filter((t) => t.id !== id), cand], all.flows, cfg(all));
  if (v) return back("/trades", "err", describeViolation(v));
  const row = { trade_date, trade_time: trade_time || null, net_result, notes: notes || null };
  const { error } = id ? await sb.from("trades").update(row).eq("id", id) : await sb.from("trades").insert({ ...row, user_id: user.id });
  if (error) return back("/trades", "err", friendlyDbError(error));
  revalidatePath("/", "layout");
  return back("/trades", "ok", id ? "Registro actualizado" : "Operación guardada");
}

export async function deleteTrade(fd: FormData) {
  const { sb } = await requireUser();
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) return back("/trades", "err", "Registro inválido");
  const all = await loadAll();
  if (all.error) return back("/trades", "err", "No se pudo verificar el historial: " + all.error);
  const v = validateTimeline(all.trades.filter((t) => t.id !== id.data), all.flows, cfg(all));
  if (v) return back("/trades", "err", "No se puede eliminar: dejaría inconsistente el historial posterior. " + describeViolation(v));
  const { error } = await sb.from("trades").delete().eq("id", id.data);
  if (error) return back("/trades", "err", friendlyDbError(error));
  revalidatePath("/", "layout");
  return back("/trades", "ok", "Registro eliminado");
}

export async function addFlow(fd: FormData) {
  const { sb, user } = await requireUser();
  const p = z.object({ flow_date: date, kind: z.enum(["deposit", "withdrawal"]), amount: money.refine((n) => n > 0, "El monto debe ser mayor que 0"), notes: z.string().max(500).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return back("/settings", "err", p.error.issues[0].message);
  const signed = p.data.kind === "withdrawal" ? -p.data.amount : p.data.amount;
  const all = await loadAll();
  if (all.error) return back("/settings", "err", "No se pudo verificar el historial: " + all.error);
  const test: CashFlow[] = [...all.flows, { id: "__new__", date: p.data.flow_date, amountCents: toCents(signed) }];
  const v = validateTimeline(all.trades, test, cfg(all));
  if (v) return back("/settings", "err", describeViolation(v));
  const { error } = await sb.from("cash_flows").insert({ flow_date: p.data.flow_date, amount: signed, notes: p.data.notes || null, user_id: user.id });
  if (error) return back("/settings", "err", friendlyDbError(error));
  revalidatePath("/", "layout");
  return back("/settings", "ok", "Movimiento guardado");
}

export async function deleteFlow(fd: FormData) {
  const { sb } = await requireUser();
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) return back("/settings", "err", "Registro inválido");
  const all = await loadAll();
  if (all.error) return back("/settings", "err", "No se pudo verificar el historial: " + all.error);
  const v = validateTimeline(all.trades, all.flows.filter((f) => f.id !== id.data), cfg(all));
  if (v) return back("/settings", "err", "No se puede eliminar: dejaría el capital negativo. " + describeViolation(v));
  const { error } = await sb.from("cash_flows").delete().eq("id", id.data);
  if (error) return back("/settings", "err", friendlyDbError(error));
  revalidatePath("/", "layout");
  return back("/settings", "ok", "Movimiento eliminado");
}

export async function saveSettings(fd: FormData) {
  const { sb, user } = await requireUser();
  const p = z.object({ initial_capital: money.refine((n) => n >= 0, "Capital inválido"), risk_pct: z.coerce.number().gt(0).lte(100), max_trades_per_day: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return back("/settings", "err", "Revisa capital (≥0) y riesgo (0–100%)");
  const max = p.data.max_trades_per_day ? Number(p.data.max_trades_per_day) : null;
  if (max !== null && (!Number.isInteger(max) || max < 1)) return back("/settings", "err", "El límite diario debe ser un entero ≥ 1 o vacío");
  const all = await loadAll();
  if (all.error) return back("/settings", "err", "No se pudo verificar el historial: " + all.error);
  const v = validateTimeline(all.trades, all.flows, { initialCapitalCents: toCents(p.data.initial_capital), riskPct: p.data.risk_pct });
  if (v) return back("/settings", "err", "Ese capital inicial dejaría inconsistente el historial. " + describeViolation(v));
  const { error } = await sb.from("settings").upsert({ user_id: user.id, initial_capital: p.data.initial_capital, risk_pct: p.data.risk_pct, max_trades_per_day: max });
  if (error) return back("/settings", "err", friendlyDbError(error));
  revalidatePath("/", "layout");
  return back("/settings", "ok", "Configuración guardada");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
