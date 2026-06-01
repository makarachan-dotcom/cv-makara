import Link from "next/link";
import { HoldToReveal } from "@/components/HoldToReveal";
import { STANDARD_TEMPLATE_ID } from "@/templates/registry";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-16">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-cyan">
          NURF MY CV · Premium Khmer Resume Studio
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
          <span className="text-gradient-flow">ស្ទូឌីយោបង្កើត CV 2D ដ៏ទំនើប សម្រាប់ជនជាតិខ្មែរ។</span>
          <br />
          <span className="text-ink-200">សុវត្ថិភាពតាម Telegram · សម្ភាសន៍ដោយ AI · ស្តង់ដារ ATS។</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-khmer text-ink-200">
          <strong>NURF MY CV</strong> គឺជាទីប្រឹក្សាអាជីព AI ដែលនឹងសម្ភាសន៍អ្នក <strong>ជាភាសាខ្មែរ</strong> ដើម្បីទាញយកសមិទ្ធផលពិតប្រាកដរបស់អ្នក 
          រួចបង្កើតជា CV ទំហំ A4 ដ៏ល្អឥតខ្ចោះ ជាមួយពុម្ពអក្សរយូនីកូដខ្មែរអាជីព — មិនកាត់ដាច់អក្សរ និងអាចទាញយកជា PDF, PNG និង ATS បានភ្លាមៗ។
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/studio"
            className="rounded-full bg-accent-cyan px-8 py-3.5 text-sm font-bold text-ink-950 transition-all hover:scale-105 hover:bg-accent-cyan/90 shadow-[0_10px_20px_-5px_rgba(34,211,238,0.4)]"
          >
            បើកស្ទូឌីយោ CV · Open Studio
          </Link>
          <Link
            href="/templates/standard"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-semibold text-ink-100 backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20"
          >
            បង្កើត CV ថ្មី · Create New CV
          </Link>
        </div>
      </header>

      <section className="tilt-3d glass-card group rounded-3xl border border-white/15 bg-neutral-900/80 p-8 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1.5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-accent-cyan">
          ប្លង់ CV កម្រិតខ្ពស់ចំនួន ៣ ប្រភេទ
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-khmer text-ink-200">
          ម៉ូដែល A4 ដែលស្អាត និងងាយស្រួលអានដោយប្រព័ន្ធ ATS — Modern Minimalist, Executive Pro និង Creative Vibrant — 
          នីមួយៗមានការបង្ហាញគំរូផ្ទាល់លើទូរស័ព្ទ។ គ្មានឈុតឆាក 3D ស្មុគស្មាញ៖ ផ្តោតលើល្បឿន និងភាពច្បាស់លាស់ ជាមួយការបង្ហាញលទ្ធផលភ្លាមៗ។
        </p>
        <Link
          href={`/templates/${STANDARD_TEMPLATE_ID}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-cyan px-6 py-3 text-sm font-bold text-ink-950 transition-all hover:bg-accent-cyan/90"
        >
          បង្កើត CV ថ្មី / Create New CV <span className="text-lg">→</span>
        </Link>
      </section>

      <section className="mt-12 tilt-3d glass-card rounded-3xl border border-white/15 bg-neutral-900/80 p-8 backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1.5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-accent-cyan">
          តើអ្នកត្រូវការលក្ខ័ណ្ឌពិសេស ឬសហការផ្សេងទៀត?
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-khmer text-ink-200">
          Admin របស់យើងអាចផ្តល់ជូនលក្ខ័ណ្ឌពិសេស ដូចជា តម្លាភាពលម្អិត ឬការបង្កើត CV ជាច្រើនក្នុងពេលតែមួយ។ សូមទាក់ទងរយៈពេល ៣ វិនាទី ដើម្បីបង្ហាញថាអ្នកមិនមែនជាកម្មវិធីស្វ័យប្រវត្ត។
        </p>
        <div className="mt-6">
          <HoldToReveal
            label="សង្កត់ដើម្បីទាក់ទង Admin (3s)"
            className="group relative inline-flex select-none items-center gap-4 rounded-2xl border border-white/10 bg-black/40 px-8 py-4 text-sm text-ink-100 transition hover:bg-black/60 hover:border-accent-cyan/40"
          />
        </div>
      </section>

      <footer className="mt-24 flex flex-col items-center gap-4 border-t border-white/5 pt-16 pb-12">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-accent-cyan/30" />
            <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-accent-cyan to-indigo-500 shadow-[0_0_20px_rgba(34,211,238,0.5)]" />
          </div>
          <span className="animate-gradient-flow bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-2xl font-black tracking-tighter text-transparent">
            NURF MY CV
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-[0.5em] text-ink-400">
          Premium 2D Resume Studio · 100% Khmer Safe
        </p>
      </footer>
    </main>
  );
}
