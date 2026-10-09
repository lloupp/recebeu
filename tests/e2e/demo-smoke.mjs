import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH ?? "playwright");

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const page = await browser.newPage({ locale: "pt-BR", viewport: { width: 1280, height: 900 } });
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = request.url();
    if (url.includes("supabase.co") || url.includes("127.0.0.1:59999")) {
      errors.push("External database request attempted: " + url);
    }
  });

  const response = await page.goto(base + "/demo", { waitUntil: "networkidle" });
  assert.equal(response?.status(), 200, "Demo should load without backend");
  assert.match(await page.title(), /Recebeu.*Demonstração/);
  assert.equal(await page.getByText("Ambiente demonstrativo · dados 100% fictícios").count(), 1);
  assert.equal(await page.locator("tbody tr").count(), 8);

  async function values() {
    return await page.locator(".demo-metrics .metric .value").allTextContents();
  }
  let metrics = await values();
  assert.match(metrics[0], /6\.850,30/, "initial outstanding total");
  assert.match(metrics[1], /3\.910,40/, "initial overdue");
  assert.match(metrics[2], /2\.939,90/, "initial pending");
  assert.match(metrics[3], /0,00/, "initial paid");
  console.log("PASS: demo renders 8 synthetic invoices and correct totals");

  await page.getByLabel("Filtrar").selectOption("overdue");
  assert.equal(await page.locator("tbody tr").count(), 5);
  await page.getByLabel("Buscar cliente ou código").fill("Alfa");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("Buscar cliente ou código").fill("");
  assert.equal(await page.locator("tbody tr").count(), 5);
  console.log("PASS: status filter and customer search");

  await page.getByRole("button", { name: "Simular recebimento" }).first().click();
  metrics = await values();
  assert.match(metrics[0], /5\.649,80/, "reduced outstanding");
  assert.match(metrics[1], /2\.709,90/, "reduced overdue");
  assert.match(metrics[3], /1\.200,50/, "increased paid");
  assert.equal(await page.locator("tbody tr").count(), 4, "paid row leaves overdue filter");
  assert.equal(await page.getByRole("status").count(), 1);
  console.log("PASS: simulated payment updates metrics and table");

  await page.getByRole("button", { name: "Restaurar cenário" }).click();
  metrics = await values();
  assert.match(metrics[0], /6\.850,30/);
  assert.match(metrics[3], /0,00/);
  assert.equal(await page.locator("tbody tr").count(), 8);
  console.log("PASS: reset returns to original scenario");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("tbody tr").count(), 8);
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(width.scroll <= width.viewport + 1, "mobile layout should not overflow the page");
  console.log("PASS: mobile layout at 390px");

  const health = await page.request.get(base + "/api/health");
  assert.equal(health.status(), 200, "health endpoint should work without Supabase");
  assert.deepEqual(errors, [], "no uncaught JS or Supabase requests");
  console.log("PASS: health endpoint and no Supabase network calls");
} finally {
  await browser.close();
}
