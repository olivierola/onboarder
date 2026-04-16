import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL      = "gemini-embedding-001";
const EMBED_DIMS        = 768;
const MAX_PAGES         = 30;

// ─── HTML utilities ─────────────────────────────────────────────

function textOnly(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return (m?.[1] ?? "").trim().slice(0, 120) || "Page";
}

function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const rx   = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    try {
      const u    = new URL(m[1], baseUrl);
      const href = u.origin + u.pathname;
      if (
        u.hostname === base.hostname &&
        !href.match(/\.(pdf|png|jpg|jpeg|gif|svg|ico|css|js|woff2?)$/i)
      ) seen.add(href);
    } catch { /* ignore */ }
  }
  return Array.from(seen);
}

interface UIElement { label: string; type: string }

function extractElements(html: string): UIElement[] {
  const out: UIElement[] = [];
  const add = (type: string, raw: string) => {
    const label = textOnly(raw).trim().slice(0, 80);
    if (label.length > 2) out.push({ type, label });
  };
  let m: RegExpExecArray | null;

  const btnRx = /<button([^>]*)>([\s\S]*?)<\/button>/gi;
  while ((m = btnRx.exec(html)) !== null) {
    const aria = m[1].match(/aria-label="([^"]+)"/i)?.[1];
    add("button", aria ?? m[2]);
  }
  const hRx = /<h([123])[^>]*>([\s\S]*?)<\/h\1>/gi;
  while ((m = hRx.exec(html)) !== null) add(`h${m[1]}`, m[2]);
  const labelRx = /<label[^>]*>([\s\S]*?)<\/label>/gi;
  while ((m = labelRx.exec(html)) !== null) add("label", m[2]);
  const navRx = /<(?:nav|aside)[^>]*>([\s\S]*?)<\/(?:nav|aside)>/gi;
  while ((m = navRx.exec(html)) !== null) {
    const aRx = /<a[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = aRx.exec(m[1])) !== null) add("nav-link", am[1]);
  }
  const seen = new Set<string>();
  return out
    .filter(e => { if (seen.has(e.label)) return false; seen.add(e.label); return true; })
    .slice(0, 25);
}

async function embed(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) return [];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text: text.slice(0, 2000) }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBED_DIMS,
      }),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.embedding?.values as number[]) ?? [];
}

