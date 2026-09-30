// Cody "Create Document from File" limits (API v1, checked 2026-09-30).
export const ALLOWED_EXTENSIONS = [
  "txt", "md", "rtf", "pdf", "ppt", "pptx", "pptm", "doc", "docx", "docm",
] as const;

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

const MIME_BY_EXT: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  rtf: "application/rtf",
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docm: "application/vnd.ms-word.document.macroEnabled.12",
};

export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function contentTypeFor(file: File) {
  return file.type || MIME_BY_EXT[extOf(file.name)] || "application/octet-stream";
}

/** Returns an error message, or null when the file is accepted. */
export function validateFile(file: File): string | null {
  const ext = extOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return `.${ext || "?"} isn't supported. Use ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_FILE_BYTES) return "File is over Cody's 100 MB limit.";
  if (file.size === 0) return "File is empty.";
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function formatDate(unixSeconds: number) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(unixSeconds * 1000));
}
