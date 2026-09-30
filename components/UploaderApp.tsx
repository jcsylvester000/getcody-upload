"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CodyFolder } from "@/lib/types";
import { getFolders } from "@/lib/api";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import { FolderPicker } from "./FolderPicker";
import { DocumentsTab } from "./DocumentsTab";
import { UploadTab } from "./UploadTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "documents" | "upload" | "history";
const TABS: { id: Tab; label: string }[] = [
  { id: "documents", label: "Folders & documents" },
  { id: "upload", label: "Upload queue" },
  { id: "history", label: "History" },
];
const STORE_KEY = "grid-cody:selected-folders";

export function UploaderApp() {
  const [tab, setTab] = useState<Tab>("documents");
  const [folders, setFolders] = useState<CodyFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queue = useUploadQueue();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFolders(await getFolders());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
      if (Array.isArray(saved)) setSelected(new Set(saved));
    } catch {}
  }, [load]);

  const choose = (next: Set<string>) => {
    setSelected(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
    } catch {}
  };

  // Drop remembered ids that no longer exist in Cody
  const validSelected = useMemo(() => {
    if (folders.length === 0) return selected;
    const ids = new Set(folders.map((f) => f.id));
    return new Set([...selected].filter((id) => ids.has(id)));
  }, [folders, selected]);
  const targets = folders.filter((f) => validSelected.has(f.id));

  // Refresh documents + history whenever a batch changes state
  const refreshKey =
    queue.batches.length * 1000 +
    queue.batches.filter((b) => ["complete", "partial", "failed"].includes(b.status)).length;

  const active = queue.items.filter((x) => !["synced", "sync_failed", "error", "timeout"].includes(x.status)).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <FolderPicker folders={folders} loading={loading} error={error} selected={validSelected} onChange={choose} onReload={load} />
      </aside>

      <div className="min-w-0 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Cody knowledge base</p>
          <h1 className="mt-1 font-display text-3xl text-nile">Document uploader</h1>
        </div>

        <div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
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
