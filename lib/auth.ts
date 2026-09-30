// Shared by proxy.ts and /api/login. Works in Node and edge runtimes (Web Crypto).
export const AUTH_COOKIE = "grid_cody_session";

/**
 * Access code. Hardcoded default per client request (2026-09-30).
 * Override without a code change by setting APP_PASSWORD in .env.local / Netlify.
 */
export const DEFAULT_ACCESS_CODE = "412099";
export const accessCode = () => process.env.APP_PASSWORD || DEFAULT_ACCESS_CODE;

export async function sessionToken(password: string) {
  const data = new TextEncoder().encode(`grid-cody-uploader:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
