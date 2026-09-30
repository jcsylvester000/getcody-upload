"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { useApp } from "./AppProvider";
import { FolderPicker } from "./FolderPicker";
import { DocumentsTab } from "./DocumentsTab";
import { UploadTab } from "./UploadTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "documents" | "upload" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "documents", label: "Folders & documents" },
  { id: "upload", label: "Upload queue" },
  { id: "history", label: "History & activity" },
];
const STORE_KEY = "grid-cody:selected-folders";
const TAB_KEY = "grid-cody:tab";

export function UploaderApp() {
  const { folders, foldersLoading, foldersError, reloadFolders, createFolder, queue } = useApp();
  const [tab, setTab] = useState<Tab>("documents");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
      if (Array.isArray(saved)) setSelected(new Set(saved));
      const t = localStorage.getItem(TAB_KEY) as Tab | null;
      if (t && TABS.some((x) => x.id === t)) setTab(t);
    } catch {}
  }, []);

  const choose = (next: Set<string>) => {
    setSelected(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
    } catch {}
  };
  const pickTab = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const validSelected = useMemo(() => {
    if (folders.length === 0) return selected;
    const ids = new Set(folders.map((f) => f.id));
    return new Set([...selected].filter((id) => ids.has(id)));
  }, [folders, selected]);
  const targets = folders.filter((f) => validSelected.has(f.id));

  const refreshKey =
    queue.batches.length * 1000 + queue.batches.filter((b) => ["complete", "partial", "failed"].includes(b.status)).length;
  const active = queue.items.filter((x) => ["queued", "uploading", "uploaded", "syncing"].includes(x.status)).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <FolderPicker
          folders={folders}
          loading={foldersLoading}
          error={foldersError}
          selected={validSelected}
          onChange={choose}
          onReload={reloadFolders}
          onCreate={async (name) => {
            const f = await createFolder(name);
            choose(new Set([...validSelected, f.id]));
          }}
        />
      </aside>

      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Cody knowledge base</p>
            <h1 className="mt-1 font-display text-3xl text-nile">Document uploader</h1>
          </div>
          <Link
            href="/board"
            className="inline-flex items-center gap-2 rounded-control border border-nile px-3 py-2 text-sm font-semibold text-nile hover:bg-nile-soft"
          >
            <KanbanSquare className="size-4" aria-hidden="true" /> Open upload board
          </Link>
        </div>

        <div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => pickTab(t.id)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? "border-muesli text-nile" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
              {t.id === "upload" && active > 0 && (
                <span className="ml-2 rounded-full bg-nile px-1.5 py-0.5 text-[11px] text-white">{active}</span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "documents" && <DocumentsTab folders={folders} selected={validSelected} refreshKey={refreshKey} />}
          {tab === "upload" && <UploadTab targets={targets} queue={queue} />}
          {tab === "history" && <HistoryTab selected={validSelected} refreshKey={refreshKey} />}
        </div>
      </div>
    </div>
  );
}
