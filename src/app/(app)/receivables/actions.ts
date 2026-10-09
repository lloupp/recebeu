"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrganization } from "@/lib/auth";
import { isLocalMode } from "@/lib/storage-mode";

export type PaymentActionState = { ok: boolean; message: string };

export async function recordPayment(
  _state: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const id = String(formData.get("receivable_id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "Identificador inválido." };
  }

  if (isLocalMode) {
    try {
      const { recordPayment: localPayment } = await import("@/lib/local/store");
      const result = localPayment(id);
      revalidatePath("/receivables");
      revalidatePath("/dashboard");
      return { ok: true, message: result.already_paid ? "Pagamento já registrado." : "Pagamento salvo no banco local." };
    } catch {
      return { ok: false, message: "Não foi possível registrar o recebimento." };
    }
  }
  const { supabase, membership } = await getCurrentOrganization();
  if (membership.role === "viewer") {
    return { ok: false, message: "Seu perfil não permite registrar pagamentos." };
  }

  const { data, error } = await supabase.rpc("record_receivable_payment", {
    p_organization_id: membership.organization_id,
    p_receivable_id: id,
  });

  if (error) {
    // Database errors can contain implementation details; don't return them.
    return { ok: false, message: "Não foi possível registrar. Confirme se o título está pendente." };
  }

  revalidatePath("/receivables");
  revalidatePath("/dashboard");

  if (data?.already_paid) {
    return { ok: true, message: "Pagamento já havia sido registrado." };
  }
  return { ok: true, message: "Pagamento registrado." };
}
