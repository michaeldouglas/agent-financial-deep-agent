import test from "node:test";
import assert from "node:assert/strict";
import Ajv from "ajv";
import schema from "../src/app/document.schema.json" with { type: "json" };
import financialReport from "../../agent-financial/skills/document-renderer/assets/examples/financial-report.json" with { type: "json" };
import accountStatement from "../../agent-financial/skills/document-renderer/assets/examples/account-statement.json" with { type: "json" };
import investmentSummary from "../../agent-financial/skills/document-renderer/assets/examples/investment-summary.json" with { type: "json" };

const validate = new Ajv({ allErrors: true }).compile(schema);

function baseDocument() {
  return {
    schema_version: "1.0",
    document_type: "report",
    title: "Resumo financeiro",
    metadata: { classification: "user-provided", currency: "BRL" },
    sections: [{ title: "Visão geral", blocks: [{ type: "paragraph", text: "Valores conforme fornecidos." }] }],
  };
}

test("accepts a document with each supported typed content block", () => {
  const document = baseDocument();
  document.sections[0].blocks = [
    { type: "heading", level: "h3", text: "Detalhes" },
    { type: "paragraph", text: "Texto comum" },
    { type: "list", ordered: false, items: ["Item A", "Item B"] },
    { type: "table", columns: [{ key: "amount", label: "Valor", format: "currency" }], rows: [{ amount: 12.5 }] },
    { type: "indicator", label: "Saldo", value: 12.5, unit: "BRL", trend: "neutral" },
    { type: "callout", tone: "info", text: "Informação" },
    { type: "page_break" },
  ];
  assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test("requires a visible notice for demonstration documents", () => {
  const document = baseDocument();
  document.metadata = { classification: "demonstration" };
  assert.equal(validate(document), false);
  document.metadata.notice = "Valores fictícios para demonstração.";
  assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test("requires a source label for connected-source documents", () => {
  const document = baseDocument();
  document.metadata = { classification: "connected-source" };
  assert.equal(validate(document), false);
  document.metadata.source = "Fonte autorizada";
  assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test("rejects unknown document properties and block types", () => {
  const document = baseDocument();
  document.executable = "alert(1)";
  assert.equal(validate(document), false);
  delete document.executable;
  document.sections[0].blocks = [{ type: "script", source: "alert(1)" }];
  assert.equal(validate(document), false);
});

test("rejects invalid currency codes and object-valued table cells", () => {
  const document = baseDocument();
  document.metadata.currency = "DOLLARS";
  assert.equal(validate(document), false);
  document.metadata.currency = "USD";
  document.sections[0].blocks = [{
    type: "table",
    columns: [{ key: "amount", label: "Valor" }],
    rows: [{ amount: { code: "not a cell" } }],
  }];
  assert.equal(validate(document), false);
});

test("accepts a user-supplied HTML-like string as plain text data", () => {
  const document = baseDocument();
  document.sections[0].blocks = [{ type: "paragraph", text: "<script>alert(1)</script>" }];
  assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test("all skill examples satisfy the frontend schema", () => {
  const examples = [
    ["financial-report.json", financialReport],
    ["account-statement.json", accountStatement],
    ["investment-summary.json", investmentSummary],
  ];
  for (const [filename, document] of examples) {
    assert.equal(validate(document), true, `${filename}: ${JSON.stringify(validate.errors)}`);
  }
});
