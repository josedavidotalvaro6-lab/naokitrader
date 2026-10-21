import { useId } from "react";

/** Marca NaokiTrader: símbolo geométrico (N formada por una línea de precio) + logotipo tipográfico. */
export function BrandMark({ size = 28 }: { size?: number }) {
  const gid = "nt-g-" + useId().replace(/:/g, ""); // id único: la marca aparece más de una vez por página
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <defs><linearGradient id={gid} x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#3b82f6" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
      <rect width="32" height="32" rx="8" fill="#121a27" />
      <rect x=".5" y=".5" width="31" height="31" rx="7.5" fill="none" stroke="#263246" />
      <path d="M9 23V9l14 14V9" fill="none" stroke={`url(#${gid})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Brand({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} />
      <span className="text-[1.05rem] font-semibold leading-none tracking-tight text-fg">Naoki<span className="text-accent">Trader</span></span>
    </span>
  );
}
