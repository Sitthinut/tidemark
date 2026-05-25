import { NextResponse } from "next/server";
import { withDb } from "@/lib/api/with-db";
import { listBuckets } from "@/lib/db/queries/buckets";
import { renameHoldingSource } from "@/lib/db/queries/holdings";

// Rename a `source` label across all of the caller's holdings. Scoped to the
// user's own buckets (listBuckets is user-scoped), so it can never touch
// another user's rows. Empty `to` clears the label.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { from?: unknown; to?: unknown } | null;
  const from = typeof body?.from === "string" ? body.from.trim() : "";
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!from) {
    return NextResponse.json({ error: "missing_from" }, { status: 400 });
  }
  return withDb(() => {
    const bucketIds = listBuckets().map((b) => b.id);
    const renamed = renameHoldingSource(bucketIds, from, to);
    return NextResponse.json({ renamed });
  });
}
