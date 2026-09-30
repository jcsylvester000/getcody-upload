import type { Metadata } from "next";
import Image from "next/image";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata: Metadata = { title: "Brand guidelines" };

const PRIMARY = [
  { name: "Nile Blue", hex: "#1C335E", rgb: "28 51 94", pantone: "P 108-16 C", token: "nile", use: "Primary buttons, headings, links" },
  { name: "Muesli", hex: "#BE8562", rgb: "190 133 98", pantone: "P 36-10 C", token: "muesli", use: "Accents, active tab, icons" },
  { name: "White", hex: "#FFFFFF", rgb: "255 255 255", pantone: "P 179-1 C", token: "surface", use: "Cards, surfaces" },
  { name: "Midnight", hex: "#0E192F", rgb: "14 25 47", pantone: "296 C", token: "midnight", use: "Header bar, body text" },
];
const SECONDARY = [
  { name: "Deep Code", hex: "#141545", rgb: "20 21 69", pantone: "P 103-16 C", token: "deep-code", use: "Deep backgrounds" },
  { name: "Burly Wood", hex: "#E2B985", rgb: "226 185 133", pantone: "7508 C", token: "burly", use: "Highlights on dark" },
  { name: "Iron", hex: "#D2D2D2", rgb: "210 210 210", pantone: "P 179-3 C", token: "iron", use: "Borders, disabled" },
  { name: "Black", hex: "#000000", rgb: "0 0 0", pantone: "426 C", token: "—", use: "Mono logo only" },
];

const RULES = [
  ["Use approved logos only", "Horizontal logo is the default. Don't recolor, stretch, rotate or add effects (Guide 3.8)."],
  ["Muesli is an accent", "Muesli on white is below 4.5:1 — use it for icons, rules and large text. Body text in Muesli uses the darker #8C5A3A."],
  ["Tone: professional, approachable, empowering, inclusive", "Plain words, no jargon. Say what happens: “Sent · converting”, “Learning”, “Learned” (Guide 2.4)."],
  ["Imagery", "Candid photos of real people and projects that convey trust and professionalism (Guide 3.16)."],
];

function Swatch({ c }: { c: (typeof PRIMARY)[number] }) {
  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="h-16 border-b border-line" style={{ background: c.hex }} />
      <div className="p-3 text-xs">
        <p className="text-sm font-semibold">{c.name}</p>
        <p className="font-mono text-muted">HEX {c.hex} · RGB {c.rgb}</p>
        <p className="text-muted">Pantone {c.pantone} · token <code>{c.token}</code></p>
        <p className="mt-1 text-muted">{c.use}</p>
      </div>
    </li>
  );
}

export default function BrandPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Source: Brand Guide — GRID, as of Jan 28</p>
        <h1 className="mt-1 font-display text-3xl text-nile">GRID brand guidelines</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          How this app applies the GRID Property Ventures brand. Tokens live in <code className="font-mono">app/globals.css</code>.
        </p>
      </header>

      <section aria-labelledby="logo-h" className="grid gap-4 sm:grid-cols-3">
        <h2 id="logo-h" className="sr-only">Logo</h2>
        <div className="flex h-40 items-center justify-center rounded-card border border-line bg-surface p-6 shadow-card">
          <Image src="/brand/grid-logo-light.png" alt="GRID logo on light" width={240} height={62} />
        </div>
        <div className="flex h-40 items-center justify-center rounded-card bg-midnight p-6 shadow-card">
          <Image src="/brand/grid-logo-dark.png" alt="GRID logo on dark" width={240} height={62} />
        </div>
        <div className="flex h-40 items-center justify-center rounded-card bg-nile p-6 shadow-card">
          <Image src="/brand/grid-mark.png" alt="GRID mark" width={90} height={63} />
        </div>
      </section>

      <section aria-labelledby="p-h">
        <h2 id="p-h" className="text-lg font-semibold">Primary colors</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{PRIMARY.map((c) => <Swatch key={c.name} c={c} />)}</ul>
      </section>
      <section aria-labelledby="s-h">
        <h2 id="s-h" className="text-lg font-semibold">Secondary colors</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SECONDARY.map((c) => <Swatch key={c.name} c={c} />)}</ul>
      </section>

      <section aria-labelledby="type-h" className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 id="type-h" className="text-lg font-semibold">Typography</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Primary · Cantata One — headings</p>
            <p className="mt-2 font-display text-4xl text-muesli-text">AaBbCc</p>
            <p className="mt-2 font-display text-xl text-nile">Document uploader</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Primary · Poppins — body & UI</p>
            <p className="mt-2 text-4xl font-semibold text-nile">AaBbCc</p>
            <p className="mt-2 text-sm">Regular 400 for body, Medium 500 for labels, SemiBold 600 for buttons.</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">Secondary typeface in the guide: Judson (print/editorial) — not used in this app.</p>
      </section>

      <section aria-labelledby="comp-h" className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 id="comp-h" className="text-lg font-semibold">Components</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="rounded-control bg-nile px-4 py-2.5 text-sm font-semibold text-white hover:bg-midnight">Primary action</button>
          <button type="button" className="rounded-control border border-nile px-4 py-2.5 text-sm font-semibold text-nile hover:bg-nile-soft">Secondary</button>
          <StatusBadge status="queued" />
          <StatusBadge status="uploaded" />
          <StatusBadge status="syncing" />
          <StatusBadge status="synced" />
          <StatusBadge status="error" />
        </div>
        <div className="brand-rule mt-5 rounded-full" aria-hidden="true" />
      </section>

      <section aria-labelledby="rules-h">
        <h2 id="rules-h" className="text-lg font-semibold">Rules</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {RULES.map(([t, d]) => (
            <li key={t} className="rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="text-sm font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
