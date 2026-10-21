import Link from "next/link";
import { loadAll } from "@/lib/data";
import { usd, pct } from "@/lib/format";
import { pctSigned, toneClass, usdSigned } from "@/components/fmt";
import { DailyChart, EquityChart } from "@/components/Charts";
import { PageHeader } from "@/components/PageHeader";
import { IconAlert, IconChart, IconDown, IconInfo, IconPlus, IconUp } from "@/components/Icons";
export const dynamic = "force-dynamic";

function Tile({ label, value, tone = "", sub, icon }: { label: string; value: string; tone?: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="label flex items-center justify-between gap-2">{label}{icon}</p>
      <p className={`num mt-2 text-xl font-semibold sm:text-2xl ${tone || "text-fg"}`}>{value}</p>
      {sub && <p className="hint mt-1.5">{sub}</p>}
    </div>
  );
}

export default async function Dashboard() {
  const { error, analysis: a, settings } = await loadAll();
  const m = a.metrics;
  const pnlTone = toneClass(m.trades ? m.pnlCents : null);
  const retTone = toneClass(m.returnTwr === null ? null : m.returnTwr);
  return (
    <div className="space-y-5">
      <PageHeader title="Panel" description="Rendimiento de tu cuenta">
        <Link href="/trades" className="btn btn-primary btn-sm"><IconPlus />Registrar operación</Link>
      </PageHeader>
      {error && (
        <p role="alert" className="flex items-start gap-2.5 rounded-lg border border-loss/40 bg-loss/10 px-3.5 py-2.5 text-sm text-lossfg">
          <IconAlert className="mt-0.5 shrink-0" /><span>No se pudieron cargar los datos: {error}</span>
        </p>
      )}

      <section aria-label="Indicadores" className="grid gap-4 lg:grid-cols-12">
        <div className="panel relative overflow-hidden p-5 sm:p-6 lg:col-span-5">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-accent/10 blur-3xl" />
          <p className="label">Capital actual</p>
          <p className="num mt-3 text-4xl font-semibold tracking-tight text-fg sm:text-5xl">{usd(m.currentCents)}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
            <div><dt className="hint">Capital inicial</dt><dd className="num mt-1 text-fg">{usd(m.initialCents)}</dd></div>
            <div><dt className="hint">Depósitos y retiros netos</dt><dd className="num mt-1 text-fg">{usdSigned(m.netFlowsCents)}</dd></div>
          </dl>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-7">
          <Tile label="P&L acumulado" value={m.trades ? usdSigned(m.pnlCents) : "N/D"} tone={pnlTone} sub="Solo resultado de operaciones" icon={m.trades && m.pnlCents !== 0 ? (m.pnlCents > 0 ? <IconUp width={15} height={15} className="text-gain" /> : <IconDown width={15} height={15} className="text-loss" />) : undefined} />
          <Tile label="Rentabilidad" value={pctSigned(m.returnTwr)} tone={retTone} sub="Ponderada por tiempo (TWR)" />
          <Tile label="Drawdown máx." value={pct(m.maxDrawdown)} tone={m.maxDrawdown ? "text-loss" : ""} sub={`Actual: ${pct(m.currentDrawdown)}`} />
          <Tile label="Win rate" value={pct(m.winRate, 1)} sub={m.trades ? `${m.wins} ganadas de ${m.trades}` : "Sin operaciones"} />
        </div>
      </section>

      <section aria-label="Operaciones" className="panel grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x">
        {([["Operaciones", m.trades, "text-fg"], ["Ganadas", m.wins, "text-gain"], ["Perdidas", m.losses, "text-loss"], ["Breakeven", m.breakevens, "text-muted"], ["Días operados", m.tradingDays, "text-fg"]] as const).map(([l, v, c]) => (
          <div key={l} className="px-4 py-3.5"><p className="label">{l}</p><p className={`num mt-1 text-lg font-semibold ${c}`}>{v}</p></div>
        ))}
      </section>

      {m.trades === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-xl border border-line bg-bg2 text-accent"><IconChart width={24} height={24} /></span>
          <p className="text-lg font-semibold text-fg">Aún no hay operaciones</p>
          <p className="mt-1.5 max-w-md text-sm text-muted">Registra tu primer resultado para ver la curva de equity y tus estadísticas. Riesgo planificado actual: <span className="num text-fg">{usd(Math.round(m.currentCents * Number(settings.risk_pct) / 100))}</span> por operación.</p>
          <Link href="/trades" className="btn btn-primary mt-5"><IconPlus />Registrar operación</Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="panel p-4 sm:p-5"><h2 className="label mb-3">Curva de equity</h2><EquityChart data={a.days.map((d) => ({ date: d.date, capital: d.endCents / 100 }))} /></section>
          <section className="panel p-4 sm:p-5"><h2 className="label mb-3">Resultados diarios</h2><DailyChart data={a.days.filter((d) => d.trades > 0).map((d) => ({ date: d.date, pnl: d.pnlCents / 100 }))} /></section>
        </div>
      )}
      <p className="flex items-start gap-2 text-xs text-muted"><IconInfo width={15} height={15} className="mt-px shrink-0" /><span>Rentabilidad ponderada por tiempo: los depósitos y retiros no cuentan como rendimiento. El drawdown se mide sobre ese mismo índice.</span></p>
    </div>
  );
}
