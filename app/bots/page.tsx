import type { Metadata } from "next";
import { BotCanvas } from "@/components/BotCanvas";

export const metadata: Metadata = { title: "Bots & knowledge" };

export default function BotsPage() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Cody workspace</p>
        <h1 className="mt-1 font-display text-3xl text-nile">Bots &amp; knowledge</h1>
      </div>
      <BotCanvas />
    </div>
  );
}
