// Idle-session archive job (Phase 5b, tasks #1 + #2).
//
// Finds `active` chat threads with no activity for more than `idleDays` days
// and moves them to the `archived` lifecycle state. Idempotent: a thread that
// is already idle/archived (or trashed) is never re-touched, because
// `findIdleThreads` only returns `status = 'active'`, non-deleted rows. Running
// the job twice in a row archives nothing the second time.
//
// Before each archive transition we run the archive-time extractor (#2):
// summarize the chat and persist durable facts to `user_preferences` with
// `source='extracted'`. Extraction is best-effort — it never throws, so a
// model outage or missing API key still lets the thread archive cleanly.
import { archiveThread, findIdleThreads } from "../db/queries/chat";
import { type ExtractionResult, extractSessionPreferences } from "../memory/extract";

/** Default idle window before a session is archived. */
export const DEFAULT_IDLE_DAYS = 7;

/** A user-facing notice for one archived session — feeds a toast / digest. */
export interface ArchiveNotice {
  threadId: string;
  /** Session summary from the extractor (may be empty if extraction skipped). */
  summary: string;
  /** How many durable facts were saved to memory from this session. */
  savedCount: number;
}

export interface ArchiveIdleResult {
  /** Thread IDs that were transitioned active → archived this run. */
  archivedThreadIds: string[];
  /** Count of threads archived this run (0 on a no-op repeat run). */
  archivedCount: number;
  /** Total durable facts extracted across all archived sessions this run. */
  extractedCount: number;
  /** Per-session notices for surfacing a toast / digest to the user. */
  notices: ArchiveNotice[];
}

export interface ArchiveIdleOptions {
  /** Idle threshold in days; threads idle longer than this are archived. */
  idleDays?: number;
  /** Pre-Phase-6 single owner: null. Threaded into extraction provenance. */
  userId?: string | null;
  /**
   * Extraction dependency — injectable for tests. Defaults to the real
   * archive-time extractor. Must be side-effect-tolerant (never throw).
   */
  extract?: (threadId: string) => Promise<ExtractionResult>;
}

/**
 * Archive every `active` thread idle for more than `idleDays` days, running the
 * archive-time extractor on each first.
 *
 * Idempotent by construction — only `active` threads are candidates, and each
 * is flipped to `archived` in the same run, so a subsequent run finds nothing.
 * Extraction runs BEFORE the archive transition but its failure never blocks
 * archival. Safe to schedule on a cron or invoke ad-hoc.
 */
export async function archiveIdleSessions(
  options: ArchiveIdleOptions = {},
): Promise<ArchiveIdleResult> {
  const idleDays = options.idleDays ?? DEFAULT_IDLE_DAYS;
  const userId = options.userId ?? null;
  const extract =
    options.extract ?? ((threadId: string) => extractSessionPreferences(threadId, { userId }));

  const candidates = findIdleThreads(idleDays);
  const archivedThreadIds: string[] = [];
  const notices: ArchiveNotice[] = [];
  let extractedCount = 0;

  for (const thread of candidates) {
    // Summarize + extract durable facts before archiving. Best-effort: the
    // extractor swallows its own errors and returns a `skipped` result, so a
    // failure here never prevents the archive transition below.
    let extraction: ExtractionResult | undefined;
    try {
      extraction = await extract(thread.id);
    } catch {
      // Defensive — a custom extractor that throws shouldn't strand the thread.
      extraction = undefined;
    }
    if (extraction) {
      extractedCount += extraction.saved.length;
      notices.push({
        threadId: thread.id,
        summary: extraction.summary,
        savedCount: extraction.saved.length,
      });
    }

    const archived = archiveThread(thread.id);
    if (archived) archivedThreadIds.push(archived.id);
  }

  return {
    archivedThreadIds,
    archivedCount: archivedThreadIds.length,
    extractedCount,
    notices,
  };
}
