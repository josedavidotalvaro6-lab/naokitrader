import { loadAll, todayBogota } from "@/lib/data";
import { usd } from "@/lib/format";
import { toCents } from "@/lib/finance/core";
import { toneClass, usdSigned } from "@/components/fmt";
import { saveTrade, deleteTrade } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { PageHeader } from "@/components/PageHeader";
import { IconDown, IconDownload, IconEdit, IconEquals, IconFilter, IconPlus, IconTrash, IconUp } from "@/components/Icons";
export const dynamic = "force-dynamic";
type SP = Promise<{ ok?: string; err?: string; edit?: string; from?: string; to?: string; status?: string }>;
const lbl = { win: "Ganada", loss: "Perdida", breakeven: "Breakeven" } as const;
function Status({ s }: { s: keyof typeof lbl }) {
  const cls = s === "win" ? "badge-gain" : s === "loss" ? "badge-loss" : "badge-flat";
  return <span className={`badge ${cls}`}>{s === "win" ? <IconUp width={13} height={13} /> : s === "loss" ? <IconDown width={13} height={13} /> : <IconEquals width={13} height={13} />}{lbl[s]}</span>;
}
export default async function Trades({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { error, dbTrades, analysis, settings } = await loadAll();
  const byId = new Map(analysis.rows.map((r) => [r.id, r]));
  const editing = dbTrades.find((t) => t.id === sp.edit);
  const rows = dbTrades.filter((t) => (!sp.from || t.trade_date >= sp.from) && (!sp.to || t.trade_date <= sp.to) && (!sp.status || t.status === sp.status));
  return (
    <div className="space-y-6">
      <PageHeader title="Operaciones" description="Registra y corrige tus resultados">
        <a className="btn btn-secondary btn-sm" href="/api/export"><IconDownload />Exportar CSV</a>
      </PageHeader>
      <Flash ok={sp.ok} err={sp.err ?? error ?? undefined} />

      <form action={saveTrade} className="panel p-4 sm:p-5" aria-label="Registrar operación">
        <h2 className="mb-4 text-base font-semibold text-fg">{editing ? "Editar operación" : "Nueva operación"}</h2>
        <input type="hidden" name="id" defaultValue={editing?.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[11rem_9rem_12rem_minmax(0,1fr)]">
          <label className="field-label">Fecha<input className="input num" type="date" name="trade_date" required defaultValue={editing?.trade_date ?? todayBogota()} /></label>
          <label className="field-label">Hora (opcional)<input className="input num" type="time" name="trade_time" defaultValue={editing?.trade_time?.slice(0, 5) ?? ""} /></label>
          <label className="field-label">Resultado neto (USD)
            <span className="affix block"><span className="affix-mark affix-start" aria-hidden>$</span><input className="input num has-start" type="number" step="0.01" name="net_result" required placeholder="-3.20 o 7.85" defaultValue={editing?.net_result ?? ""} /></span>
          </label>
          <label className="field-label sm:col-span-2 lg:col-span-1">Notas<input className="input" name="notes" maxLength={2000} defaultValue={editing?.notes ?? ""} /></label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary"><IconPlus />{editing ? "Guardar cambios" : "Guardar"}</button>
          {editing && <a href="/trades" className="btn btn-secondary">Cancelar</a>}
          <p className="hint min-w-0 flex-1 basis-64">El estado se calcula solo: &gt; 0 ganada, &lt; 0 perdida, 0 breakeven. {settings.max_trades_per_day ? `Límite: ${settings.max_trades_per_day} por día. Con varias operaciones el mismo día, indica la hora para fijar el orden.` : ""}</p>
        </div>
      </form>

      <form className="panel-flat flex flex-wrap items-end gap-3 p-3 sm:p-4" aria-label="Filtros">
        <label className="field-label min-w-[9.5rem] flex-1 sm:flex-none">Desde<input className="input num" type="date" name="from" defaultValue={sp.from} /></label>
        <label className="field-label min-w-[9.5rem] flex-1 sm:flex-none">Hasta<input className="input num" type="date" name="to" defaultValue={sp.to} /></label>
        <label className="field-label min-w-[9.5rem] flex-1 sm:flex-none">Estado
          <select className="input" name="status" defaultValue={sp.status ?? ""}><option value="">Todos</option><option value="win">Ganada</option><option value="loss">Perdida</option><option value="breakeven">Breakeven</option></select>
        </label>
        <div className="flex gap-2"><button className="btn btn-secondary"><IconFilter />Filtrar</button><a className="btn btn-ghost" href="/trades">Limpiar</a></div>
      </form>

      {rows.length === 0 ? (
        <div className="panel px-6 py-12 text-center text-sm text-muted">{dbTrades.length ? "Ningún registro coincide con los filtros." : "Sin operaciones todavía. Usa el formulario de arriba para registrar la primera."}</div>
      ) : (
        <div className="table-wrap">
          <table className="tbl rt" role="table">
            <caption className="sr-only">Historial de operaciones</caption>
            <thead role="rowgroup"><tr role="row">
              {["Fecha", "Hora"].map((h) => <th key={h} role="columnheader" className="label">{h}</th>)}
              {["Resultado"].map((h) => <th key={h} role="columnheader" className="label col-num">{h}</th>)}
              <th role="columnheader" className="label">Estado</th>
              {["Capital previo", "Riesgo planif."].map((h) => <th key={h} role="columnheader" className="label col-num">{h}</th>)}
              <th role="columnheader" className="label">Notas</th>
              <th role="columnheader" className="label"><span className="sr-only">Acciones</span></th>
            </tr></thead>
            <tbody role="rowgroup">{rows.map((t) => { const r = byId.get(t.id); const c = toCents(Number(t.net_result)); return (
              <tr key={t.id} role="row">
                <td role="cell" data-label="Fecha" className="num">{t.trade_date}</td>
                <td role="cell" data-label="Hora" className="num text-muted">{t.trade_time?.slice(0, 5) ?? "—"}</td>
                <td role="cell" data-label="Resultado" className={`num col-num font-semibold ${toneClass(c)}`}>{usdSigned(c)}</td>
                <td role="cell" data-label="Estado"><Status s={t.status as keyof typeof lbl} /></td>
                <td role="cell" data-label="Capital previo" className="num col-num">{r ? usd(r.capitalBeforeCents) : "N/D"}</td>
                <td role="cell" data-label="Riesgo planif." className="num col-num text-muted">{r ? usd(r.plannedRiskCents) : "N/D"}</td>
                <td role="cell" data-label="Notas" data-empty={t.notes?.trim() ? undefined : "true"} className="cell-wide break-words text-muted md:max-w-[18rem] md:truncate">{t.notes}</td>
                <td role="cell" className="cell-actions whitespace-nowrap">
                  <span className="flex items-center justify-end gap-2 max-md:contents">
                    <a className="btn btn-secondary btn-sm" href={`/trades?edit=${t.id}`}><IconEdit width={15} height={15} />Editar</a>
                    <form action={deleteTrade} className="inline max-md:contents"><input type="hidden" name="id" value={t.id} /><button className="btn btn-danger btn-sm" aria-label={`Eliminar operación del ${t.trade_date}`}><IconTrash width={15} height={15} />Eliminar</button></form>
                  </span>
                </td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
