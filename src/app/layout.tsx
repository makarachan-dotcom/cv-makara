import type { Metadata } from "next";
import { Kantumruy_Pro, Hanuman, Nokora, Siemreap } from "next/font/google";
import "./globals.css";

// =============================================================================
// Professional Khmer Unicode font stack. All fonts self-host their woff2 under
// /_next so they embed cleanly in print-to-PDF export (no external fetch at
// print time → no missing glyphs / clipped subscripts).
// =============================================================================
const kantumruy = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-kantumruy",
});

const hanuman = Hanuman({
  subsets: ["khmer", "latin"],
  weight: ["100", "300", "400", "700", "900"],
  display: "swap",
  variable: "--font-hanuman",
});

const nokora = Nokora({
  subsets: ["khmer", "latin"],
  weight: ["100", "300", "400", "700", "900"],
  display: "swap",
  variable: "--font-nokora",
});

const siemreap = Siemreap({
  subsets: ["khmer"],
  weight: ["400"],
  display: "swap",
  variable: "--font-siemreap",
});

export const metadata: Metadata = {
  title: "Makara CV — Cinematic 3D Khmer Resume Studio",
  description:
    "Build a pixel-perfect Khmer CV inside a cinematic 3D studio. Telegram-secured. AI Khmer career interviewer, 20 WebGL templates, multi-format export (PDF / PNG / ATS).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${kantumruy.variable} ${hanuman.variable} ${nokora.variable} ${siemreap.variable}`}
    >
      <body className="min-h-screen bg-ink-950 font-sans text-ink-100 antialiased">
        {children}
      </body>
    </html>
  );
}
