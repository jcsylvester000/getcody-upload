import type { Metadata } from "next";
import { KanbanBoard } from "@/components/KanbanBoard";

export const metadata: Metadata = { title: "Upload board" };

export default function BoardPage() {
  return <KanbanBoard />;
}
