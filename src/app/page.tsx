import Link from "next/link";
import { HoldToReveal } from "@/components/HoldToReveal";
import { STANDARD_TEMPLATE_ID } from "@/templates/registry";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-cyan">
          NURF MY CV · Premium Khmer Resume Studio
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight">
          <span className="text-gradient-flow">A focused 2D résumé studio, built for Khmer.</span>
          <br />
          <span className="text-ink-200">Telegram-secured. AI-interviewed. ATS-ready.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-ink-200">
          <strong>NURF MY CV</strong> is an AI career consultant that interviews you <strong>in Khmer</strong> to surface real metrics,
          then renders a pixel-perfect A4 CV with professional Khmer Unicode fonts — clip-free, and exportable to PDF, PNG and ATS.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/studio"
            className="rounded-full bg-accent-cyan px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-cyan/90"
          >
            បើកស្ទូឌីយោ CV · Open Studio
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-ink-700 px-5 py-2.5 text-sm text-ink-100 transition hover:bg-ink-800"
          >
            ចូលប្រើជាមួយ Telegram
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-ink-700 px-5 py-2.5 text-sm text-ink-100 transition hover:bg-ink-800"
          >
            Open dashboard
          </Link>
        </div>
      </header>

      <section className="tilt-3d glass-card rounded-xl border border-accent-cyan/40 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-accent-cyan">
          Three high-fidelity résumé layouts
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-200">
          Clean, ATS-friendly A4 models — Modern Minimalist, Executive Pro and Creative Vibrant —
          each with a live, Khmer-safe phone preview. No heavy 3D scenes: just a fast, focused
          authoring flow with a real-time document preview and one-tap layout switching.
        </p>
        <Link
          href={`/templates/${STANDARD_TEMPLATE_ID}`}
          className="mt-4 inline-flex rounded-full bg-accent-cyan px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-cyan/90"
        >
          បង្កើត CV ថ្មី / Create New CV →
        </Link>
      </section>

      <section className="mt-16 tilt-3d glass-card rounded-xl border border-ink-700 p-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-accent-cyan">
          Need to talk to an admin?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-ink-200">
          The admin Telegram handle is cryptographically hidden behind a 3-second hold. Bots and
          scrapers cannot bypass this — the button only fires after a verified press-and-hold
          handshake.
        </p>
        <div className="mt-4">
          <HoldToReveal />
        </div>
      </section>
    </main>
  );
}
