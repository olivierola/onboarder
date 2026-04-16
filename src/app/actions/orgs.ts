"use server";

import { createClient } from "@/lib/supabase-server";

export async function createOrgAction(name: string, slug: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié — veuillez vous reconnecter." };

  // RLS disabled (migration 015) — insert directly, pass created_by explicitly
  const { data, error } = await supabase
    .from("onboarder_organizations")
    .insert({ name, slug, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Manually add creator as owner (trigger may not fire without RLS context)
  await supabase.from("onboarder_org_members").insert({
    org_id: data.id,
    user_id: user.id,
    role: "owner",
  });

  return { data };
}

export async function getUserOrgsAction() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié", data: null };

  // Filter by user_id in app code (RLS disabled)
  const { data, error } = await supabase
    .from("onboarder_org_members")
    .select("role, org:onboarder_organizations(id, name, slug, created_at)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (error) return { error: error.message, data: null };

  return {
    data: (data ?? []).map((m: any) => ({ ...m.org, role: m.role })),
    userId: user.id,
    email: user.email ?? "",
  };
}
