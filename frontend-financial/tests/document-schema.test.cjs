const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Ajv = require("ajv");
const schema = require("../src/app/document.schema.json");

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
  const examples = path.resolve(__dirname, "../../agent-financial/skills/document-renderer/assets/examples");
  for (const filename of ["financial-report.json", "account-statement.json", "investment-summary.json"]) {
    const document = require(path.join(examples, filename));
    assert.equal(validate(document), true, `${filename}: ${JSON.stringify(validate.errors)}`);
  }
});
