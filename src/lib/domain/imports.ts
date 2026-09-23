export const TARGET_FIELDS = [
  "customer_name",
  "customer_document",
  "customer_email",
  "customer_phone",
  "amount",
  "due_date",
  "status",
  "external_id",
  "description",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

const aliases: Record<TargetField, string[]> = {
  customer_name: ["cliente", "nome", "razao social", "razão social", "sacado"],
  customer_document: ["cpf", "cnpj", "documento", "cpf/cnpj"],
  customer_email: ["email", "e-mail"],
  customer_phone: ["telefone", "celular", "whatsapp", "whats"],
  amount: ["valor", "valor total", "total", "valor titulo", "valor título"],
  due_date: ["vencimento", "data vencimento", "data de vencimento", "vencto"],
  status: ["status", "situacao", "situação", "sit"],
  external_id: ["id", "codigo", "código", "numero", "número", "titulo", "título"],
  description: ["descricao", "descrição", "historico", "histórico"],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function suggestMapping(headers: string[]) {
  return headers.map((header) => {
    const normalized = normalize(header);
    const match = TARGET_FIELDS.find((target) =>
      aliases[target].map(normalize).includes(normalized),
    );
    return { source: header, target: match ?? null };
  });
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}
