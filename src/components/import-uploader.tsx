"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TARGET_FIELDS, type TargetField } from "@/lib/domain/imports";

type Preview = {
  filename: string;
  headers: string[];
  totalRows: number;
  sampleRows: Record<string, unknown>[];
  suggestedMapping: Array<{ source: string; target: TargetField | null }>;
};

const labels: Record<TargetField, string> = {
  customer_name: "Cliente *",
  customer_document: "CPF/CNPJ",
  customer_email: "E-mail",
  customer_phone: "Telefone",
  amount: "Valor *",
  due_date: "Vencimento *",
  status: "Status",
  external_id: "ID do recebível",
  description: "Descrição",
};

export function ImportUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, TargetField | "">>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const requiredReady = useMemo(() => {
    const values = new Set(Object.values(mapping));
    return values.has("customer_name") && values.has("amount") && values.has("due_date");
  }, [mapping]);

  async function previewFile() {
    if (!file) return;
    setBusy(true); setMessage(null);
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/import/preview", { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage({ type: "error", text: body.error ?? "Falha no preview." }); return; }
    const result = body as Preview;
    setPreview(result);
    setMapping(Object.fromEntries(result.suggestedMapping.map((x) => [x.source, x.target ?? ""])));
  }

  async function commit() {
    if (!file || !preview || !requiredReady) return;
    setBusy(true); setMessage(null);
    const form = new FormData(); form.set("file", file); form.set("mapping", JSON.stringify(mapping));
    const response = await fetch("/api/import/commit", { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      const detail = Array.isArray(body.errors) && body.errors.length ? ` ${body.errors.slice(0, 3).map((x: { row: number; message: string }) => `Linha ${x.row}: ${x.message}`).join(" ")}` : "";
      setMessage({ type: "error", text: `${body.error ?? "Falha na importação."}${detail}` });
      return;
    }
    setMessage({ type: "success", text: "Importação concluída com sucesso." });
    router.refresh();
  }

  return (
    <div className="stack">
      {message ? <div className={message.type}>{message.text}</div> : null}
      <div className="row">
        <input aria-label="Planilha" type="file" accept=".csv,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
        <button className="button" type="button" disabled={!file || busy} onClick={previewFile}>{busy ? "Processando…" : "Validar arquivo"}</button>
      </div>
      {preview ? <>
        <div><strong>{preview.filename}</strong><div className="muted">{preview.totalRows} linhas detectadas. Confirme o mapeamento antes de importar.</div></div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          {preview.headers.map((header) => <label key={header}>{header}<select value={mapping[header] ?? ""} onChange={(e) => setMapping((current) => ({ ...current, [header]: e.target.value as TargetField | "" }))}><option value="">Ignorar</option>{TARGET_FIELDS.map((field) => <option key={field} value={field}>{labels[field]}</option>)}</select></label>)}
        </div>
        <div className="table-wrap"><table><thead><tr>{preview.headers.slice(0, 8).map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{preview.sampleRows.map((row, i) => <tr key={i}>{preview.headers.slice(0, 8).map((h) => <td key={h}>{String(row[h] ?? "")}</td>)}</tr>)}</tbody></table></div>
        {!requiredReady ? <div className="error">Mapeie Cliente, Valor e Vencimento.</div> : null}
        <div><button className="button" type="button" disabled={!requiredReady || busy} onClick={commit}>{busy ? "Importando…" : "Importar recebíveis"}</button></div>
      </> : null}
    </div>
  );
}
