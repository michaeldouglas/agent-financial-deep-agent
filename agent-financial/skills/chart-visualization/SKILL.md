---
name: chart-visualization
description: >-
  Creates interactive financial charts from user data, authorized market data,
  or fictional demo fixtures. Always use when the user explicitly requests a
  chart or financial visualization, even when data is missing or the chart type
  is not named. Also use when the user asks to see spending or a portfolio,
  compare investment performance, or follow a trend visually. Combine with
  financial analysis when both are requested.
metadata:
  include_tools: chart_data
  user_invocable: "false"
---

# Chart visualization

1. Read [chart selection](references/chart-selection.md) when choosing a chart type.
2. If the user supplied chartable data, use those values as given. For current or historical market data, use the relevant `chart_data` MCP tool when available and preserve its source and timestamps. If a live-data call fails, explain the failure; never silently replace it with a mock. The local provider's `mock_get_chart_dataset` fixtures (`monthly_series`, `market_movers`, `portfolio_allocation`, `expense_categories`) are fictional; label them as demonstrations and never present them as live data or the user's finances. If neither the user nor a tool provides compatible data, explain what's missing instead of inventing it. In that situation, do not emit a `chart` block, especially not an empty `data` array.
3. Read [the chart payload contract](references/chart-spec.md), then return one `chart` fenced JSON block after the answer text. Preserve every source label and value exactly, including capitalization, language, and duplicate labels. Never append a category, series, or inferred qualifier to a source label to make it unique. If repeated labels are hard to distinguish, retain them in the payload and explain the distinction in prose. For an MCP fixture, copy its `title` and `as_of` strings verbatim; do not paraphrase them.
4. Use [the default theme](assets/theme.json) for the block's `colors`. The files in [examples](assets/examples/) show valid payloads to adapt; keep their data only for examples, not as a substitute for the MCP fixture.

The chat frontend reads the block and renders it with Recharts. Do not return React code, HTML, SVG, or an image.
