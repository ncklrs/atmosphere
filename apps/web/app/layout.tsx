import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "../components/lyric-stage.css";
import "../components/ambient-visuals.css";
const geist = localFont({
  src: "../fonts/geist.woff2",
  variable: "--font-geist",
  display: "swap",
});
const instrument = localFont({
  src: "../fonts/instrument.woff2",
  variable: "--font-instrument",
  display: "swap",
});
const mono = localFont({
  src: "../fonts/mono.woff2",
  variable: "--font-mono",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Atmosphere — A room for sound",
  description: "A local-first ambient music and lyric display.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${instrument.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
