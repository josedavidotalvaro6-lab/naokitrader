import { loadAll, todayBogota } from "@/lib/data";
import { usd } from "@/lib/format";
import { toCents } from "@/lib/finance/core";
import { toneClass, usdSigned } from "@/components/fmt";
import { saveSettings, addFlow, deleteFlow } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { PageHeader } from "@/components/PageHeader";
import { IconDownload, IconPlus, IconTrash } from "@/components/Icons";
export const dynamic = "force-dynamic";
export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { error, settings: s, dbFlows } = await loadAll();
  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Capital, riesgo y movimientos de la cuenta" />
      <Flash ok={sp.ok} err={sp.err ?? error ?? undefined} />

      <form action={saveSettings} className="panel p-4 sm:p-5" aria-label="Capital y riesgo">
        <h2 className="text-base font-semibold text-fg">Capital y riesgo</h2>
        <p className="hint mt-1">Zona horaria: America/Bogota.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="field-label">Capital inicial (USD)
            <span className="affix block"><span className="affix-mark affix-start" aria-hidden>$</span><input className="input num has-start" type="number" step="0.01" min="0" name="initial_capital" defaultValue={s.initial_capital} required /></span>
          </label>
          <label className="field-label">Riesgo por operación (%)
            <span className="affix block"><input className="input num has-end" type="number" step="0.01" min="0.01" max="100" name="risk_pct" defaultValue={s.risk_pct} required /><span className="affix-mark affix-end" aria-hidden>%</span></span>
          </label>
          <label className="field-label">Máx. operaciones por día (vacío = sin límite)<input className="input num" type="number" min="1" name="max_trades_per_day" defaultValue={s.max_trades_per_day ?? ""} /></label>
        </div>
        <div className="mt-5"><button className="btn btn-primary">Guardar configuración</button></div>
      </form>

      <section className="space-y-3" aria-labelledby="flows-h">
        <h2 id="flows-h" className="text-base font-semibold text-fg">Depósitos y retiros</h2>
        <form action={addFlow} className="panel p-4 sm:p-5" aria-label="Nuevo movimiento">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[10.5rem_10rem_10rem_minmax(0,1fr)_auto] lg:items-end">
            <label className="field-label">Fecha<input className="input num" type="date" name="flow_date" defaultValue={todayBogota()} required /></label>
            <label className="field-label">Tipo<select className="input" name="kind"><option value="deposit">Depósito</option><option value="withdrawal">Retiro</option></select></label>
            <label className="field-label">Monto (USD)
              <span className="affix block"><span className="affix-mark affix-start" aria-hidden>$</span><input className="input num has-start" type="number" step="0.01" min="0.01" name="amount" required /></span>
            </label>
            <label className="field-label sm:col-span-2 lg:col-span-1">Nota<input className="input" name="notes" maxLength={500} /></label>
            <button className="btn btn-primary sm:col-span-2 lg:col-span-1"><IconPlus />Agregar</button>
          </div>
        </form>
        {dbFlows.length === 0 ? <p className="panel px-5 py-6 text-center text-sm text-muted">Sin movimientos externos.</p> : (
          <ul className="panel divide-y divide-line overflow-hidden">{dbFlows.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
              <span className="num text-muted">{f.flow_date}</span>
              <span className={`num min-w-24 font-semibold ${toneClass(toCents(Number(f.amount)))}`}>{usdSigned(toCents(Number(f.amount)))}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{f.notes}</span>
              <form action={deleteFlow}><input type="hidden" name="id" value={f.id} /><button className="btn btn-danger btn-sm" aria-label={`Eliminar movimiento del ${f.flow_date} por ${usd(toCents(Number(f.amount)))}`}><IconTrash width={15} height={15} />Eliminar</button></form>
            </li>))}</ul>)}
      </section>

      <section className="panel-flat flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 basis-72 flex-1"><h2 className="text-base font-semibold text-fg">Respaldo</h2><p className="hint mt-1">Descarga tus operaciones en CSV con regularidad. Además, activa los respaldos de tu proyecto Supabase (ver README).</p></div>
        <a className="btn btn-secondary" href="/api/export"><IconDownload />Descargar CSV</a>
      </section>
    </div>
  );
}
