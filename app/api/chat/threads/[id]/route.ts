import { NextResponse } from "next/server";
import { withDb } from "@/lib/api/with-db";
import { deleteThread, getThread, listMessages, renameThread } from "@/lib/db/queries/chat";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withDb(() => {
    const thread = getThread(id);
    if (!thread) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ thread, messages: listMessages(id) });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  if (typeof body.title !== "string") {
    return NextResponse.json({ error: "expected_title" }, { status: 400 });
  }
  return withDb(() => {
    const row = renameThread(id, body.title!);
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(row);
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withDb(() => {
    deleteThread(id);
    return new NextResponse(null, { status: 204 });
  });
}
