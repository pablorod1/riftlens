import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Riftlens — estadísticas de League of Legends", template: "%s · Riftlens" },
  description: "Perfiles, rankings, builds, matchups y tier lists de League of Legends, calculados para ti.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <footer className="mt-auto border-t border-line py-6 text-center text-xs text-faint">
          <p className="mx-auto max-w-2xl px-4">
            Riftlens no está respaldado por Riot Games y no refleja las opiniones de Riot Games ni de nadie involucrado
            oficialmente en la producción o gestión de las propiedades de Riot Games. Riot Games y todas las propiedades
            asociadas son marcas comerciales o marcas registradas de Riot Games, Inc.
          </p>
        </footer>
      </body>
    </html>
  );
}
