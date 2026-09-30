// Shared by proxy.ts and /api/login. Works in both Node and edge runtimes (Web Crypto).
export const AUTH_COOKIE = "grid_cody_session";

export async function sessionToken(password: string) {
  const data = new TextEncoder().encode(`grid-cody-uploader:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
