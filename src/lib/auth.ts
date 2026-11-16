// Web Crypto only, so this runs in both the proxy and route handlers.
export const COOKIE = "rl_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

async function hmac(message: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Pages and endpoints open to visitors: the read-only catalog. Everything else is owner-only. */
const PUBLIC_PATHS = ["/", "/login", "/api/login", "/api/logout", "/api/me"];
export const isPublicPath = (pathname: string) => PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/book/");

/** With no APP_PASSWORD the gate is open in development and closed in production. */
export const gateEnabled = () => Boolean(process.env.APP_PASSWORD) || process.env.NODE_ENV === "production";

export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected || !process.env.SESSION_SECRET) return false;
  // Compare digests so the comparison time doesn’t depend on where strings differ.
  return equal(await hmac(`pw:${candidate}`), await hmac(`pw:${expected}`));
}

export async function createSession(now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(now / 1000) + MAX_AGE_S;
  return { value: `${exp}.${await hmac(`session:${exp}`)}`, maxAge: MAX_AGE_S };
}

export async function verifySession(value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value || !process.env.SESSION_SECRET) return false;
  const [exp, sig, ...rest] = value.split(".");
  if (!exp || !sig || rest.length > 0 || !/^\d+$/.test(exp) || Number(exp) < now / 1000) return false;
  return equal(sig, await hmac(`session:${exp}`));
}

/**
 * A request that changes something must come from this site’s own pages. Browsers send Origin on every
 * cross-site POST/PATCH, so a form on another site can’t ride the owner’s cookie.
 */
export function sameOrigin(request: { method: string; headers: Headers; nextUrl: { host: string } }): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true; // not a browser cross-site request (curl, same-origin fetch in old browsers)
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host);
  } catch {
    return false;
  }
}
