import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — server only, never sent to the browser
const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(
  req : NextRequest,
  ctx : { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;

  // 1. Verify a valid session exists (anon key client)
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const anonDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user } } = await anonDb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Fetch latest tree version metadata
  const { data: version, error: vErr } = await adminDb
    .from("cognitive_tree_versions")
    .select("id, version, framework, stats, storage_path, timestamp")
    .eq("project_id", projectId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (vErr)    return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (!version) return NextResponse.json({ error: "No tree found" },  { status: 404 });

  // 3. Download JSON from Storage
  const { data: fileData, error: dlErr } = await adminDb
    .storage
    .from("cognitive-trees")
    .download(version.storage_path);

  if (dlErr || !fileData)
    return NextResponse.json({ error: dlErr?.message ?? "Download failed" }, { status: 500 });

  const treeJson = await fileData.text();
  const tree = JSON.parse(treeJson);

  return NextResponse.json({ version, tree }, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
