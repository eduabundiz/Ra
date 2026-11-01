import type { Metadata } from "next";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "./globals.css";
import { siteUrl, isDemo } from "@/lib/config";
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Relampamigos · El partido se vive juntos",
    template: "%s · Chivabonos Relampamigos",
  },
  description:
    "Lugares en lateral inferior del Akron para vivir al Guadalajara con tus amigos. Revisa partidos, grupos y disponibilidad. Trato directo por WhatsApp.",
  robots: isDemo()
    ? { index: false, follow: false }
    : { index: true, follow: true },
  icons: { icon: "/images/relampamigos-mark.png" },
  openGraph: {
    title: "Relampamigos · El partido se vive juntos",
    description: "Diez lugares. Dos tribunas. Un mismo sentimiento.",
    images: ["/images/akron-real.jpg"],
    locale: "es_MX",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-MX">
      <body>
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
