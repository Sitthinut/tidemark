// Backstop sweep for sessions that never got an explicit close signal — e.g.
// the user closed the browser without starting a new chat. The primary close
// path is real-time on session end (lib/memory/session-close.ts via the /close
// route); this job only catches what that missed.
//
// Finds `active` threads idle longer than `idleDays` and closes each via
// closeSession (extract durable facts + mark idle). Idempotent: a closed thread
// is no longer `active`, so a rerun finds nothing. Safe to schedule or run
// ad-hoc.
import { findIdleThreads } from "../db/queries/chat";
import { type CloseSessionResult, closeSession } from "../memory/session-close";

/** Default idle window before a stale `active` session is force-closed. */
export const DEFAULT_IDLE_DAYS = 7;

export interface CloseStaleResult {
  /** Thread IDs transitioned active → idle this run. */
  closedThreadIds: string[];
  /** Count closed this run (0 on a no-op repeat run). */
  closedCount: number;
  /** Total durable facts extracted across all closed sessions this run. */
  extractedCount: number;
}

export interface CloseStaleOptions {
  /** Idle threshold in days; `active` threads idle longer than this are closed. */
  idleDays?: number;
  /** Single owner: null. Threaded into extraction provenance. */
  userId?: string | null;
  /** Close dependency — injectable for tests. Defaults to the real closeSession. */
  close?: (threadId: string) => Promise<CloseSessionResult>;
}

/**
 * Close every `active` thread idle for more than `idleDays` days.
 *
 * Idempotent by construction — `closeSession` only acts on `active` threads and
 * flips each to `idle`, so a subsequent run finds nothing. Extraction failures
 * never block the close (best-effort, inherited from `closeSession`).
 */
export async function closeStaleSessions(
  options: CloseStaleOptions = {},
): Promise<CloseStaleResult> {
  const idleDays = options.idleDays ?? DEFAULT_IDLE_DAYS;
  const userId = options.userId ?? null;
  const close = options.close ?? ((id: string) => closeSession(id, { userId }));

  const candidates = findIdleThreads(idleDays);
  const closedThreadIds: string[] = [];
  let extractedCount = 0;

  for (const thread of candidates) {
    const result = await close(thread.id);
    if (result.closed) {
      closedThreadIds.push(thread.id);
      extractedCount += result.extraction?.saved.length ?? 0;
    }
  }

  return {
    closedThreadIds,
    closedCount: closedThreadIds.length,
    extractedCount,
  };
}
