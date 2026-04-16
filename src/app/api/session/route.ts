import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server";

/**
 * GET /api/session?endUserId=xxx
 * Returns the current session state for a given end-user.
 */
export async function GET(req: NextRequest) {
  try {
    const db = createServiceClient();
    const wsId = getWorkspaceId();
    const endUserId = req.nextUrl.searchParams.get("endUserId");

    if (!endUserId) {
      return NextResponse.json({ error: "Missing endUserId" }, { status: 400 });
    }

    const { data: session } = await db
      .from("onboarder_sessions")
      .select("*")
      .eq("workspace_id", wsId)
      .eq("end_user_id", endUserId)
      .maybeSingle();

    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * GET /api/session/list — list all sessions for the workspace (paginated)
 */
export async function POST(req: NextRequest) {
  try {
    const db = createServiceClient();
    const wsId = getWorkspaceId();

    const { page = 0, limit = 50, activated }: {
      page?: number;
      limit?: number;
      activated?: boolean;
    } = await req.json().catch(() => ({}));

    let query = db
      .from("onboarder_sessions")
      .select("id, end_user_id, activated, completed_steps, conversation_turns, last_active_at, created_at", {
        count: "exact",
      })
      .eq("workspace_id", wsId)
      .order("last_active_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (activated !== undefined) {
      query = query.eq("activated", activated);
    }

    const { data: sessions, count } = await query;

    return NextResponse.json({ sessions, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
