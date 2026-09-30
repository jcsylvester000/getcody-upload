import Link from "next/link";
import Image from "next/image";

export function AppHeader() {
  return (
    <header className="bg-midnight text-white">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-4 rounded-control">
          <Image
            src="/brand/grid-logo-dark.png"
            alt="GRID Property Ventures"
            width={150}
            height={39}
            priority
          />
          <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
          <span className="hidden text-sm font-medium text-white/80 sm:inline">Cody Uploader</span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-control px-3 py-1.5 text-white/85 hover:bg-white/10 hover:text-white">
            Uploader
          </Link>
          <Link href="/brand" className="rounded-control px-3 py-1.5 text-white/85 hover:bg-white/10 hover:text-white">
            Brand
          </Link>
        </nav>
      </div>
      <div className="brand-rule" aria-hidden="true" />
    </header>
  );
}
