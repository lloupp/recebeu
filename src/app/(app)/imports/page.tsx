import { ImportUploader } from "@/components/import-uploader";
import { getCurrentOrganization } from "@/lib/auth";

export default async function ImportsPage() {
  const { supabase, membership } = await getCurrentOrganization();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id,filename,status,rows_total,rows_valid,rows_invalid,rows_imported,created_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (
    <section className="stack">
      <div><h1>Importações</h1><p className="muted">CSV ou XLSX, até 5 MB e 5.000 linhas por lote. O arquivo original não é armazenado.</p></div>
      <div className="card"><ImportUploader /></div>
      <div className="card table-wrap">
        {data?.length ? <table><thead><tr><th>Arquivo</th><th>Status</th><th>Linhas</th><th>Importadas</th><th>Data</th></tr></thead><tbody>{data.map((x) => <tr key={x.id}><td>{x.filename}</td><td>{x.status}</td><td>{x.rows_total}</td><td>{x.rows_imported}</td><td>{new Date(x.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table> : <div className="empty">Nenhuma importação realizada.</div>}
      </div>
    </section>
  );
}
