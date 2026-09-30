import type { Metadata } from "next";
import "@fontsource/cantata-one/400.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: { default: "GRID · Cody Uploader", template: "%s · GRID" },
  description: "Upload documents into GRID Property Ventures' Cody AI knowledge-base folders.",
  robots: { index: false, follow: false }, // private internal tool
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <AppHeader />
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
