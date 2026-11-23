import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Financial Deep Agent — Assistente Financeiro",
  description: "Explore conceitos e dados financeiros em uma conversa clara e informativa.",
};

export const viewport: Viewport = {
  themeColor: "#08191d",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${sora.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
