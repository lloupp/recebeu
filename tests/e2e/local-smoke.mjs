import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {DatabaseSync} from "node:sqlite";
import {join} from "node:path";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH??"playwright");
const origin=process.env.BASE_URL??"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({locale:"pt-BR"});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  const initial=await page.goto(origin+"/dashboard");
  assert.equal(initial?.status(),200);
  await page.getByText("Dashboard · Local").waitFor();
  await page.goto(origin+"/customers");
  await page.getByLabel("Nome ou razão social *").fill("Clínica Fictícia Local");
  await page.getByRole("button",{name:"Salvar cliente"}).click();
  await page.getByText("Clínica Fictícia Local",{exact:true}).first().waitFor();
  console.log("PASS: local dashboard and create customer");
  await page.goto(origin+"/receivables");
  await page.getByLabel("Cliente *").selectOption({label:"Clínica Fictícia Local"});
  await page.getByLabel("Descrição").fill("Serviço de teste");
  await page.getByLabel("Valor (R$) *").fill("125,90");
  await page.getByLabel("Vencimento *").fill("2026-09-01");
  await page.getByRole("button",{name:"Salvar título"}).click();
  await page.getByText("Serviço de teste").waitFor();
  console.log("PASS: create payable invoice");
  await page.goto(origin+"/imports");
  const csv="Cliente;Valor;Vencimento;Status;ID;Descrição\nEmpresa Importada;220,30;15/09/2026;Pendente;TEST-1;Importação local";
  await page.locator('input[type="file"]').setInputFiles({
    name:"local.csv",mimeType:"text/csv",buffer:Buffer.from(csv)
  });
  const [previewResponse]=await Promise.all([
    page.waitForResponse(response=>response.url().includes("/api/import/preview")),
    page.getByRole("button",{name:"Validar arquivo"}).click(),
  ]);
  console.log("Import preview:",previewResponse.status(),await previewResponse.text());
  await page.getByText("1 linhas detectadas",{exact:false}).waitFor();
  await page.getByRole("button",{name:"Importar recebíveis"}).click();
  await page.getByText("Importação concluída com sucesso.").waitFor();
  console.log("PASS: import spreadsheet without Supabase");
  await page.goto(origin+"/receivables");
  assert.equal(await page.locator("tbody tr").count(),2);
  const invoice=page.locator("tbody tr").filter({hasText:"Empresa Importada"});
  page.once("dialog",d=>d.accept());
  await invoice.getByRole("button",{name:"Marcar recebido"}).click();
  await invoice.locator(".badge").getByText("Recebido").waitFor();
  await page.reload();
  assert.match(await invoice.locator(".badge").textContent()??"",/Recebido/);
  const db=new DatabaseSync(join(process.env.RECEBEU_DATA_DIR,"recebeu.sqlite"));
  try {
    assert.equal(db.prepare("SELECT count(*) AS n FROM customers").get().n,2);
    assert.equal(db.prepare("SELECT count(*) AS n FROM receivables").get().n,2);
    assert.equal(db.prepare("SELECT count(*) AS n FROM payments").get().n,1);
  } finally {db.close();}
  assert.deepEqual(errors,[]);
  console.log("PASS: payment survives refresh and data exists on disk");
} finally {await browser.close();}
