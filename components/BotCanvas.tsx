"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Info,
  LayoutGrid,
  Loader2,
  Maximize,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import type { CodyBot, CodyDocument, CodyFolder } from "@/lib/types";
import { getBots, getDocuments } from "@/lib/api";
import { CODY_LINKS } from "@/lib/cody-links";
import { useApp } from "./AppProvider";

// ---------- types ----------
type Docs = { state: "loading" | "ready" | "error"; docs: CodyDocument[]; error?: string };
type BotData = { bot: CodyBot; fresh?: boolean; dim?: boolean };
type FolderData = { folder: CodyFolder; docs?: Docs; expanded: boolean; dim?: boolean; onToggle: (id: string) => void };
type BotNodeT = Node<BotData, "bot">;
type FolderNodeT = Node<FolderData, "folder">;
type AnyNode = BotNodeT | FolderNodeT;

const POS_KEY = "grid-cody:canvas-positions";
const BOT_W = 280;
const FOLDER_W = 300;
const COLS = 4;

const date = (s: number) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(s * 1000));

function loadPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function savePositions(p: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {}
}

/** Default layout: bots in a column on the left, folders in a grid on the right. */
function defaultPos(kind: "bot" | "folder", i: number) {
  if (kind === "bot") return { x: 0, y: i * 150 };
  return { x: BOT_W + 160 + (i % COLS) * (FOLDER_W + 40), y: Math.floor(i / COLS) * 380 };
}

// ---------- nodes ----------
function CopyId({ id }: { id: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="nodrag inline-flex max-w-full items-center gap-1 rounded-[6px] bg-white/10 px-1.5 py-0.5 font-mono text-[11px] hover:bg-white/20"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(id);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
      aria-label={`Copy ID ${id}`}
      title="Copy ID"
    >
      <span className="truncate">{id}</span>
      {ok ? <Check className="size-3 shrink-0" aria-hidden="true" /> : <Copy className="size-3 shrink-0" aria-hidden="true" />}
    </button>
  );
}

