"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Brand } from "@/components/Brand";
import { IconAlert, IconCheck } from "@/components/Icons";
export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState<{ t: "err" | "ok"; m: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const f = new FormData(e.currentTarget); const email = String(f.get("email")); const password = String(f.get("password"));
    try {
      const sb = supabaseBrowser();
      const r = mode === "in" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
      if (r.error) setMsg({ t: "err", m: r.error.message });
      else if (mode === "up" && !r.data.session) setMsg({ t: "ok", m: "Cuenta creada. Confirma tu correo y luego inicia sesión." });
      else { router.replace("/dashboard"); router.refresh(); }
    } catch { setMsg({ t: "err", m: "No se pudo conectar con el servidor. Revisa tu conexión y la configuración de Supabase." }); }
    setBusy(false);
  }
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section aria-hidden className="relative hidden overflow-hidden border-r border-line bg-bg2 lg:block">
        <svg className="absolute inset-0 size-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <linearGradient id="lg-line" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
            <linearGradient id="lg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" stopOpacity=".22" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
          </defs>
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1="0" x2="600" y1={120 + i * 80} y2={120 + i * 80} stroke="#263246" strokeOpacity=".55" />)}
          <path d="M0 640 L70 600 L130 620 L200 540 L270 565 L340 470 L410 500 L480 380 L540 400 L600 300 L600 800 L0 800Z" fill="url(#lg-fill)" />
          <path d="M0 640 L70 600 L130 620 L200 540 L270 565 L340 470 L410 500 L480 380 L540 400 L600 300" fill="none" stroke="url(#lg-line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12">
          <Brand size={34} />
          <div className="max-w-sm"><p className="text-2xl font-semibold leading-snug tracking-tight text-fg">Seguimiento privado de rendimiento de trading.</p><p className="mt-3 text-sm text-muted">Tus resultados, tu capital y tu historial en un solo lugar.</p></div>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <form onSubmit={submit} className="panel w-full max-w-sm space-y-5 p-6 sm:p-7" aria-busy={busy}>
          <Brand className="lg:hidden" size={30} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">{mode === "in" ? "Iniciar sesión" : "Crear cuenta"}</h1>
            <p className="mt-1.5 text-sm text-muted">{mode === "in" ? "Inicia sesión para ver tu rendimiento." : "Crea tu cuenta privada."}</p>
          </div>
          <label className="field-label">Correo<input name="email" type="email" required autoComplete="email" className="input" /></label>
          <label className="field-label">Contraseña<input name="password" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} className="input" /></label>
          {msg && (
            <p role="alert" className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${msg.t === "err" ? "border-loss/40 bg-loss/10 text-lossfg" : "border-gain/40 bg-gain/10 text-gain"}`}>
              {msg.t === "err" ? <IconAlert className="mt-0.5 shrink-0" /> : <IconCheck className="mt-0.5 shrink-0" />}<span>{msg.m}</span>
            </p>
          )}
          <button className="btn btn-primary w-full" disabled={busy} aria-busy={busy}>{busy && <span className="spinner" aria-hidden />}{busy ? "Procesando…" : mode === "in" ? "Iniciar sesión" : "Crear cuenta"}</button>
          <button type="button" className="block w-full text-center text-sm text-muted underline-offset-4 transition-colors hover:text-fg hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Crear cuenta" : "Ya tengo cuenta"}</button>
        </form>
      </section>
    </main>
  );
}
