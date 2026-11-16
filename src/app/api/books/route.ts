import { NextResponse } from "next/server";
import { fail, requireOwner } from "@/lib/api";
import { getLibrary } from "@/lib/library";

/** Owner only: the whole catalog with Notion page ids, which the progress logger writes to. */
export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    return NextResponse.json({ books: await getLibrary() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
