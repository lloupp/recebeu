export type ReceivableStatus = "pending" | "overdue" | "paid" | "cancelled";

export type ReceivableLike = {
  amount: number;
  due_date: string;
  status: ReceivableStatus;
  paid_at?: string | null;
};

export function effectiveStatus(
  receivable: ReceivableLike,
  todayIso: string,
): ReceivableStatus {
  if (receivable.status === "paid" || receivable.paid_at) return "paid";
  if (receivable.status === "cancelled") return "cancelled";
  return receivable.due_date < todayIso ? "overdue" : "pending";
}

export function agingBucket(dueDateIso: string, todayIso: string) {
  const due = Date.parse(`${dueDateIso}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  const days = Math.floor((today - due) / 86_400_000);

  if (days <= 0) return "not_due" as const;
  if (days <= 7) return "1_7" as const;
  if (days <= 30) return "8_30" as const;
  if (days <= 60) return "31_60" as const;
  if (days <= 90) return "61_90" as const;
  return "90_plus" as const;
}

export function sumByStatus(receivables: ReceivableLike[], todayIso: string) {
  return receivables.reduce(
    (acc, item) => {
      const status = effectiveStatus(item, todayIso);
      if (status === "paid") acc.paid += item.amount;
      if (status === "pending") acc.pending += item.amount;
      if (status === "overdue") acc.overdue += item.amount;
      return acc;
    },
    { paid: 0, pending: 0, overdue: 0 },
  );
}
