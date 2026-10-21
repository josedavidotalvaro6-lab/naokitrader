import { IconAlert, IconCheck } from "@/components/Icons";
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  const bad = Boolean(err);
  return (
    <p role={bad ? "alert" : "status"} className={`rise mb-5 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${bad ? "border-loss/40 bg-loss/10 text-lossfg" : "border-gain/40 bg-gain/10 text-gain"}`}>
      {bad ? <IconAlert className="mt-0.5 shrink-0" /> : <IconCheck className="mt-0.5 shrink-0" />}
      <span>{err ?? ok}</span>
    </p>
  );
}
