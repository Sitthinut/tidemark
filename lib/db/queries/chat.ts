import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../context";
import { chatMessages, chatThreads } from "../schema";

export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatRole = "user" | "assistant" | "tool";

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function listThreads(): ChatThread[] {
  return getDb().select().from(chatThreads).orderBy(desc(chatThreads.updatedAt)).all();
}

export function getThread(id: string): ChatThread | undefined {
  return getDb().select().from(chatThreads).where(eq(chatThreads.id, id)).get();
}

export function createThread(input: { title?: string | null } = {}): ChatThread {
  const now = new Date().toISOString();
  return getDb()
    .insert(chatThreads)
    .values({ id: randomId(), title: input.title ?? null, createdAt: now, updatedAt: now })
    .returning()
    .get();
}

export function renameThread(id: string, title: string): ChatThread | undefined {
  return getDb()
    .update(chatThreads)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(chatThreads.id, id))
    .returning()
    .get();
}

export function deleteThread(id: string): void {
  // chat_messages cascade-delete via foreign key.
  getDb().delete(chatThreads).where(eq(chatThreads.id, id)).run();
}

export function listMessages(threadId: string): ChatMessage[] {
  return getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(chatMessages.createdAt, chatMessages.id)
    .all();
}

export function appendMessage(input: {
  threadId: string;
  role: ChatRole;
  content: string;
  toolCallId?: string | null;
}): ChatMessage {
  const now = new Date().toISOString();
  const row = getDb()
    .insert(chatMessages)
    .values({
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      toolCallId: input.toolCallId ?? null,
      createdAt: now,
    })
    .returning()
    .get();
  // Bump the thread's updatedAt so listThreads() orders by most-recent activity.
  getDb()
    .update(chatThreads)
    .set({ updatedAt: now })
    .where(eq(chatThreads.id, input.threadId))
    .run();
  return row;
}

export function setMessageFeedback(
  id: number,
  threadId: string,
  feedback: "up" | "down" | null,
): ChatMessage | undefined {
  return getDb()
    .update(chatMessages)
    .set({ feedback })
    .where(and(eq(chatMessages.id, id), eq(chatMessages.threadId, threadId)))
    .returning()
    .get();
}
