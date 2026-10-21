import "./globals.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "NaokiTrader", description: "Seguimiento privado de rendimiento de trading", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#080b12" };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
