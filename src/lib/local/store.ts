/**
 * Local single-user mode, persistent SQLite.
 * Always bind Next to loopback in this mode. No network auth is provided.
 * Money is stored as integer cents; IDs are UUID for later migration.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { NormalizedRow } from "@/lib/domain/import-file";
import type { ReceivableStatus } from "@/lib/domain/receivables";

export type LocalCustomer = {
  id: string; name: string; document: string | null; email: string | null;
  phone: string | null; active: number;
};
export type LocalReceivable = {
  id: string; customer_id: string; customer_name: string; external_id: string | null;
  description: string | null; amount: number; due_date: string;
  status: ReceivableStatus; paid_at: string | null;
};
export type LocalImport = {
  id: string; filename: string; status: string; rows_total: number;
  rows_imported: number; created_at: string;
};

const connections = new Map<string, DatabaseSync>();
const now = () => new Date().toISOString();
const nullable = (value?: string | null) => value?.trim() || null;

function cents(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido.");
  const value = Math.round(amount * 100);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 99_999_999_999_999)
    throw new Error("Valor fora do limite permitido.");
  return value;
}
function checkDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + "T00:00:00Z")) ||
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)
    throw new Error("Vencimento inválido.");
}
export function dbFilePath() {
  const dir = process.env.RECEBEU_DATA_DIR
    ? resolve(process.env.RECEBEU_DATA_DIR)
    : join(homedir(), ".recebeu");
  return join(dir, "recebeu.sqlite");
}
function database() {
  const file = dbFilePath();
  const cached = connections.get(file);
  if (cached) return cached;
  mkdirSync(dirname(file), {recursive: true, mode: 0o700});
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  try { chmodSync(file, 0o600); } catch { /* Filesystems differ. */ }
  const version = Number((db.prepare("PRAGMA user_version").get() as {user_version:number}).user_version);
  if (version !== 0 && version !== 1) throw new Error("Versão do banco local desconhecida.");
  if (version === 0) {
    db.exec([
      "BEGIN IMMEDIATE;",
      "CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200), external_id TEXT UNIQUE, document TEXT, email TEXT, phone TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);",
      "CREATE TABLE receivables (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), external_id TEXT UNIQUE, description TEXT, amount_cents INTEGER NOT NULL CHECK(amount_cents>0), due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')), paid_at TEXT, source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);",
      "CREATE INDEX idx_receivables_due ON receivables(due_date);",
      "CREATE INDEX idx_receivables_customer ON receivables(customer_id);",
      "CREATE TABLE payments (id TEXT PRIMARY KEY, receivable_id TEXT NOT NULL UNIQUE REFERENCES receivables(id), amount_cents INTEGER NOT NULL CHECK(amount_cents>0), paid_at TEXT NOT NULL, created_at TEXT NOT NULL);",
      "CREATE TABLE import_batches (id TEXT PRIMARY KEY, filename TEXT NOT NULL, status TEXT NOT NULL, rows_total INTEGER NOT NULL, rows_imported INTEGER NOT NULL, created_at TEXT NOT NULL);",
      "CREATE TABLE audit_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL);",
      "PRAGMA user_version=1;",
      "COMMIT;"
    ].join("\n"));
  }
  connections.set(file, db);
  return db;
}
function transaction<T>(op:(db:DatabaseSync)=>T):T {
  const db=database();
  db.exec("BEGIN IMMEDIATE");
  try {const result=op(db);db.exec("COMMIT");return result;}
  catch (error) {db.exec("ROLLBACK");throw error;}
}
function audit(db:DatabaseSync, action:string, entityType:string, entityId:string, details:object) {
  db.prepare("INSERT INTO audit_logs(id,action,entity_type,entity_id,metadata,created_at) VALUES(?,?,?,?,?,?)")
    .run(randomUUID(),action,entityType,entityId,JSON.stringify(details),now());
}
export function listCustomers():LocalCustomer[] {
  return database().prepare("SELECT id,name,document,email,phone,active FROM customers ORDER BY name COLLATE NOCASE").all() as LocalCustomer[];
}
export function listReceivables():LocalReceivable[] {
  const rows=database().prepare("SELECT r.id,r.customer_id,c.name AS customer_name,r.external_id,r.description,r.amount_cents,r.due_date,r.status,r.paid_at FROM receivables r JOIN customers c ON c.id=r.customer_id ORDER BY r.due_date,r.id")
    .all() as Array<Omit<LocalReceivable,"amount">&{amount_cents:number}>;
  return rows.map(({amount_cents,...r})=>({...r,amount:amount_cents/100}));
}
export function listImports():LocalImport[] {
  return database().prepare("SELECT id,filename,status,rows_total,rows_imported,created_at FROM import_batches ORDER BY created_at DESC LIMIT 50").all() as LocalImport[];
}
export function createCustomer(input:{name:string;document?:string;email?:string;phone?:string}) {
  const name=input.name.trim();
  if (!name || name.length>200) throw new Error("Nome do cliente inválido.");
  const id=randomUUID();
  transaction(db=>{
    db.prepare("INSERT INTO customers(id,name,document,email,phone,created_at) VALUES(?,?,?,?,?,?)")
      .run(id,name,nullable(input.document),nullable(input.email),nullable(input.phone),now());
    audit(db,"customer.created","customer",id,{});
  });
  return id;
}
export function createReceivable(input:{customer_id:string;description?:string;amount:number;due_date:string}) {
  checkDate(input.due_date);
  const amount=cents(input.amount);
  const id=randomUUID();
  transaction(db=>{
    if (!db.prepare("SELECT id FROM customers WHERE id=?").get(input.customer_id))
      throw new Error("Cliente não encontrado.");
    const timestamp=now();
    db.prepare("INSERT INTO receivables(id,customer_id,description,amount_cents,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .run(id,input.customer_id,nullable(input.description),amount,input.due_date,timestamp,timestamp);
    audit(db,"receivable.created","receivable",id,{});
  });
  return id;
}
function findCustomer(db:DatabaseSync,row:NormalizedRow) {
  const document=nullable(row.customer_document);
  const email=nullable(row.customer_email)?.toLowerCase()??null;
  const found=(document&&db.prepare("SELECT id FROM customers WHERE document=? LIMIT 1").get(document))
    ||(email&&db.prepare("SELECT id FROM customers WHERE lower(email)=? LIMIT 1").get(email))
    ||db.prepare("SELECT id FROM customers WHERE lower(name)=lower(?) LIMIT 1").get(row.customer_name.trim());
  if (found) {
    const id=(found as {id:string}).id;
    db.prepare("UPDATE customers SET document=coalesce(document,?),email=coalesce(email,?),phone=coalesce(phone,?) WHERE id=?")
      .run(document,email,nullable(row.customer_phone),id);
    return id;
  }
  const id=randomUUID();
  db.prepare("INSERT INTO customers(id,name,document,email,phone,created_at) VALUES(?,?,?,?,?,?)")
    .run(id,row.customer_name.trim(),document,email,nullable(row.customer_phone),now());
  return id;
}
export function commitImport(filename:string,rows:NormalizedRow[]) {
  if (rows.length<1 || rows.length>5000) throw new Error("Limite de 1 a 5.000 linhas por importação.");
  if (!filename || filename.length>255) throw new Error("Nome de arquivo inválido.");
  return transaction(db=>{
    for(const row of rows) {
      if (!row.customer_name?.trim()) throw new Error("Cliente ausente.");
      cents(row.amount);checkDate(row.due_date);
      if (!["pending","paid","cancelled"].includes(row.status)) throw new Error("Status inválido.");
    }
    const batch=randomUUID(),timestamp=now();
    db.prepare("INSERT INTO import_batches(id,filename,status,rows_total,rows_imported,created_at) VALUES(?,?,?,?,?,?)")
      .run(batch,filename,"committed",rows.length,rows.length,timestamp);
    for(const row of rows) {
      const existing=row.external_id
        ? db.prepare("SELECT id,status FROM receivables WHERE external_id=?").get(row.external_id) as {id:string;status:string}|undefined
        : undefined;
      if (existing?.status==="paid")
        throw new Error("Importação contém título já pago: "+row.external_id);
      const customer=findCustomer(db,row),amount=cents(row.amount);
      const paidAt=row.status==="paid"?(row.paid_at??timestamp):null;
      if (existing) {
        db.prepare("UPDATE receivables SET customer_id=?,description=?,amount_cents=?,due_date=?,status=?,paid_at=?,source='import',updated_at=? WHERE id=?")
          .run(customer,nullable(row.description),amount,row.due_date,row.status,paidAt,timestamp,existing.id);
      } else {
        db.prepare("INSERT INTO receivables(id,customer_id,external_id,description,amount_cents,due_date,status,paid_at,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
          .run(randomUUID(),customer,nullable(row.external_id),nullable(row.description),amount,row.due_date,row.status,paidAt,"import",timestamp,timestamp);
      }
    }
    audit(db,"import.committed","import_batch",batch,{rows:rows.length});
    return {batch_id:batch,rows_imported:rows.length};
  });
}
export function recordPayment(id:string) {
  return transaction(db=>{
    const record=db.prepare("SELECT id,amount_cents,status FROM receivables WHERE id=?").get(id) as {id:string;amount_cents:number;status:string}|undefined;
    if(!record)throw new Error("Recebível não encontrado.");
    if(record.status==="paid")return {ok:true,already_paid:true};
    if(record.status==="cancelled")throw new Error("Recebível cancelado.");
    const timestamp=now(),paymentId=randomUUID();
    db.prepare("UPDATE receivables SET status='paid',paid_at=?,updated_at=? WHERE id=?").run(timestamp,timestamp,id);
    db.prepare("INSERT INTO payments(id,receivable_id,amount_cents,paid_at,created_at) VALUES(?,?,?,?,?)")
      .run(paymentId,id,record.amount_cents,timestamp,timestamp);
    audit(db,"payment.recorded","receivable",id,{payment_id:paymentId});
    return {ok:true,already_paid:false};
  });
}
export function localCounts() {
  const db=database();
  const count=(table:"customers"|"receivables"|"payments"|"audit_logs")=>
    Number((db.prepare("SELECT count(*) AS n FROM "+table).get() as {n:number}).n);
  return {customers:count("customers"),receivables:count("receivables"),payments:count("payments"),audits:count("audit_logs")};
}
