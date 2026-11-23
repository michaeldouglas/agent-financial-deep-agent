import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { unified } from "unified";
import katex from "katex";
import { JSDOM } from "jsdom";

const document = await new Promise((resolve, reject) => {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    try { resolve(JSON.parse(input)); } catch (error) { reject(error); }
  });
});

assert.ok(document && typeof document.content === "string", "Expected JSON with string content.");
const source = document.content;
unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(source);
const markdownHtml = renderToStaticMarkup(React.createElement(
  ReactMarkdown,
  { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: false, trust: false }]] },
  source,
));

function normalizeMathDelimiters(markdown) {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula) => `\n$$\n${formula.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula) => `$${formula.trim()}$`);
}

function collectMath(node, formulas = []) {
  if (node?.type === "math" || node?.type === "inlineMath") {
    formulas.push({ tex: node.value, displayMode: node.type === "math" });
  }
  for (const child of node?.children ?? []) collectMath(child, formulas);
  return formulas;
}
const normalizedTree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(normalizeMathDelimiters(source));
const mathExpressions = collectMath(normalizedTree);
for (const formula of mathExpressions) {
  katex.renderToString(formula.tex, { displayMode: formula.displayMode, throwOnError: true, trust: false });
}

const mermaidBlocks = [...source.matchAll(/```mermaid\s*\n([\s\S]*?)\n```/gi)].map((match) => match[1]);
if (mermaidBlocks.length) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    SVGElement: dom.window.SVGElement,
    DOMParser: dom.window.DOMParser,
  })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const { default: mermaid } = await import("mermaid");
  Object.defineProperty(globalThis, "CSSStyleSheet", {
    configurable: true,
    value: class EvalStyleSheet {
      cssRules = [];
      insertRule(rule, index) { this.cssRules.splice(index, 0, { cssText: rule }); }
      replaceSync() {}
    },
  });
  dom.window.SVGElement.prototype.getComputedTextLength = function () { return (this.textContent ?? "").length * 8; };
  dom.window.SVGElement.prototype.getBBox = function () { return { x: 0, y: 0, width: this.getComputedTextLength(), height: 16 }; };
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false, suppressErrorRendering: true });
  for (const [index, definition] of mermaidBlocks.entries()) {
    await mermaid.parse(definition);
    await mermaid.render(`presentation-eval-${index}`, definition);
  }
}

process.stdout.write(JSON.stringify({
  markdown_rendered: markdownHtml.length > 0 || source.length === 0,
  markdown_tables: (markdownHtml.match(/<table\b/g) ?? []).length,
  math_expressions: mathExpressions.length,
  mermaid_diagrams: mermaidBlocks.length,
}));
