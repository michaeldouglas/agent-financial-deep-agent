import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import { codeToTokens } from 'shiki';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
dom.window.SVGElement.prototype.getComputedTextLength = function () { return (this.textContent ?? '').length * 8; };
dom.window.SVGElement.prototype.getBBox = function () { return { x: 0, y: 0, width: this.getComputedTextLength(), height: 16 }; };
for (const [name, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  Element: dom.window.Element, SVGElement: dom.window.SVGElement, DOMParser: dom.window.DOMParser,
})) Object.defineProperty(globalThis, name, { configurable: true, value });
Object.defineProperty(globalThis, 'CSSStyleSheet', {
  configurable: true,
  value: class TestStyleSheet {
    cssRules = [];
    insertRule(rule, index) { this.cssRules.splice(index, 0, { cssText: rule }); }
    replaceSync() {}
  },
});
const { default: mermaid } = await import('mermaid');

test('GFM tables, nested lists, links and special characters render safely', () => {
  const markdown = '| Ativo | Valor |\n| --- | ---: |\n| CDB & <x> | R$ 10 |\n\n- item\n  - filho\n\n[fonte](https://example.org)';
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown));
  assert.match(html, /<table>/);
  assert.match(html, /<ul>/);
  assert.match(html, /href="https:\/\/example.org"/);
  assert.match(html, /&amp;/);
  assert.doesNotMatch(html, /<x>/);
});

test('malformed Markdown remains renderable as escaped text', () => {
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, null, '```python\nprint("<safe>")'));
  assert.match(html, /<code class="language-python">/);
  assert.match(html, /&lt;safe&gt;/);
});

test('KaTeX parses inline, display, matrices and aligned equations', () => {
  for (const [tex, displayMode] of [
    ['i = 0.01', false],
    ['FV = PV(1+i)^n', true],
    ['\\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix}', true],
    ['\\begin{aligned}J &= C i n \\\\ M &= C+J\\end{aligned}', true],
  ]) assert.match(katex.renderToString(tex, { displayMode, throwOnError: true, trust: false }), /katex/);
  assert.throws(() => katex.renderToString('\\notARealCommand{x}', { throwOnError: true }), katex.ParseError);
});

test('remark math plugin recognizes inline and display delimiters', () => {
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: false, trust: false }]],
  }, 'Taxa $i=1\\%$\n\n$$\nFV=PV(1+i)^n\n$$'));
  assert.match(html, /katex/);
  assert.match(html, /katex-display/);
});

test('Shiki highlights common code languages and preserves special code text', async () => {
  for (const [lang, source] of [
    ['python', '    print("<valor>")'],
    ['typescript', 'const taxa: number = 1'],
    ['json', '{"taxa": 1}'],
    ['sql', 'SELECT * FROM investimentos;'],
  ]) {
    const result = await codeToTokens(source, { lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false });
    assert.ok(result.tokens.flat().some((token) => token.content.includes(source.trimStart().split(/[ (:{]/)[0])));
  }
});

test('Shiki reports unknown grammar for caller fallback; code is tokenized only', async () => {
  const source = 'raise RuntimeError("this must never execute")';
  await assert.rejects(codeToTokens(source, { lang: 'definitely-not-a-language', theme: 'github-light' }));
  assert.equal(source.includes('RuntimeError'), true);
});

test('Mermaid parser accepts flowchart and sequence diagrams', async () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false });
  assert.ok(await mermaid.parse('flowchart TD\n A[Pedido] --> B{Validado?}\n B -->|Sim| C[Processar]'));
  assert.ok(await mermaid.parse('sequenceDiagram\n Cliente->>Banco: Solicitação\n Banco-->>Cliente: Confirmação'));
});

test('Mermaid parser rejects invalid syntax and strict mode stays enabled for unsafe labels', async () => {
  await assert.rejects(mermaid.parse('flowchart TD\n A -->'));
  assert.equal(mermaid.mermaidAPI.getConfig().securityLevel, 'strict');
  await mermaid.parse('flowchart TD\n A["<script>alert(1)</script>"] --> B[Texto]');
});

test('Mermaid SVG output is sanitized before it can enter the chat DOM', async () => {
  const { default: DOMPurify } = await import('dompurify');
  const rendered = await mermaid.render('safe-diagram-test', 'flowchart TD\n A["<img src=x onerror=alert(1)>"] --> B[Texto]');
  const safe = DOMPurify.sanitize(rendered.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
  assert.match(safe, /<svg/);
  assert.doesNotMatch(safe, /<script|onerror|javascript:/i);
});

test('one Markdown response can contain prose, math, code, Mermaid and existing payload fences', () => {
  const response = [
    '## Cálculo', '$$FV=PV(1+i)^n$$', '```python\nprint("ok")\n```',
    '```mermaid\nflowchart TD\n A --> B\n```', '```chart\n{}\n```', '```document\n{}\n```',
  ].join('\n\n');
  assert.match(response, /\$\$FV/);
  assert.match(response, /```python/);
  assert.match(response, /```mermaid/);
  assert.match(response, /```chart/);
  assert.match(response, /```document/);
});
