"use client";

import { useActionState } from "react";
import { recordPayment, type PaymentActionState } from "@/app/(app)/receivables/actions";

const initialState: PaymentActionState = { ok: false, message: "" };

export function RecordPaymentForm({ id, customerName, amount }: {
  id: string;
  customerName: string;
  amount: string;
}) {
  const [state, action, pending] = useActionState(recordPayment, initialState);

  return (
    <form
      action={action}
      className="payment-form"
      onSubmit={(event) => {
        if (!window.confirm("Confirmar o recebimento de " + amount + " de " + customerName + "?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="receivable_id" value={id} />
      <button className="button secondary" type="submit" disabled={pending}>
        {pending ? "Registrando…" : "Marcar recebido"}
      </button>
      {state.message ? (
        <span role={state.ok ? "status" : "alert"} className={state.ok ? "muted" : "error"}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
