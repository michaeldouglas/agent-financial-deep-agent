# Chart payload contract

After the natural-language answer, return exactly one fenced block tagged `chart`. The frontend removes this block from the Markdown and renders the validated payload.

```chart
{
  "type": "bar",
  "title": "Variação de ativos de demonstração (%)",
  "unit": "%",
  "mock": true,
  "as_of": "fixture de teste",
  "colors": ["#4f46e5", "#0f766e", "#d97706", "#e11d48", "#0284c7", "#7c3aed"],
  "data": [
    {"label": "PETR4", "value": 1.8},
    {"label": "VALE3", "value": -0.7}
  ]
}
```

Common rules:

- `type` must be one of `bar`, `line`, `area`, `pie`, `composed`, `scatter`, `radar`, `radialBar`, `treemap`, `funnel`, `sankey`, or `sunburst`.
- `title` is required. `unit`, `mock`, `as_of`, and `colors` are optional; for mock fixtures set `mock` to `true` and copy `title` and `as_of` verbatim from the tool response. Never paraphrase or replace those fixture strings. Copy user-provided labels verbatim too; do not translate them or change their capitalization. User-supplied data is not a mock unless it is explicitly fictional.
- `colors`, when present, is an array of CSS color strings. Copy the default palette from `../assets/theme.json`.
- Use non-empty `data` with 1–100 rows for all types except `sankey`; Sankey needs non-empty `nodes` and `links` instead. Never return an empty chart payload. Simple chart rows have a string `label` and finite numeric `value`.
- Do not put JSON outside the fenced block, add unsupported fields, or change fixture values.

Chart-specific fields:

- `composed`: add `series`, an array of `{ "key": "field", "name": "Label", "type": "bar|line|area" }`. Each data row must contain a finite numeric value for every series key. `type` and `name` are optional; series defaults to bar. Use this representation for several measures sharing one category; the current `bar` renderer reads only the `value` field.
- `scatter`: each row must contain finite numeric `x` and `y`. Optional `z` controls point size. Set `x_key`, `y_key`, or `z_key` to use alternative field names.
- `radar`: use `label` for each dimension and `series` entries for each comparable entity, each with a numeric field in every row. With no `series`, the chart uses `value` as its one series.
- `radialBar`: each row needs a non-negative `value`; labels name the compared values.
- `treemap` and `sunburst`: use nested rows such as `{ "label": "Renda fixa", "value": 60, "children": [{ "label": "Tesouro", "value": 35 }] }`. Every leaf needs a non-negative finite `value`.
- `funnel`: rows need `label` and non-negative `value`; order stages from largest to smallest.
- `sankey`: use `nodes: [{ "name": "Origem" }]` and `links: [{ "source": 0, "target": 1, "value": 10 }]`. Indexes are zero-based and refer to `nodes`; values must be non-negative.
- For a pie chart, include only non-negative values that represent parts of the same whole.
- Choose advanced forms only when the source data contains the needed relationships. Do not manufacture multiple measures, hierarchies, or flows from a simple label/value fixture.

Use the examples in `../assets/examples/` as shape references only. Always fetch the selected fixture from the MCP tool for mock fixture values in a response.
