"use server";
import { revalidatePath } from "next/cache";
import { isLocalMode } from "@/lib/storage-mode";
import { parseMoney } from "@/lib/domain/imports";

export async function createLocalReceivableAction(form:FormData) {
  if (!isLocalMode) throw new Error("Operação disponível apenas no modo local.");
  const amount=parseMoney(form.get("amount"));
  if(amount===null) throw new Error("Valor inválido.");
  const {createReceivable}=await import("@/lib/local/store");
  createReceivable({
    customer_id:String(form.get("customer_id")??""),
    description:String(form.get("description")??""),
    amount,
    due_date:String(form.get("due_date")??""),
  });
  revalidatePath("/receivables");revalidatePath("/dashboard");
}
