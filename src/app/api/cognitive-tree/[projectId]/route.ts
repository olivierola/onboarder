// This route is no longer used.
// The knowledge page now reads cognitive_tree_versions directly via the
// authenticated Supabase client (RLS migration 026 grants access),
// then calls createSignedUrl() to download the tree JSON from Storage.
//
// Kept as a stub to avoid 404s from any cached references.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Use client-side Supabase signed URL instead" }, { status: 410 });
}
