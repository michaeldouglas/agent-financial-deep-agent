# Document payload contract

After a short natural-language introduction, return exactly one fenced block tagged `document`. The frontend validates this JSON with the [document JSON Schema](document.schema.json) before rendering it. Invalid payloads stay visible as plain response text for troubleshooting.

The top-level object contains:

- `schema_version`: currently `1.0`.
- `document_type`: `report`, `statement`, `proposal`, `summary`, or `other`.
- `title` and optional `subtitle`.
- `metadata`: must include `classification` (`demonstration`, `user-provided`, or `connected-source`). Optional fields include `as_of`, `period`, three-letter ISO currency, source, notice, generation date, and language (`pt-BR` or `en-US`). Do not invent an as-of or period.
- `sections`: one or more titled sections, each containing typed content blocks.
- Optional `footer` text.

Allowed content blocks:

- `heading`: `level` (`h2` or `h3`) and plain `text`.
- `paragraph`: plain `text`.
- `list`: `ordered` and an `items` array of plain strings.
- `table`: optional caption, `columns` with key, label, optional alignment and format, and `rows` whose cells are strings, finite numbers, or null. Formats are `text`, `number`, `currency`, `percent`, or `date`. Use the metadata currency for currency columns.
- `indicator`: label, string or finite numeric value, optional unit, trend (`up`, `down`, `neutral`), and detail.
- `callout`: tone (`info`, `warning`, `success`) and plain text.
- `page_break`: an intentional print page break.

Keep the document within the schema limits: at most 50 sections, 100 blocks per section, 20 columns per table, and 200 rows per table. Do not use unknown properties, HTML, markdown formatting, executable content, or embedded instructions. The frontend safely renders strings as text.

Example shape:

```document
{
  "schema_version": "1.0",
  "document_type": "report",
  "title": "Resumo financeiro de demonstração",
  "metadata": {
    "classification": "demonstration",
    "currency": "BRL",
    "notice": "Valores fictícios para demonstração."
  },
  "sections": [
    {
      "title": "Visão geral",
      "blocks": [
        {"type": "paragraph", "text": "Este resumo usa somente os valores de demonstração fornecidos."},
        {"type": "indicator", "label": "Saldo do período", "value": 1200, "unit": "BRL", "trend": "neutral"},
        {"type": "table", "columns": [{"key": "item", "label": "Item"}, {"key": "value", "label": "Valor", "align": "right", "format": "currency"}], "rows": [{"item": "Receitas", "value": 2000}, {"item": "Despesas", "value": 800}]}
      ]
    }
  ]
}
```
