import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { COOKIE, gateEnabled, verifySession } from "./auth";

/** A 500 that says what went wrong in the log but not to the caller (Notion errors can name internals). */
export function fail(error: unknown, status = 500) {
  console.error(error);
  const message = status >= 500 ? "Something went wrong talking to Notion. Try again." : error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status });
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Owner check inside the route itself. The proxy already guards these paths; this is the second lock, so a
 * matcher mistake can never expose a write.
 */
export async function requireOwner(): Promise<NextResponse | null> {
  if (!gateEnabled()) return null;
  if (await verifySession((await cookies()).get(COOKIE)?.value)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** The JSON body as a plain object, or {} when it isn’t one. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** The same second lock for owner pages: without a session they go to the sign-in page, whatever the proxy did. */
export async function requireOwnerPage(): Promise<void> {
  if (!gateEnabled()) return;
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) redirect("/login");
}