const BotNode = memo(function BotNode({ data, selected }: NodeProps<BotNodeT>) {
  const { bot, fresh, dim } = data;
  return (
    <div
      style={{ width: BOT_W }}
      className={`rounded-card bg-midnight p-4 text-white shadow-lg transition-[opacity,box-shadow] ${
        selected ? "ring-2 ring-burly" : fresh ? "ring-2 ring-success" : "ring-1 ring-white/10"
      } ${dim ? "opacity-30" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-burly to-muesli">
          <Bot className="size-4 text-midnight" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={bot.name}>{bot.name}</p>
          <p className="text-[11px] text-white/60">
            {bot.model ?? "model n/a"} · {date(bot.created_at)}
          </p>
        </div>
        {fresh && <span className="ml-auto rounded-full bg-success px-1.5 text-[10px] font-semibold">NEW</span>}
      </div>
      <div className="mt-3">
        <CopyId id={bot.id} />
      </div>
    </div>
  );
});

const statusDot: Record<string, string> = { synced: "bg-success", syncing: "bg-burly", sync_failed: "bg-danger" };

const FolderNode = memo(function FolderNode({ data, selected }: NodeProps<FolderNodeT>) {
  const { folder, docs, expanded, dim, onToggle } = data;
  const list = docs?.docs ?? [];
  const learned = list.filter((d) => d.status === "synced").length;
  return (
    <div
      style={{ width: FOLDER_W }}
      className={`overflow-hidden rounded-card border bg-surface shadow-card transition-[opacity,box-shadow] ${
        selected ? "border-nile ring-2 ring-nile/30" : "border-line"
      } ${dim ? "opacity-30" : ""}`}
    >
      <div className="brand-rule" aria-hidden="true" />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <FolderOpen className="size-4 shrink-0 text-muesli" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-nile" title={folder.name}>{folder.name}</p>
        <span className="rounded-full bg-canvas px-2 text-[11px] font-medium text-muted">
          {docs?.state === "loading" ? "…" : list.length}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(folder.id);
          }}
          className="nodrag rounded-[6px] p-0.5 text-muted hover:bg-canvas hover:text-text"
          aria-label={expanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
        >
          {expanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {docs?.state === "ready" && list.length > 0 && (
        <p className="px-3 pb-1.5 text-[11px] text-muted">
          {learned} learned{list.length - learned ? ` · ${list.length - learned} other` : ""}
        </p>
      )}
      {expanded && (
        <div className="nowheel nodrag max-h-56 overflow-y-auto border-t border-line">
          {docs?.state === "loading" && (
            <p className="flex items-center gap-1.5 px-3 py-3 text-xs text-muted">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading files…
            </p>
          )}
          {docs?.state === "error" && <p className="px-3 py-3 text-xs text-danger">{docs.error}</p>}
          {docs?.state === "ready" && list.length === 0 && <p className="px-3 py-3 text-xs text-muted">Empty folder</p>}
          <ul className="divide-y divide-line">
            {list.map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className={`size-1.5 shrink-0 rounded-full ${statusDot[d.status] ?? "bg-iron"}`} title={d.status} aria-hidden="true" />
                <FileText className="size-3.5 shrink-0 text-nile" aria-hidden="true" />
                {d.content_url ? (
                  <a href={d.content_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs hover:underline" title={d.name}>
                    {d.name}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs" title={d.name}>{d.name}</span>
                )}
                <span className="shrink-0 text-[10px] text-muted">{date(d.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

const nodeTypes = { bot: BotNode, folder: FolderNode } as unknown as NodeTypes;

// ---------- canvas ----------
function Canvas() {
  const { folders, reloadFolders } = useApp();
  const rf = useReactFlow<AnyNode>();
  const [bots, setBots] = useState<CodyBot[]>([]);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, Docs>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [watching, setWatching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNode>([]);
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const loadedOnce = useRef(false);

  // ----- data -----
  const loadBots = useCallback(async () => {
    try {
      const b = await getBots();
      setBots(b);
      setBotsError(null);
      return b;
    } catch (e) {
      setBotsError((e as Error).message);
      return null;
    }
  }, []);

  const loadDocs = useCallback(async (ids: string[]) => {
    setDocs((d) => {
      const n = { ...d };
      ids.forEach((id) => (n[id] = { state: "loading", docs: d[id]?.docs ?? [] }));
      return n;
    });
    let i = 0;
    const worker = async () => {
      while (i < ids.length) {
        const id = ids[i++];
        try {
          const list = await getDocuments([id]);
          setDocs((d) => ({ ...d, [id]: { state: "ready", docs: list } }));
        } catch (e) {
          setDocs((d) => ({ ...d, [id]: { state: "error", docs: [], error: (e as Error).message } }));
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]); // 4 at a time — snappy without hammering Cody
  }, []);

  useEffect(() => {
    positions.current = loadPositions();
    void loadBots();
  }, [loadBots]);

  useEffect(() => {
    const missing = folders.map((f) => f.id).filter((id) => !docs[id]);
    if (missing.length) void loadDocs(missing);
  }, [folders, docs, loadDocs]);

  const refreshAll = async () => {
    await Promise.all([loadBots(), reloadFolders()]);
    void loadDocs(folders.map((f) => f.id));
  };

  const toggle = useCallback((id: string) => setExpanded((e) => ({ ...e, [id]: !(e[id] ?? true) })), []);

  // ----- nodes -----
  const match = useCallback(
    (text: string) => !q.trim() || text.toLowerCase().includes(q.trim().toLowerCase()),
    [q],
  );

  useEffect(() => {
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]));
      const pos = (id: string, kind: "bot" | "folder", i: number) =>
        prevPos.get(id) ?? positions.current[id] ?? defaultPos(kind, i);
      const botNodes: BotNodeT[] = bots.map((b, i) => ({
        id: `bot:${b.id}`,
        type: "bot",
        position: pos(`bot:${b.id}`, "bot", i),
        data: { bot: b, fresh: fresh.has(b.id), dim: !match(`${b.name} ${b.id}`) },
      }));
      const folderNodes: FolderNodeT[] = folders.map((f, i) => {
        const d = docs[f.id];
        const text = `${f.name} ${f.id} ${(d?.docs ?? []).map((x) => x.name).join(" ")}`;
        return {
          id: `folder:${f.id}`,
          type: "folder",
          position: pos(`folder:${f.id}`, "folder", i),
          data: { folder: f, docs: d, expanded: expanded[f.id] ?? true, dim: !match(text), onToggle: toggle },
        };
      });
      return [...botNodes, ...folderNodes];
    });
  }, [bots, folders, docs, expanded, fresh, match, toggle, setNodes]);

  // Fit once when the first data lands.
  useEffect(() => {
    if (!loadedOnce.current && nodes.length > 0) {
      loadedOnce.current = true;
      requestAnimationFrame(() => rf.fitView({ padding: 0.15, duration: 300 }));
    }
  }, [nodes.length, rf]);

  // ----- create bot: open Cody, watch for the new bot -----
  const watchUntil = useRef(0);
  useEffect(() => {
    if (!watching) return;
    const known = new Set(bots.map((b) => b.id));
    const t = setInterval(async () => {
      if (Date.now() > watchUntil.current) {
        setWatching(false);
        return;
      }
      const list = await loadBots();
      const added = (list ?? []).filter((b) => !known.has(b.id));
      if (added.length) {
        setFresh((s) => new Set([...s, ...added.map((b) => b.id)]));
        setToast(`New bot detected: ${added.map((b) => b.name).join(", ")}`);
        setWatching(false);
        setTimeout(() => rf.fitView({ nodes: added.map((b) => ({ id: `bot:${b.id}` })), duration: 400, maxZoom: 1.2 }), 100);
      }
    }, 8000);
    return () => clearInterval(t);
  }, [watching]); // intentionally only re-armed when watching toggles

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const createBot = () => {
    window.open(CODY_LINKS.createBot, "_blank", "noopener");
    watchUntil.current = Date.now() + 10 * 60_000;
    setWatching(true);
  };

  const focusMatches = () => {
    const hits = nodes.filter((n) => !n.data.dim).map((n) => ({ id: n.id }));
    if (hits.length) rf.fitView({ nodes: hits, duration: 350, padding: 0.2, maxZoom: 1.3 });
  };

  const resetLayout = () => {
    positions.current = {};
    savePositions({});
    setNodes((prev) => {
      let b = 0;
      let f = 0;
      return prev.map((n) => ({ ...n, position: n.type === "bot" ? defaultPos("bot", b++) : defaultPos("folder", f++) }));
    });
    requestAnimationFrame(() => rf.fitView({ padding: 0.15, duration: 300 }));
  };

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);
  const totalDocs = Object.values(docs).reduce((s, d) => s + d.docs.length, 0);

  return (
    <div className="relative h-[calc(100dvh-150px)] min-h-[520px] overflow-hidden rounded-card border border-line bg-canvas">
      <ReactFlow<AnyNode>
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        onNodeDragStop={(_, node) => {
          positions.current[node.id] = node.position;
          savePositions(positions.current);
        }}
        onNodeClick={(_, n) => setSelectedId(n.id)}
        onPaneClick={() => setSelectedId(null)}
        minZoom={0.1}
        maxZoom={2}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#c9ced8" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === "bot" ? "#0e192f" : "#be8562")}
          maskColor="rgb(245 246 248 / 0.7)"
          className="!rounded-control !border !border-line"
        />
        <Controls showInteractive={false} className="!rounded-control !border !border-line !shadow-card" />
      </ReactFlow>

      {/* Toolbar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-card border border-line bg-surface/95 p-1 shadow-card backdrop-blur">
          <label className="relative">
            <span className="sr-only">Search bots, folders and files</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && focusMatches()}
              placeholder="Search bots, folders, files"
              className="w-64 rounded-control border border-transparent bg-canvas py-1.5 pl-8 pr-2 text-sm placeholder:text-muted focus:border-line-strong"
            />
          </label>
          <ToolBtn label="Fit to screen" onClick={() => rf.fitView({ padding: 0.15, duration: 300 })} Icon={Maximize} />
          <ToolBtn label="Reset layout" onClick={resetLayout} Icon={LayoutGrid} />
          <ToolBtn label="Refresh from Cody" onClick={() => void refreshAll()} Icon={RefreshCw} />
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-card border border-line bg-surface/95 px-3 py-2 text-xs text-muted shadow-card backdrop-blur">
          <span><strong className="text-text">{bots.length}</strong> bots</span>
          <span><strong className="text-text">{folders.length}</strong> folders</span>
          <span><strong className="text-text">{totalDocs}</strong> files</span>
        </div>

        <button
          type="button"
          onClick={createBot}
          className="pointer-events-auto ml-auto inline-flex items-center gap-1.5 rounded-control bg-nile px-3 py-2 text-sm font-semibold text-white shadow-card hover:bg-midnight"
        >
          {watching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {watching ? "Waiting for new bot…" : "Create bot"}
        </button>
      </div>

      {/* Info strip */}
      <p className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[11px] text-muted shadow-card">
        <Info className="size-3.5 text-muesli" aria-hidden="true" />
        Which folders a bot can use is set in Cody — Cody's API doesn't share it yet. Drag to arrange · scroll to pan · ctrl/⌘+scroll to zoom
      </p>

      {botsError && (
        <p className="absolute left-3 top-16 rounded-control bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
          Bots: {botsError}
        </p>
      )}
      {toast && (
        <p className="absolute left-1/2 top-16 -translate-x-1/2 rounded-control bg-success px-4 py-2 text-sm font-medium text-white shadow-lg" role="status">
          {toast}
        </p>
      )}

      {/* Inspector */}
      {selected && (
        <aside
          aria-label="Details"
          className="absolute bottom-14 right-3 top-16 w-80 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-xl"
        >
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="absolute right-2 top-2 rounded-control p-1 text-muted hover:bg-canvas hover:text-text"
            aria-label="Close details"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          {selected.type === "bot" ? (
            <BotInspector bot={(selected as BotNodeT).data.bot} />
          ) : (
            <FolderInspector folder={(selected as FolderNodeT).data.folder} docs={(selected as FolderNodeT).data.docs} />
          )}
        </aside>
      )}
    </div>
  );
}

function ToolBtn({ label, onClick, Icon }: { label: string; onClick: () => void; Icon: typeof Search }) {
  return (
    <button type="button" onClick={onClick} className="rounded-control p-2 text-muted hover:bg-canvas hover:text-text" aria-label={label} title={label}>
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-2 text-sm">
      <span className="text-muted">{k}</span>
      <span className="min-w-0 truncate text-right font-medium">{v}</span>
    </div>
  );
}

function BotInspector({ bot }: { bot: CodyBot }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Bot</p>
      <h2 className="mt-1 pr-6 font-display text-xl text-nile">{bot.name}</h2>
      <div className="mt-3">
        <Row
          k="ID"
          v={
            <button
              type="button"
              className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
              onClick={() => {
                void navigator.clipboard?.writeText(bot.id);
                setOk(true);
                setTimeout(() => setOk(false), 1200);
              }}
            >
              {bot.id} {ok ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
            </button>
          }
        />
        <Row k="Model" v={bot.model ?? "—"} />
        <Row k="Created" v={date(bot.created_at)} />
      </div>
      <div className="mt-4 rounded-control bg-canvas p-3 text-xs text-muted">
        <p className="font-semibold text-text">Knowledge base folders</p>
        <p className="mt-1">
          Cody sets which folders this bot can read in its own bot settings. The API doesn&apos;t expose or change that yet, so
          edit it in Cody.
        </p>
      </div>
      <a
        href={CODY_LINKS.bots}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-control bg-nile px-3 py-2 text-sm font-semibold text-white hover:bg-midnight"
      >
        Open bots in Cody <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </div>
  );
}

function FolderInspector({ folder, docs }: { folder: CodyFolder; docs?: Docs }) {
  const list = docs?.docs ?? [];
  const count = (s: string) => list.filter((d) => d.status === s).length;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Knowledge base folder</p>
      <h2 className="mt-1 pr-6 font-display text-xl text-nile">{folder.name}</h2>
      <div className="mt-3">
        <Row k="ID" v={<span className="font-mono text-xs">{folder.id}</span>} />
        <Row k="Created" v={date(folder.created_at)} />
        <Row k="Files" v={docs?.state === "loading" ? "…" : list.length} />
        <Row k="Learned" v={<span className="text-success">{count("synced")}</span>} />
        <Row k="Learning" v={count("syncing")} />
        <Row k="Failed" v={<span className="text-danger">{count("sync_failed")}</span>} />
      </div>
      <div className="mt-4 grid gap-2">
        <Link
          href="/board"
          className="inline-flex items-center justify-center gap-1.5 rounded-control bg-nile px-3 py-2 text-sm font-semibold text-white hover:bg-midnight"
        >
          <UploadCloud className="size-4" aria-hidden="true" /> Upload files
        </Link>
        <Link href="/" className="inline-flex items-center justify-center rounded-control border border-line-strong px-3 py-2 text-sm hover:bg-canvas">
          Manage documents
        </Link>
      </div>
    </div>
  );
}

export function BotCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
