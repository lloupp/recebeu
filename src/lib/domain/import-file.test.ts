import { describe, expect, it } from "vitest";
import { normalizeRows } from "./import-file";

describe("normalizeRows", () => {
  it("normalizes a valid Brazilian spreadsheet row", () => {
    const result = normalizeRows(
      { headers: ["Cliente", "Valor", "Vencimento"], rows: [["ACME", "1.234,56", "23/09/2026"]] },
      { Cliente: "customer_name", Valor: "amount", Vencimento: "due_date" },
    );
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ customer_name: "ACME", amount: 1234.56, due_date: "2026-09-23" });
  });

  it("rejects a row without amount", () => {
    const result = normalizeRows(
      { headers: ["Cliente", "Valor", "Vencimento"], rows: [["ACME", "", "23/09/2026"]] },
      { Cliente: "customer_name", Valor: "amount", Vencimento: "due_date" },
    );
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]?.message).toBe("Valor inválido.");
  });
});
