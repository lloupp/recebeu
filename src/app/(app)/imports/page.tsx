import { ImportUploader } from "@/components/import-uploader";
import { getCurrentOrganization } from "@/lib/auth";
import { isLocalMode } from "@/lib/storage-mode";
export const dynamic = "force-dynamic";
export default async function ImportsPage() {
  let rows: Array<{id:string;filename:string;status:string;rows_total:number;rows_imported:number;created_at:string}>;
  if (isLocalMode) {
    const {listImports}=await import("@/lib/local/store");
    rows=listImports();
  } else {
    const {supabase,membership}=await getCurrentOrganization();
    const {data,error}=await supabase.from("import_batches")
      .select("id,filename,status,rows_total,rows_imported,created_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at",{ascending:false}).limit(50);
    if(error)throw error;
    rows=data??[];
  }
  return <section className="stack">
    <div><h1>Importações {isLocalMode?"· Local":""}</h1><p className="muted">CSV ou XLSX, até 5 MB e 5.000 linhas. O arquivo original não é guardado.</p></div>
    <div className="card"><ImportUploader/></div>
    <div className="card table-wrap">{rows.length ? <table><thead>
      <tr><th>Arquivo</th><th>Status</th><th>Linhas</th><th>Importadas</th><th>Data</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.id}><td>{row.filename}</td><td>{row.status}</td><td>{row.rows_total}</td><td>{row.rows_imported}</td><td>{new Date(row.created_at).toLocaleString("pt-BR")}</td></tr>)}
      </tbody></table> : <div className="empty">Nenhuma importação realizada.</div>}</div>
  </section>;
}
