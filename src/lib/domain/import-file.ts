import { readSheet } from "read-excel-file/universal";
import { parseMoney, type TargetField } from "./imports";

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type Cell = string | number | boolean | Date | null | undefined;
export type RawTable = { headers: string[]; rows: Cell[][] };
export type ColumnMapping = Record<string, TargetField | "">;
export type NormalizedRow = {
  customer_name: string;
  customer_document?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_external_id?: string;
  external_id?: string;
  description?: string;
  amount: number;
  due_date: string;
  status: "pending" | "paid" | "cancelled";
  paid_at?: string;
};

function parseCsv(text: string): RawTable {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === delimiter && !quoted) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  const [headers = [], ...body] = rows;
  return { headers: headers.map((h) => h.trim()), rows: body };
}

export async function readImportFile(file: File): Promise<RawTable> {
  if (file.size <= 0) throw new Error("Arquivo vazio.");
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Arquivo acima do limite de 5 MB.");
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsv(await file.text());
  }
  if (lower.endsWith(".xlsx")) {
    const matrix = await readSheet(await file.arrayBuffer());
    const [head = [], ...body] = matrix as Cell[][];
    return { headers: head.map((h) => String(h ?? "").trim()), rows: body };
  }
  throw new Error("Formato não suportado. Use CSV ou XLSX.");
}

function normalizeDate(value: Cell): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 1 && value < 100000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + Math.round(value) * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

function normalizeStatus(value: Cell): NormalizedRow["status"] {
  const status = String(value ?? "").trim().toLowerCase();
  if (["pago", "paid", "recebido", "quitado"].includes(status)) return "paid";
  if (["cancelado", "cancelled", "canceled"].includes(status)) return "cancelled";
  return "pending";
}

function text(value: Cell) {
  const valueText = String(value ?? "").trim();
  return valueText || undefined;
}

export function normalizeRows(table: RawTable, mapping: ColumnMapping) {
  const indexByTarget = new Map<TargetField, number>();
  table.headers.forEach((header, index) => {
    const target = mapping[header];
    if (target) indexByTarget.set(target, index);
  });

  const errors: Array<{ row: number; message: string }> = [];
  const rows: NormalizedRow[] = [];

  table.rows.slice(0, MAX_IMPORT_ROWS + 1).forEach((cells, idx) => {
    const rowNumber = idx + 2;
    if (idx >= MAX_IMPORT_ROWS) { errors.push({ row: rowNumber, message: `Limite de ${MAX_IMPORT_ROWS} linhas excedido.` }); return; }
    const at = (field: TargetField): Cell => {
      const index = indexByTarget.get(field);
      return index === undefined ? undefined : cells[index];
    };

    const customerName = text(at("customer_name"));
    const amount = parseMoney(at("amount"));
    const dueDate = normalizeDate(at("due_date"));
    if (!customerName) { errors.push({ row: rowNumber, message: "Cliente ausente." }); return; }
    if (amount === null || amount <= 0) { errors.push({ row: rowNumber, message: "Valor inválido." }); return; }
    if (!dueDate) { errors.push({ row: rowNumber, message: "Vencimento inválido." }); return; }

    const status = normalizeStatus(at("status"));
    rows.push({
      customer_name: customerName,
      customer_document: text(at("customer_document")),
      customer_email: text(at("customer_email")),
      customer_phone: text(at("customer_phone")),
      external_id: text(at("external_id")),
      description: text(at("description")),
      amount,
      due_date: dueDate,
      status,
      ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}),
    });
  });

  return { rows, errors, total: table.rows.length };
}
