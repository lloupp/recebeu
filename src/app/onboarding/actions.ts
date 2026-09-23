"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const document = String(formData.get("document") ?? "").trim() || null;
  if (name.length < 2) redirect("/onboarding?error=Informe o nome da empresa.");

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_document: document,
  });

  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}
