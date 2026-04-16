import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server";

/**
 * POST /api/feedback
 * Dashboard-side feedback endpoint (e.g. marking chunks as low quality manually).
 * The snippet sends feedback directly to the Supabase Edge Function.
 * This route is for the dashboard UI if needed.
 */
export async function POST(req: NextRequest) {
  try {
    const db = createServiceClient();
    const wsId = getWorkspaceId();

    const { chunkIds, wasHelpful, correction }: {
      chunkIds: string[];
      wasHelpful: boolean;
      correction?: string;
    } = await req.json();

    if (!chunkIds?.length) {
      return NextResponse.json({ error: "Missing chunkIds" }, { status: 400 });
    }

    // Verify chunks belong to this workspace
    const { data: chunks } = await db
      .from("onboarder_chunks")
      .select("id")
      .eq("workspace_id", wsId)
      .in("id", chunkIds);

    const validIds = (chunks ?? []).map((c) => c.id);
    if (!validIds.length) {
      return NextResponse.json({ error: "No valid chunk IDs" }, { status: 404 });
    }

    // Insert feedback
    await db.from("onboarder_chunk_feedback").insert(
      validIds.map((chunkId) => ({
        chunk_id: chunkId,
        session_id: "dashboard",
        was_helpful: wasHelpful,
        correction: correction ?? null,
      }))
    );

    // Update metadata feedback_boost on each chunk
    for (const chunkId of validIds) {
      const { data: chunk } = await db
        .from("onboarder_chunks")
        .select("metadata")
        .eq("id", chunkId)
        .maybeSingle();

      const meta = (chunk?.metadata as Record<string, number>) ?? {};
      const helpfulCount = (meta.helpful_count ?? 0) + (wasHelpful ? 1 : 0);
      const notHelpfulCount = (meta.not_helpful_count ?? 0) + (wasHelpful ? 0 : 1);
      const total = helpfulCount + notHelpfulCount;
      const helpfulRate = total > 0 ? helpfulCount / total : 0.5;
      const feedbackBoost = 0.8 + helpfulRate * 0.4;

      await db
        .from("onboarder_chunks")
        .update({
          metadata: {
            ...meta,
            helpful_count: helpfulCount,
            not_helpful_count: notHelpfulCount,
            feedback_boost: Math.round(feedbackBoost * 1000) / 1000,
          },
        })
        .eq("id", chunkId);
    }

    return NextResponse.json({ ok: true, processed: validIds.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * GET /api/feedback?chunkId=xxx
 * Returns feedback stats for a specific chunk.
 */
export async function GET(req: NextRequest) {
  try {
    const db = createServiceClient();
    const wsId = getWorkspaceId();
    const chunkId = req.nextUrl.searchParams.get("chunkId");

    if (!chunkId) {
      return NextResponse.json({ error: "Missing chunkId" }, { status: 400 });
    }

    const [{ count: helpful }, { count: notHelpful }] = await Promise.all([
      db
        .from("onboarder_chunk_feedback")
        .select("*", { count: "exact", head: true })
        .eq("chunk_id", chunkId)
        .eq("was_helpful", true),
      db
        .from("onboarder_chunk_feedback")
        .select("*", { count: "exact", head: true })
        .eq("chunk_id", chunkId)
        .eq("was_helpful", false),
    ]);

    return NextResponse.json({
      chunkId,
      helpful: helpful ?? 0,
      notHelpful: notHelpful ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
