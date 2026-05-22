"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { invalidate, useResource } from "@/lib/fetchers/swr";

interface ThreadRow {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BucketedThread {
  bucket: "Today" | "Yesterday" | "Last 7 days" | "Last 30 days" | "Older";
  threads: ThreadRow[];
}

function bucketize(threads: ThreadRow[]): BucketedThread[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60_000;
  const today: ThreadRow[] = [];
  const yesterday: ThreadRow[] = [];
  const lastWeek: ThreadRow[] = [];
  const lastMonth: ThreadRow[] = [];
  const older: ThreadRow[] = [];
  for (const t of threads) {
    const age = now - Date.parse(t.updatedAt);
    if (age < dayMs) today.push(t);
    else if (age < 2 * dayMs) yesterday.push(t);
    else if (age < 7 * dayMs) lastWeek.push(t);
    else if (age < 30 * dayMs) lastMonth.push(t);
    else older.push(t);
  }
  const buckets: BucketedThread[] = [];
  if (today.length) buckets.push({ bucket: "Today", threads: today });
  if (yesterday.length) buckets.push({ bucket: "Yesterday", threads: yesterday });
  if (lastWeek.length) buckets.push({ bucket: "Last 7 days", threads: lastWeek });
  if (lastMonth.length) buckets.push({ bucket: "Last 30 days", threads: lastMonth });
  if (older.length) buckets.push({ bucket: "Older", threads: older });
  return buckets;
}

function titleFor(t: ThreadRow): string {
  if (t.title?.trim()) return t.title;
  return "Untitled chat";
}

export interface ChatThreadListProps {
  open: boolean;
  onClose: () => void;
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function ChatThreadList({
  open,
  onClose,
  activeThreadId,
  onSelect,
  onNewChat,
}: ChatThreadListProps) {
  const { data, isLoading, error } = useResource<ThreadRow[]>(open ? "/api/chat/threads" : null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const buckets = data ? bucketize(data) : [];

  const handleDelete = async (id: string, title: string) => {
    const ok = window.confirm(`Delete "${title}"? This can't be undone.`);
    if (!ok) return;
    const res = await fetch(`/api/chat/threads/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      window.alert(`Failed to delete (${res.status})`);
      return;
    }
    await invalidate("/api/chat/threads");
    if (id === activeThreadId) {
      onNewChat();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close thread list"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.32)",
          border: 0,
          padding: 0,
          zIndex: 60,
          cursor: "pointer",
        }}
      />
      {/* Drawer */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(320px, 88vw)",
          background: "var(--bg)",
          borderRight: "1px solid var(--line)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
          boxShadow: "8px 0 24px rgba(0,0,0,0.12)",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              flex: 1,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "var(--muted)",
            }}
          >
            CHATS
          </div>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            title="Start a new conversation"
            style={{ gap: 4 }}
          >
            <Icon name="sparkle" size={12} /> New
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: "4px 8px" }}
          >
            ✕
          </button>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {isLoading && (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--muted)" }}>Loading…</div>
          )}
          {error && (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--danger, #c33)" }}>
              Couldn't load threads.
            </div>
          )}
          {!isLoading && !error && buckets.length === 0 && (
            <div style={{ padding: "16px", fontSize: 13, color: "var(--muted)" }}>
              No saved chats yet. Start a conversation and it'll appear here.
            </div>
          )}
          {buckets.map((b) => (
            <div key={b.bucket} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  padding: "8px 16px 4px",
                  textTransform: "uppercase",
                }}
              >
                {b.bucket}
              </div>
              {b.threads.map((t) => {
                const isActive = t.id === activeThreadId;
                const title = titleFor(t);
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 8px 6px 16px",
                      background: isActive ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(t.id);
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        textAlign: "left",
                        background: "transparent",
                        border: 0,
                        color: isActive ? "var(--accent-ink)" : "var(--ink)",
                        fontSize: 13.5,
                        lineHeight: 1.35,
                        padding: "4px 4px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={title}
                    >
                      {title}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id, title)}
                      aria-label={`Delete ${title}`}
                      title="Delete"
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "var(--muted)",
                        cursor: "pointer",
                        padding: "4px 8px",
                        fontSize: 14,
                        opacity: 0.7,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
