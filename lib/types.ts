// Shapes mirror the Cody AI API v1 schemas (https://developers.meetcody.ai/source.yaml).

export type CodyFolder = { id: string; name: string; created_at: number };

export type CodyDocumentStatus = "syncing" | "synced" | "sync_failed";

export type CodyDocument = {
  id: string;
  name: string;
  status: CodyDocumentStatus;
  content_url?: string;
  folder_id: string;
  created_at: number; // unix seconds
};

/** Status of one file→folder upload, stored in Neon `upload_logs.status`. */
export type LogStatus =
  | "queued"
  | "uploading"
  | "uploaded" // accepted by Cody, converting (not yet visible as a document)
  | "syncing" // document exists, Cody is learning it
  | "synced" // learned
  | "sync_failed"
  | "error"
  | "timeout";

export const FINAL_STATUSES: LogStatus[] = ["synced", "sync_failed", "error", "timeout"];

export type BatchStatus = "sending" | "learning" | "complete" | "partial" | "failed";

export type UploadLog = {
  id: string;
  batch_id: string;
  created_at: string;
  updated_at: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  folder_id: string;
  folder_name: string | null;
  cody_key?: string | null; // S3 object key from Cody's signed-url step
  cody_document_id: string | null;
  status: LogStatus;
  error: string | null;
  sent_at: string | null;
  learned_at: string | null;
};

export type Batch = {
  id: string;
  created_at: string;
  status: BatchStatus;
  item_count: number;
  completed_at: string | null;
};

/** Client-side queue item: one file going to one folder. */
export type QueueItem = {
  id: string; // client id
  fileId: string; // staged file it came from
  fileName: string;
  size: number;
  contentType: string;
  folderId: string;
  folderName: string;
  status: LogStatus;
  progress: number;
  logId?: string;
  batchNo?: number;
  error?: string;
};
