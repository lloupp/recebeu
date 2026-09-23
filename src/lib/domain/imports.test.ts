import { describe, expect, it } from "vitest";
import { parseMoney, suggestMapping } from "./imports";

describe("import helpers", () => {
  it("maps common Portuguese headers", () => {
    expect(suggestMapping(["Cliente", "Valor Total", "Vencimento"])).toEqual([
      { source: "Cliente", target: "customer_name" },
      { source: "Valor Total", target: "amount" },
      { source: "Vencimento", target: "due_date" },
    ]);
  });

  it("parses Brazilian currency", () => {
    expect(parseMoney("R$ 1.234,56")).toBe(1234.56);
  });
});
