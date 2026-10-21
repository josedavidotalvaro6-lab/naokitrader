"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconDashboard, IconSettings, IconTrades } from "@/components/Icons";

/** Mismas rutas y etiquetas que antes; solo cambia la presentación (estado activo por ruta). */
const ITEMS = [
  { href: "/dashboard", label: "Panel", Icon: IconDashboard },
  { href: "/trades", label: "Operaciones", Icon: IconTrades },
  { href: "/calendar", label: "Calendario", Icon: IconCalendar },
  { href: "/settings", label: "Configuración", Icon: IconSettings },
];
const useActive = () => { const p = usePathname() ?? ""; return (href: string) => p === href || p.startsWith(href + "/"); };

export function SideNav() {
  const active = useActive();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className="nav-link" aria-current={active(href) ? "page" : undefined}><Icon />{label}</Link>
      ))}
    </nav>
  );
}
export function TabBar() {
  const active = useActive();
  return (
    <nav aria-label="Principal (móvil)" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-bg2/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {ITEMS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className="tab" aria-current={active(href) ? "page" : undefined}><Icon width={20} height={20} />{label}</Link>
      ))}
    </nav>
  );
}
export function SectionLabel({ className = "" }: { className?: string }) {
  const active = useActive();
  const cur = ITEMS.find((i) => active(i.href));
  return <span className={className}>{cur ? cur.label : ""}</span>;
}
