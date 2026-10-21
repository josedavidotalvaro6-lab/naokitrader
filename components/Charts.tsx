"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
type Eq = { date: string; capital: number };
type Dy = { date: string; pnl: number };

/* Espejo de los tokens de diseño (los atributos SVG de Recharts no leen variables CSS de forma fiable). */
const C = { accent: "#3b82f6", gain: "#22c55e", loss: "#f43f5e", grid: "#263246", tick: "#94a3b8", panel: "#121a27", ref: "#64748b" };
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const ax = { stroke: C.grid, tick: { fill: C.tick, fontSize: 11, fontFamily: MONO }, tickLine: false, axisLine: false } as const;
const tip = {
  contentStyle: { background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 8, color: "#f1f5f9", fontFamily: MONO, fontSize: 12, boxShadow: "0 10px 30px -10px rgba(0,0,0,.7)" },
  labelStyle: { color: C.tick, marginBottom: 4 },
  itemStyle: { color: "#f1f5f9" },
  cursor: { stroke: "#38486a", strokeDasharray: "3 3" },
};
const shortDate = (d: string) => d.slice(5); // AAAA-MM-DD → MM-DD (solo etiqueta del eje)

export function EquityChart({ data }: { data: Eq[] }) {
  return (
    <div className="h-56 sm:h-72" role="img" aria-label="Curva de equity">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs><linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.28} /><stop offset="100%" stopColor={C.accent} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke={C.grid} strokeOpacity={0.55} vertical={false} />
          <XAxis dataKey="date" {...ax} minTickGap={36} tickFormatter={shortDate} />
          <YAxis {...ax} width={52} domain={["auto", "auto"]} tickFormatter={(v) => "$" + v} />
          <Tooltip {...tip} formatter={(v: number) => ["$" + v.toFixed(2), "Capital"]} />
          <Area type="monotone" dataKey="capital" stroke={C.accent} strokeWidth={2} fill="url(#eq-fill)" activeDot={{ r: 4, fill: C.accent, stroke: C.panel, strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function DailyChart({ data }: { data: Dy[] }) {
  return (
    <div className="h-56 sm:h-72" role="img" aria-label="Resultados diarios">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} strokeOpacity={0.55} vertical={false} />
          <XAxis dataKey="date" {...ax} minTickGap={36} tickFormatter={shortDate} />
          <YAxis {...ax} width={52} tickFormatter={(v) => "$" + v} />
          <Tooltip {...tip} cursor={{ fill: "rgba(148,163,184,.08)" }} formatter={(v: number) => ["$" + v.toFixed(2), "P&L"]} />
          <ReferenceLine y={0} stroke={C.ref} />
          <Bar dataKey="pnl" radius={[2, 2, 0, 0]} isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? C.gain : C.loss} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
