import { signOut } from "@/app/actions";
import { Brand } from "@/components/Brand";
import { IconLogout } from "@/components/Icons";
import { SectionLabel, SideNav, TabBar } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-line bg-bg2 px-3 py-5 lg:flex">
        <Brand className="px-2" />
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Brand size={26} className="lg:hidden" />
            <span className="hidden items-center gap-2 text-sm text-muted lg:inline-flex">NaokiTrader <span aria-hidden className="text-faint">/</span> <SectionLabel className="font-medium text-fg" /></span>
          </div>
          <form action={signOut}>
            <button className="btn btn-ghost btn-sm" aria-label="Cerrar sesión"><IconLogout /><span className="hidden sm:inline">Cerrar sesión</span></button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-[88rem] flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
