import { CheckCircle2, CircleAlert, Clock, Loader2, UploadCloud } from "lucide-react";
import type { LogStatus } from "@/lib/types";

type S = LogStatus | "complete" | "partial" | "failed" | "sending" | "learning";

const MAP: Record<S, { label: string; cls: string; Icon: typeof CheckCircle2; spin?: boolean }> = {
  queued: { label: "In queue", cls: "bg-canvas text-muted", Icon: Clock },
  uploading: { label: "Uploading", cls: "bg-nile-soft text-nile", Icon: Loader2, spin: true },
  sending: { label: "Sending", cls: "bg-nile-soft text-nile", Icon: Loader2, spin: true },
  uploaded: { label: "Sent · converting", cls: "bg-muesli-soft text-muesli-text", Icon: UploadCloud },
  syncing: { label: "Learning", cls: "bg-warning-soft text-warning", Icon: Loader2, spin: true },
  learning: { label: "Learning", cls: "bg-warning-soft text-warning", Icon: Loader2, spin: true },
  synced: { label: "Learned", cls: "bg-success-soft text-success", Icon: CheckCircle2 },
  complete: { label: "All learned", cls: "bg-success-soft text-success", Icon: CheckCircle2 },
  partial: { label: "Partly learned", cls: "bg-warning-soft text-warning", Icon: CircleAlert },
  sync_failed: { label: "Learning failed", cls: "bg-danger-soft text-danger", Icon: CircleAlert },
  failed: { label: "Failed", cls: "bg-danger-soft text-danger", Icon: CircleAlert },
  error: { label: "Failed", cls: "bg-danger-soft text-danger", Icon: CircleAlert },
  timeout: { label: "Timed out", cls: "bg-danger-soft text-danger", Icon: CircleAlert },
};

export function StatusBadge({ status }: { status: S | string }) {
  const m = MAP[status as S] ?? MAP.queued;
  const { label, cls, Icon, spin } = m;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className={`size-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden="true" />
      {label}
    </span>
  );
}
