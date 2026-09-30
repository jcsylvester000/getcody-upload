"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { extOf, formatBytes } from "@/lib/file-rules";

type Content =
  | { kind: "loading" }
  | { kind: "pdf"; url: string }
  | { kind: "text"; text: string; truncated: boolean }
  | { kind: "html"; html: string }
  | { kind: "slides"; slides: string[] }
  | { kind: "none"; reason: string };

const MAX_TEXT = 200_000;

async function build(file: File): Promise<Content> {
  const ext = extOf(file.name);
  if (ext === "pdf") return { kind: "pdf", url: URL.createObjectURL(file) };
  if (ext === "txt" || ext === "md") {
    const t = await file.text();
    return { kind: "text", text: t.slice(0, MAX_TEXT), truncated: t.length > MAX_TEXT };
  }
  if (ext === "rtf") {
    const raw = await file.text();
    const t = raw
      .replace(/\\par[d]?/g, "\n")
      .replace(/\{\\\*[^{}]*\}/g, "")
      .replace(/\\'[0-9a-f]{2}/gi, "")
      .replace(/\\[a-z]+-?\d* ?/gi, "")
      .replace(/[{}]/g, "")
      .trim();
    return { kind: "text", text: t.slice(0, MAX_TEXT), truncated: t.length > MAX_TEXT };
  }
  if (ext === "docx" || ext === "docm") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return { kind: "html", html: value || "<p><em>No text found.</em></p>" };
  }
  if (ext === "pptx" || ext === "pptm") {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
    const slides: string[] = [];
    for (const n of names) {
      const xml = await zip.files[n].async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const paras = Array.from(doc.getElementsByTagName("a:p")).map((p) =>
        Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent ?? "").join(""),
      );
      slides.push(paras.filter(Boolean).join("\n"));
    }
    return { kind: "slides", slides };
  }
  return { kind: "none", reason: `Preview isn't available for legacy .${ext} files. It will still upload as-is.` };
}

/** Modal preview of exactly what will be uploaded. */
export function FilePreview({ file, onClose }: { file: File; onClose: () => void }) {
  const [c, setC] = useState<Content>({ kind: "loading" });
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    let url: string | null = null;
    build(file)
      .then((r) => {
        if (r.kind === "pdf") url = r.url;
        setC(r);
      })
      .catch((e) => setC({ kind: "none", reason: `Couldn't read this file: ${(e as Error).message}` }));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto h-[85dvh] w-[min(960px,calc(100vw-32px))] rounded-card border border-line bg-surface p-0 shadow-xl backdrop:bg-midnight/60"
      aria-label={`Preview of ${file.name}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{file.name}</p>
            <p className="text-xs text-muted">
              {formatBytes(file.size)} · preview of what will be sent to Cody
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-control p-1.5 text-muted hover:bg-canvas hover:text-text"
            aria-label="Close preview"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-canvas">
          {c.kind === "loading" && <p className="p-6 text-sm text-muted">Reading file…</p>}
          {c.kind === "pdf" && <iframe src={c.url} title={file.name} className="h-full w-full bg-white" />}
          {c.kind === "text" && (
            <pre className="whitespace-pre-wrap break-words p-6 font-mono text-[13px] leading-relaxed">
              {c.text}
              {c.truncated && "\n\n… (preview truncated)"}
            </pre>
          )}
          {c.kind === "html" && (
            <iframe
              title={file.name}
              sandbox=""
              className="h-full w-full bg-white"
              srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font:14px/1.6 Poppins,system-ui,sans-serif;color:#0e192f;max-width:760px;margin:24px auto;padding:0 20px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px}</style>${c.html}`}
            />
          )}
          {c.kind === "slides" && (
            <ol className="space-y-3 p-6">
              {c.slides.map((s, i) => (
                <li key={i} className="rounded-card border border-line bg-surface p-4 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muesli-text">Slide {i + 1}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{s || <em className="text-muted">No text on this slide</em>}</p>
                </li>
              ))}
              {c.slides.length === 0 && <p className="text-sm text-muted">No slides found.</p>}
            </ol>
          )}
          {c.kind === "none" && <p className="p-6 text-sm text-muted">{c.reason}</p>}
        </div>
      </div>
    </dialog>
  );
}
