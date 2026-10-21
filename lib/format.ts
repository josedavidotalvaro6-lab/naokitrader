export const usd = (c: number | null) => c === null ? "N/D" : (c < 0 ? "-" : "") + "$" + (Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (v: number | null, d = 2) => v === null ? "N/D" : (v * 100).toFixed(d) + "%";
export const tone = (c: number | null) => c === null || c === 0 ? "text-slate-300" : c > 0 ? "text-gain" : "text-loss";
