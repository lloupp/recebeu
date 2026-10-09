"use server";
import { revalidatePath } from "next/cache";
import { isLocalMode } from "@/lib/storage-mode";

export async function createLocalCustomerAction(form: FormData) {
  if (!isLocalMode) throw new Error("Operação disponível apenas no modo local.");
  const {createCustomer}=await import("@/lib/local/store");
  createCustomer({
    name:String(form.get("name")??""),
    document:String(form.get("document")??""),
    email:String(form.get("email")??""),
    phone:String(form.get("phone")??""),
  });
  revalidatePath("/customers");
  revalidatePath("/receivables");
}
