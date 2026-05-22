import { NextResponse } from "next/server";
import { withDb } from "@/lib/api/with-db";
import { createThread, listThreads } from "@/lib/db/queries/chat";

export const runtime = "nodejs";

export async function GET() {
  return withDb(() => NextResponse.json(listThreads()));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: string | null };
  return withDb(() =>
    NextResponse.json(createThread({ title: body.title ?? null }), { status: 201 }),
  );
}