// ─── Handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { projectId, crawlUrl, maxPages: bodyMaxPages } = await req.json();

  if (!projectId || !crawlUrl) {
    return NextResponse.json({ error: "Missing projectId or crawlUrl" }, { status: 400 });
  }
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not set in .env.local" },
      { status: 500 }
    );
  }

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  // Load project config to get maxPages
  const { data: projectData } = await db
    .from("onboarder_projects")
    .select("config")
    .eq("id", projectId)
    .maybeSingle();
  const cfg = (projectData?.config ?? {}) as Record<string, unknown>;
  const maxPages: number = bodyMaxPages ?? (typeof cfg.maxPages === "number" ? cfg.maxPages : MAX_PAGES);

  log(`[INFO] Local crawl started: ${crawlUrl} (project ${projectId}, maxPages: ${maxPages})`);

  // Mark as crawling
  await db.from("onboarder_projects").update({
    status: "crawling",
    error_message: null,
    routes_crawled: [],
    chunk_count: 0,
  }).eq("id", projectId);

  const baseUrl  = crawlUrl.replace(/\/$/, "");
  const visited  = new Set<string>();
  const toVisit  = [baseUrl];
  const pageData: Array<{ url: string; title: string; elements: UIElement[]; pageText: string }> = [];
  const fetchErrors: string[] = [];

  while (toVisit.length > 0 && visited.size < maxPages) {
    const url = toVisit.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    log(`[DEBUG] Fetching ${url} (visited: ${visited.size}, queue: ${toVisit.length})`);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "OnboarderBot/1.0",
          Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });

      const ct = res.headers.get("content-type") ?? "";
      log(`[INFO] HTTP ${res.status} ${ct} — ${url}`);

      if (!res.ok) { fetchErrors.push(`${url} → HTTP ${res.status}`); continue; }
      if (!ct.includes("html")) { log(`[WARN] Skipping non-HTML: ${url}`); continue; }

      const html = await res.text();
      log(`[DEBUG] HTML size: ${html.length} chars — preview: ${html.slice(0, 80).replace(/\s+/g, " ")}`);

      if (html.length < 100) {
        fetchErrors.push(`${url} → HTML too short (${html.length} chars)`);
        continue;
      }

      const title    = extractTitle(html);
      const elements = extractElements(html);
      const pageText = textOnly(html).slice(0, 3000);
      const links    = extractLinks(html, res.url ?? url);

      log(`[INFO] Parsed ${url}: title="${title}" elements=${elements.length} links=${links.length}`);

      if (elements.length === 0) {
        log(`[WARN] No elements — this might be a client-side SPA (empty shell). SSR/static pages work best.`);
      }

      pageData.push({ url, title, elements, pageText });
      for (const link of links) {
        if (!visited.has(link) && !toVisit.includes(link)) toVisit.push(link);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[ERROR] Fetch failed ${url}: ${msg}`);
      fetchErrors.push(`${url} → ${msg}`);
    }
  }

  log(`[INFO] Crawl phase done: ${pageData.length} pages, ${fetchErrors.length} errors`);

  if (pageData.length === 0) {
    await db.from("onboarder_projects").update({
      status: "error",
      error_message: fetchErrors.slice(0, 3).join(" | ") || "No pages crawled",
    }).eq("id", projectId);
    return NextResponse.json({ error: "No pages crawled", details: fetchErrors, logs }, { status: 422 });
  }

  // Embed + upsert
  let totalChunks = 0;
  const routesCrawled: string[] = [];

  for (const page of pageData) {
    const path = new URL(page.url).pathname;
    routesCrawled.push(path);
    const rows: Record<string, unknown>[] = [];

    // Page chunk
    const pageText = `Route: ${path} | Page: ${page.title} | Éléments: ${page.elements.map(e => e.label).slice(0, 8).join(", ")}`;
    const pageEmb  = await embed(pageText);
    if (pageEmb.length) {
      rows.push({
        project_id: projectId, workspace_id: "default",
        chunk_type: "page", route: path, route_title: page.title,
        content: `Page ${path}: ${page.title}. ${page.pageText.slice(0, 300)}`,
        chunk_text: pageText, embedding: pageEmb,
        metadata: { element_count: page.elements.length },
        updated_at: new Date().toISOString(),
      });
    }

    // Element chunks
    for (const el of page.elements) {
      const ct  = `Route: ${path} | Page: ${page.title} | Élément: ${el.label} | Type: ${el.type}`;
      const emb = await embed(ct);
      if (!emb.length) continue;
      rows.push({
        project_id: projectId, workspace_id: "default",
        chunk_type: "element", route: path, route_title: page.title,
        label: el.label, element_type: el.type,
        content: `${el.type === "button" ? "Bouton" : el.type} "${el.label}" sur ${path}.`,
        chunk_text: ct, embedding: emb,
        metadata: {}, updated_at: new Date().toISOString(),
      });
    }

    if (!rows.length) { log(`[WARN] No rows for ${path}`); continue; }

    log(`[INFO] Upserting ${rows.length} chunks for ${path}`);
    const { error } = await db.from("onboarder_chunks").upsert(rows, { onConflict: "upsert_key" });
    if (error) log(`[ERROR] Upsert ${path}: ${error.message}`);
    else totalChunks += rows.length;
  }

  await db.from("onboarder_projects").update({
    status: "ready",
    chunk_count: totalChunks,
    routes_crawled: routesCrawled,
    last_crawled_at: new Date().toISOString(),
    error_message: null,
  }).eq("id", projectId);

  log(`[INFO] Done: ${totalChunks} chunks across ${pageData.length} pages`);

  return NextResponse.json({ ok: true, pages: pageData.length, chunks: totalChunks, routes: routesCrawled, logs });
}
