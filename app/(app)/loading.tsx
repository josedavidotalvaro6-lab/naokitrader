/** Esqueleto de carga (solo presentación) mientras se resuelven los datos de la página. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" role="status" className="space-y-5">
      <div className="skeleton h-8 w-48" />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="skeleton h-44 lg:col-span-5" />
        <div className="grid grid-cols-2 gap-4 lg:col-span-7"><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /></div>
      </div>
      <div className="skeleton h-72" />
    </div>
  );
}
