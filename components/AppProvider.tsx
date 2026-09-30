"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CodyFolder } from "@/lib/types";
import { createFolder as apiCreateFolder, getFolders } from "@/lib/api";
import { useUploadQueue, type UploadQueue } from "@/hooks/useUploadQueue";

type Ctx = {
  folders: CodyFolder[];
  foldersLoading: boolean;
  foldersError: string | null;
  reloadFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<CodyFolder>;
  queue: UploadQueue;
};

export const AppCtx = createContext<Ctx | null>(null);

/** Folders + upload queue live here so they survive navigation between Uploader and Board. */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<CodyFolder[]>([]);
  const [foldersLoading, setLoading] = useState(true);
  const [foldersError, setError] = useState<string | null>(null);
  const queue = useUploadQueue();

  const reloadFolders = useCallback(async () => {
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
    void reloadFolders();
  }, [reloadFolders]);

  const createFolder = useCallback(async (name: string) => {
    const f = await apiCreateFolder(name);
    setFolders((all) => [...all, f].sort((a, b) => a.name.localeCompare(b.name)));
    return f;
  }, []);

  return (
    <AppCtx.Provider value={{ folders, foldersLoading, foldersError, reloadFolders, createFolder, queue }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}
