import { NextResponse } from "next/server";
import { withDb } from "@/lib/api/with-db";
import { listActive, listRecentlyForgotten } from "@/lib/db/queries/preferences";

export const runtime = "nodejs";

// Single owner: `userId` is null. Settings → Memory reads the single-owner
// namespace; demo sessions get their own isolated namespace via withDb.
export async function GET() {
  return withDb(() =>
    NextResponse.json({
      active: listActive(null),
      recentlyForgotten: listRecentlyForgotten(null, 30),
    }),
  );
}
