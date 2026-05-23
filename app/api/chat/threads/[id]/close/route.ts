import { NextResponse } from "next/server";
import { withDb } from "@/lib/api/with-db";
import { closeSession } from "@/lib/memory/session-close";

export const runtime = "nodejs";

/**
 * Close a chat session in real time: extract durable facts, then mark idle.
 * `POST /api/chat/threads/[id]/close` — called by the client when the user
 * starts a new chat or switches threads. Idempotent and best-effort (a
 * non-active or missing thread returns `{ closed: false }`, never an error), so
 * the client can fire-and-forget without handling failure.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Pre-Phase-6: single owner (userId null). Phase 6 resolves the user here.
  const result = await withDb(() => closeSession(id, { userId: null }));
  return NextResponse.json({
    closed: result.closed,
    extractedCount: result.extraction?.saved.length ?? 0,
  });
}
