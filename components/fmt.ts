/** Ayudas de PRESENTACIÓN. No calculan nada: solo añaden signo/colores sobre los formateadores existentes (lib/format.ts). */
import { usd, pct } from "@/lib/format";
export const usdSigned = (c: number | null) => (c === null ? "N/D" : c > 0 ? "+" + usd(c) : usd(c));
export const pctSigned = (v: number | null, d = 2) => (v === null ? "N/D" : v > 0 ? "+" + pct(v, d) : pct(v, d));
export const toneClass = (c: number | null) => (c === null || c === 0 ? "text-muted" : c > 0 ? "text-gain" : "text-loss");
