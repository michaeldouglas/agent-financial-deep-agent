import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import CodeBlock from "../src/components/rich-content/code-block";
import MermaidRenderer from "../src/components/rich-content/mermaid-renderer";
import RichContentRenderer from "../src/components/rich-content/rich-content-renderer";
import Home from "../src/app/page";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
const svgPrototype = dom.window.SVGElement.prototype as unknown as {
  getComputedTextLength: (this: SVGElement) => number;
  getBBox: (this: SVGElement) => { x: number; y: number; width: number; height: number };
};
svgPrototype.getComputedTextLength = function () { return (this.textContent ?? "").length * 8; };
svgPrototype.getBBox = function () { return { x: 0, y: 0, width: (this as SVGElement & { getComputedTextLength(): number }).getComputedTextLength(), height: 16 }; };
dom.window.Element.prototype.scrollIntoView = function () {};
dom.window.requestIdleCallback = (callback: IdleRequestCallback) => dom.window.setTimeout(
  () => callback({ didTimeout: false, timeRemaining: () => 50 }),
  1,
);
dom.window.cancelIdleCallback = (handle: number) => dom.window.clearTimeout(handle);
for (const [name, value] of Object.entries({
  window: dom.window,
  self: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  Element: dom.window.Element,
  SVGElement: dom.window.SVGElement,
  DOMParser: dom.window.DOMParser,
})) Object.defineProperty(globalThis, name, { configurable: true, value });
Object.defineProperty(globalThis, "CSSStyleSheet", {
  configurable: true,
  value: class TestStyleSheet {
    cssRules: { cssText: string }[] = [];
    insertRule(rule: string, index: number) { this.cssRules.splice(index, 0, { cssText: rule }); }
    replaceSync() {}
  },
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

function createTestRoot() {
  const container = dom.window.document.createElement("div");
  dom.window.document.body.replaceChildren(container);
  return createRoot(container);
}

test("code block copies the original source without executing it", async () => {
  const source = "    globalThis.__presentationCodeExecuted = true";
  const writes: string[] = [];
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => { writes.push(text); } },
  });
  const root = createTestRoot();
  await act(async () => { root.render(<CodeBlock code={source} language="javascript" />); });
  const button = dom.window.document.querySelector("button");
  assert.ok(button);
  await act(async () => { button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  assert.deepEqual(writes, [source]);
  assert.match(dom.window.document.querySelector("pre")?.textContent ?? "", /globalThis/);
  assert.equal((globalThis as typeof globalThis & { __presentationCodeExecuted?: boolean }).__presentationCodeExecuted, undefined);
  await act(async () => root.unmount());
});

test("unknown code languages stay readable and copyable", async () => {
  const source = "unknown syntax <tag> & value";
  const root = createTestRoot();
  await act(async () => { root.render(<CodeBlock code={source} language="not-a-real-grammar" />); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
  assert.match(dom.window.document.querySelector("pre")?.textContent ?? "", /unknown syntax <tag> & value/);
  assert.ok(dom.window.document.querySelector('button[aria-label="Copiar código"]'));
  await act(async () => root.unmount());
});

test("invalid Mermaid shows a readable error and retains source for copying", async () => {
  const source = "flowchart TD\n A -->";
  const root = createTestRoot();
  await act(async () => { root.render(<MermaidRenderer source={source} />); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
  assert.match(dom.window.document.body.textContent ?? "", /Não foi possível renderizar este diagrama/);
  assert.match(dom.window.document.querySelector("details")?.textContent ?? "", /A -->/);
  assert.ok(dom.window.document.querySelector('button[aria-label="Copiar definição Mermaid"]'));
  await act(async () => root.unmount());
});

test("mixed chat content renders Markdown, KaTeX, source code and Mermaid together", async () => {
  const content = [
    "## Fórmula", "O valor futuro é $FV=PV(1+i)^n$.",
    "```python\ndef total(x):\n    return x + 1\n```",
    "```mermaid\nflowchart TD\n A[Entrada] --> B[Resultado]\n```",
  ].join("\n\n");
  const root = createTestRoot();
  await act(async () => { root.render(<RichContentRenderer content={content} />); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1800)); });
  const output = dom.window.document.body.textContent ?? "";
  assert.match(output, /Fórmula/);
  assert.match(dom.window.document.querySelector(".katex")?.textContent ?? "", /FV/);
  assert.match(output, /def total/);
  assert.match(output, /Ver definição Mermaid/);
  assert.ok(dom.window.document.querySelector(".mermaid-visual svg"));
  await act(async () => root.unmount());
});

test("chat keeps text together with existing chart and document payloads", async () => {
  const chart = { type: "bar", title: "Gráfico preservado", data: [{ label: "A", value: 1 }] };
  const document = {
    schema_version: "1.0", document_type: "report", title: "Documento preservado",
    metadata: { classification: "user-provided", currency: "BRL" },
    sections: [{ title: "Resumo", blocks: [{ type: "paragraph", text: "Conteúdo do documento." }] }],
  };
  const resposta = `Texto junto do gráfico e documento.\n\n\`\`\`chart\n${JSON.stringify(chart)}\n\`\`\`\n\n\`\`\`document\n${JSON.stringify(document)}\n\`\`\``;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => new Response(
    String(input).endsWith("/skills") ? "[]" : JSON.stringify({ resposta }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
  const root = createTestRoot();
  try {
    await act(async () => { root.render(<Home />); await new Promise((resolve) => setTimeout(resolve, 50)); });
    const suggestion = [...dom.window.document.querySelectorAll("button")].find((button) => button.textContent?.includes("Organize gastos do mês"));
    assert.ok(suggestion);
    await act(async () => {
      suggestion.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const output = dom.window.document.body.textContent ?? "";
    assert.match(output, /Texto junto do gráfico e documento/);
    assert.match(output, /Gráfico preservado/);
    assert.match(output, /Documento preservado/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
