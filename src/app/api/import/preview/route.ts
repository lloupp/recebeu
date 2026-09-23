import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { readImportFile } from "@/lib/domain/import-file";
import { suggestMapping } from "@/lib/domain/imports";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await getApiContext();
  if (!context) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
    const table = await readImportFile(file);
    if (!table.headers.length) return NextResponse.json({ error: "Cabeçalho não encontrado." }, { status: 400 });
    const mapping = suggestMapping(table.headers);
    return NextResponse.json({
      filename: file.name,
      headers: table.headers,
      suggestedMapping: mapping,
      totalRows: table.rows.length,
      sampleRows: table.rows.slice(0, 8).map((row) => table.headers.reduce<Record<string, unknown>>((acc, h, i) => {
        const value = row[i];
        acc[h] = value instanceof Date ? value.toISOString() : value ?? "";
        return acc;
      }, {})),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler arquivo." }, { status: 400 });
  }
}
