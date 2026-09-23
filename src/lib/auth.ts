import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) redirect("/login");

  return { supabase, userId: data.claims.sub };
}

export async function getCurrentOrganization() {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) redirect("/onboarding");

  return { supabase, userId, membership: data };
}
