import { NextResponse } from "next/server";
import { readBody } from "@/lib/api";
import { COOKIE, checkPassword, createSession } from "@/lib/auth";

// Slows password guessing: a handful of tries per address per window. Kept in memory, so it is per server instance
// (best effort on serverless); the password should still be long.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 8;
const tries = new Map<string, { count: number; resetAt: number }>();

function throttled(key: string, now = Date.now()): boolean {
  const entry = tries.get(key);
  if (!entry || entry.resetAt < now) {
    if (tries.size > 5000) tries.clear();
    tries.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_TRIES;
}

export async function POST(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(address)) return NextResponse.json({ error: "Too many tries. Wait ten minutes." }, { status: 429 });

  const { password } = await readBody(request);
  if (typeof password !== "string" || !password || password.length > 512 || !(await checkPassword(password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  tries.delete(address);
  const { value, maxAge } = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}
