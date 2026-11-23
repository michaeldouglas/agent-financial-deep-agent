# Markdown accepted by the chat

The chat uses `react-markdown` 10 with `remark-gfm` 4 and `remark-math` 6.
CommonMark headings, paragraphs, emphasis, links, blockquotes, lists and fenced
code work. GFM adds tables, task lists, strikethrough and autolinks. Raw HTML is
not enabled, so represent content with Markdown rather than HTML tags. Avoid
reference links spanning unusual blank-line structures; inline links are the
most predictable form.

## Good patterns

```md
## Premissas

- Taxa mensal: 1%.
  - Capitalização: mensal.

| Período | Saldo |
| --- | ---: |
| 1 | R$ 1.010,00 |

[Fonte oficial](https://example.org)
```

## Unsupported or fragile patterns

- Raw `<table>` or `<div>` tags are shown as text, not interpreted as layout.
- A fence without its closing backticks can consume later text as code.
- HTML attributes, custom Markdown directives, and JSX are not supported.

Keep ` ```chart ` and ` ```document ` payloads as-is for the existing structured
renderers. Math uses `$...$` or `$$...$$`; see the math-rendering Skill. Mermaid
and source code use language-tagged fences.
