import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { readImportFile, normalizeRows, type ColumnMapping } from "@/lib/domain/import-file";
import { TARGET_FIELDS, type TargetField } from "@/lib/domain/imports";

export const runtime = "nodejs";

function validMapping(input: unknown): input is ColumnMapping {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  return Object.values(input as Record<string, unknown>).every(
    (value) =>
      value === "" ||
      (typeof value === "string" && TARGET_FIELDS.includes(value as TargetField)),
  );
}

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (context.membership.role === "viewer") return NextResponse.json({ error: "Sem permissão para importar." }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    const mappingText = String(form.get("mapping") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
    const mapping = JSON.parse(mappingText) as unknown;
    if (!validMapping(mapping)) return NextResponse.json({ error: "Mapeamento inválido." }, { status: 400 });

    const required = new Set<TargetField>(Object.values(mapping).filter((value): value is TargetField => value !== ""));
    for (const field of ["customer_name", "amount", "due_date"] as const satisfies readonly TargetField[]) {
      if (!required.has(field)) return NextResponse.json({ error: `Mapeie o campo obrigatório: ${field}.` }, { status: 400 });
    }

    const table = await readImportFile(file);
    const normalized = normalizeRows(table, mapping);
    if (normalized.errors.length) {
      return NextResponse.json({ error: "Há linhas inválidas.", errors: normalized.errors.slice(0, 50), validRows: normalized.rows.length, totalRows: normalized.total }, { status: 422 });
    }
    if (!normalized.rows.length) return NextResponse.json({ error: "Nenhuma linha válida encontrada." }, { status: 400 });

    const { data, error } = await context.supabase.rpc("commit_receivables_import", {
      p_organization_id: context.membership.organization_id,
      p_filename: file.name,
      p_rows: normalized.rows,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao importar." }, { status: 400 });
  }
}
