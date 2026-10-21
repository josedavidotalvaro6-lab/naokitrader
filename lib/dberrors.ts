/** Traduce errores de Postgres/Supabase a mensajes claros. La base de datos es la autoridad final (migraciones 0002 y 0003). */
export type DbError = { message: string; code?: string };
export function friendlyDbError(e: DbError): string {
  if (e.code === "NT001" || e.message.startsWith("LEDGER:")) {
    const kind = e.message.includes("no_capital_to_trade")
      ? "no hay capital disponible para registrar una operación con resultado distinto de 0"
      : "el cambio dejaría el capital negativo en algún punto del historial";
    return `La base de datos rechazó el cambio: ${kind}. Revisa los montos, fechas y horas, o registra antes un depósito. Es posible que otra operación se haya guardado al mismo tiempo; recarga la página.`;
  }
  if (e.code === "P0001" || /Límite diario/.test(e.message)) return "Ya existe el máximo de operaciones permitido para esa fecha. Edita el registro existente.";
  if (e.code === "23514") return "Algún valor está fuera del rango permitido.";
  if (e.code === "42501") return "No tienes permiso para esta operación.";
  return "No se guardó: " + e.message;
}
