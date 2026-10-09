import { describe, expect, it, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { NormalizedRow } from "@/lib/domain/import-file";

const dir=mkdtempSync(join(tmpdir(),"recebeu-local-"));
process.env.RECEBEU_DATA_DIR=dir;
const store=await import("./store");

function row(overrides: Partial<NormalizedRow>={}):NormalizedRow {
  return {
    customer_name:"Empresa Fictícia",amount:123.45,due_date:"2026-10-20",
    status:"pending",external_id:"REC-001",...overrides,
  };
}
afterAll(()=>{
  // Database remains open in-process; Linux supports unlinking an open database.
  rmSync(dir,{recursive:true,force:true});
});
describe("local SQLite mode",()=>{
  it("creates customers and manual invoices, preserving cents exactly",()=>{
    const id=store.createCustomer({name:"Cliente Local"});
    store.createReceivable({customer_id:id,amount:0.1+0.2,due_date:"2026-11-01",description:"Cobrança manual"});
    const invoice=store.listReceivables().find(x=>x.customer_id===id);
    expect(invoice?.amount).toBe(0.3);
    expect(store.localCounts().audits).toBeGreaterThan(0);
  });
  it("imports CSV-normalized rows atomically and updates by external ID",()=>{
    const first=store.commitImport("clientes.csv",[row(),row({customer_name:"Segunda Empresa",external_id:"REC-002",amount:49.9})]);
    expect(first.rows_imported).toBe(2);
    const count=store.localCounts().receivables;
    store.commitImport("atualizacao.csv",[row({amount:150})]);
    expect(store.localCounts().receivables).toBe(count);
    expect(store.listReceivables().find(x=>x.external_id==="REC-001")?.amount).toBe(150);
  });
  it("is idempotent when recording a confirmed payment",()=>{
    const invoice=store.listReceivables().find(x=>x.external_id==="REC-001");
    expect(invoice).toBeDefined();
    expect(store.recordPayment(invoice!.id).already_paid).toBe(false);
    expect(store.recordPayment(invoice!.id).already_paid).toBe(true);
    expect(store.localCounts().payments).toBe(1);
    expect(store.listReceivables().find(x=>x.id===invoice!.id)?.status).toBe("paid");
  });
  it("rolls back the entire import when one row overwrites a paid invoice",()=>{
    const before=store.localCounts();
    expect(()=>store.commitImport("falha.csv",[
      row({customer_name:"Não Deve Existir",external_id:"REC-003",amount:80}),
      row({external_id:"REC-001",amount:1,status:"pending"}),
    ])).toThrow(/já pago/);
    expect(store.localCounts()).toEqual(before);
    expect(store.listReceivables().some(x=>x.external_id==="REC-003")).toBe(false);
  });
  it("survives a second connection opening the persisted SQLite file",()=>{
    const file=store.dbFilePath();
    const db=new DatabaseSync(file);
    try{
      const result=db.prepare("SELECT count(*) AS count FROM receivables").get() as {count:number};
      expect(result.count).toBe(store.localCounts().receivables);
      const payment=db.prepare("SELECT amount_cents FROM payments").get() as {amount_cents:number};
      expect(payment.amount_cents).toBe(15000);
    }finally{db.close();}
  });
  it("validates all amounts and dates before committing",()=>{
    const before=store.localCounts();
    expect(()=>store.commitImport("erro.csv",[row({amount:-100,external_id:"REC-FAIL"})])).toThrow();
    expect(()=>store.createReceivable({customer_id:"missing",amount:12,due_date:"2026-02-31"})).toThrow();
    expect(store.localCounts()).toEqual(before);
  });
});
