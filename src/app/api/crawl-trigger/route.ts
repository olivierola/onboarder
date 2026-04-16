import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

/**
 * POST /api/crawl-trigger
 * Triggers a crawl job for the current workspace.
 * The knowledge-builder is a standalone CLI tool; this endpoint records
 * a crawl_requested event so the dashboard can track status,
 * and can optionally invoke an external crawl service via webhook.
 */
export async function POST(req: NextRequest) {
  try {
    const db = createServiceClient();
    const wsId = getWorkspaceId();

    const body = await req.json().catch(() => ({}));
    const targetUrl: string | undefined = body.targetUrl;

    // Fetch workspace app_url as fallback
    const { data: config } = await db
      .from("onboarder_configs")
      .select("app_url")
      .eq("workspace_id", wsId)
      .maybeSingle();

    const url = targetUrl ?? config?.app_url ?? "";

    if (!url) {
      return NextResponse.json(
        { error: "No target URL configured. Set app_url in Configuration first." },
        { status: 400 }
      );
    }

    // Validate URL before proceeding
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return NextResponse.json({ error: "Invalid target URL protocol." }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
    }

    // Log crawl_requested event
    await db.from("onboarder_events").insert({
      workspace_id: wsId,
      event_type: "crawl_requested",
      payload: { target_url: url, requested_at: new Date().toISOString() },
    });

    // Optional: forward to an external crawl webhook (e.g., a Supabase Edge Function
    // that spins up a Playwright browser in a container)
    const crawlWebhookUrl = process.env.CRAWL_WEBHOOK_URL;
    if (crawlWebhookUrl) {
      try {
        const webhookRes = await fetch(crawlWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ workspaceId: wsId, targetUrl: url }),
        });
        if (!webhookRes.ok) {
          console.error(`[crawl-trigger] Webhook responded ${webhookRes.status}`);
        }
      } catch (webhookErr) {
        // Non-fatal: event was already logged; webhook failure is logged but doesn't block the response
        console.error("[crawl-trigger] Webhook fetch failed:", webhookErr);
      }
    }

    revalidatePath("/dashboard/knowledge");

    return NextResponse.json({
      ok: true,
      message: crawlWebhookUrl
        ? "Crawl déclenché — rafraîchissez la page dans quelques minutes."
        : "Crawl demandé. Lancez `npm run crawl` dans knowledge-builder/ pour indexer votre app.",
      targetUrl: url,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
