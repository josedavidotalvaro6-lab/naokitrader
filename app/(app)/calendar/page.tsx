import { loadAll, todayBogota } from "@/lib/data";
import { usd } from "@/lib/format";
import { usdSigned } from "@/components/fmt";
import { PageHeader } from "@/components/PageHeader";
export const dynamic = "force-dynamic";
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
export default async function Cal({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.year) || Number(todayBogota().slice(0, 4));
  const today = todayBogota();
  const { error, analysis } = await loadAll();
  const byDate = new Map(analysis.days.filter((d) => d.trades > 0).map((d) => [d.date, d.pnlCents]));
  return (
    <div className="space-y-5">
      <PageHeader title={`Calendario ${year}`} description="Resultado neto por día">
        <a className="btn btn-secondary btn-sm" href={`/calendar?year=${year - 1}`} aria-label={`Año ${year - 1}`}>← {year - 1}</a>
        <a className="btn btn-secondary btn-sm" href={`/calendar?year=${year + 1}`} aria-label={`Año ${year + 1}`}>{year + 1} →</a>
      </PageHeader>
      {error && <p role="alert" className="rounded-lg border border-loss/40 bg-loss/10 px-3.5 py-2.5 text-sm text-lossfg">{error}</p>}
      <ul aria-label="Leyenda" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <li className="flex items-center gap-2"><span aria-hidden className="cal-cell cal-gain size-5 !text-[11px] font-semibold">+</span>Ganancia</li>
        <li className="flex items-center gap-2"><span aria-hidden className="cal-cell cal-loss size-5 !text-[11px] font-semibold">−</span>Pérdida</li>
        <li className="flex items-center gap-2"><span aria-hidden className="cal-cell cal-flat size-5 !text-[11px] font-semibold">=</span>Breakeven</li>
        <li className="flex items-center gap-2"><span aria-hidden className="cal-cell cal-none size-5" />Sin operación</li>
        <li className="flex items-center gap-2"><span aria-hidden className="cal-cell cal-none cal-today size-5" />Hoy</li>
      </ul>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MONTHS.map((name, mi) => {
          const first = new Date(Date.UTC(year, mi, 1)); const n = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate(); const off = (first.getUTCDay() + 6) % 7;
          const cells = [...Array(off).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)];
          const total = [...byDate].filter(([d]) => d.startsWith(`${year}-${String(mi + 1).padStart(2, "0")}`)).reduce((s, [, v]) => s + v, 0);
          return (
            <section key={name} className="panel p-4" aria-label={name}>
              <div className="mb-3 flex items-baseline justify-between text-sm"><h2 className="font-semibold text-fg">{name}</h2><span className={`num text-xs font-semibold ${total > 0 ? "text-gain" : total < 0 ? "text-loss" : "text-muted"}`}>{total ? usdSigned(total) : ""}</span></div>
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {["L","M","X","J","V","S","D"].map((d) => <span key={d} className="pb-1 text-[11px] font-medium text-muted">{d}</span>)}
                {cells.map((day, i) => {
                  if (!day) return <span key={i} />;
                  const key = `${year}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const v = byDate.get(key);
                  const cls = v === undefined ? "cal-none" : v > 0 ? "cal-gain" : v < 0 ? "cal-loss" : "cal-flat";
                  return (
                    <span key={i} title={v === undefined ? key : `${key}: ${usd(v)}`} aria-label={v === undefined ? `${key}, sin operación` : `${key}, ${usd(v)}`} className={`cal-cell ${cls} ${key === today ? "cal-today" : ""}`}>
                      <span className="num">{day}</span>
                      {v !== undefined && <span aria-hidden className="text-[10px] font-bold leading-none">{v > 0 ? "+" : v < 0 ? "−" : "="}</span>}
                    </span>);
                })}
              </div>
            </section>);
        })}
      </div>
    </div>
  );
}
