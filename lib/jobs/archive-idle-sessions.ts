// Idle-session archive job (Phase 5b, task #1).
//
// Finds `active` chat threads with no activity for more than `idleDays` days
// and moves them to the `archived` lifecycle state. Idempotent: a thread that
// is already idle/archived (or trashed) is never re-touched, because
// `findIdleThreads` only returns `status = 'active'`, non-deleted rows. Running
// the job twice in a row archives nothing the second time.
//
// This is the lifecycle skeleton only. The summarize-the-chat + extract-durable
// -facts step (writing `user_preferences` rows with `source='extracted'`) is
// Phase 5b task #2 — see the clearly-marked TODO hook below. Do NOT implement
// extraction here.
import { archiveThread, findIdleThreads } from "../db/queries/chat";

/** Default idle window before a session is archived. */
export const DEFAULT_IDLE_DAYS = 7;

export interface ArchiveIdleResult {
  /** Thread IDs that were transitioned active → archived this run. */
  archivedThreadIds: string[];
  /** Count of threads archived this run (0 on a no-op repeat run). */
  archivedCount: number;
}

export interface ArchiveIdleOptions {
  /** Idle threshold in days; threads idle longer than this are archived. */
  idleDays?: number;
}

/**
 * Archive every `active` thread idle for more than `idleDays` days.
 *
 * Idempotent by construction — only `active` threads are candidates, and each
 * is flipped to `archived` in the same run, so a subsequent run finds nothing.
 * Safe to schedule on a cron or invoke ad-hoc.
 */
export function archiveIdleSessions(options: ArchiveIdleOptions = {}): ArchiveIdleResult {
  const idleDays = options.idleDays ?? DEFAULT_IDLE_DAYS;
  const candidates = findIdleThreads(idleDays);
  const archivedThreadIds: string[] = [];

  for (const thread of candidates) {
    // TODO(#2 archive-time extractor): before archiving, run the cheap-model
    // summarize + durable-fact extraction pass over this thread's messages and
    // persist a session summary + 0–N `user_preferences` rows with
    // `source='extracted'` and provenance (sourceSessionId = thread.id). That
    // step is owned by Phase 5b task #2 — do NOT implement it here. The archive
    // transition below must remain the last step so a failed extraction does
    // not prematurely mark the thread archived.

    const archived = archiveThread(thread.id);
    if (archived) archivedThreadIds.push(archived.id);
  }

  return { archivedThreadIds, archivedCount: archivedThreadIds.length };
}
