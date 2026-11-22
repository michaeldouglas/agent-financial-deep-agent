---
name: chart-visualization
description: >-
  Creates interactive financial charts from user data, authorized market data,
  or fictional demo fixtures. Use when the user asks to see spending or a portfolio, compare
  investment performance, or follow a trend visually, even if they do not name
  a chart type. Use this Skill alongside financial analysis when a visual is
  requested.
metadata:
  include_tools: chart_data
  user_invocable: "false"
---

# Chart visualization

1. Read [chart selection](references/chart-selection.md) when choosing a chart type.
2. If the user supplied chartable data, use those values as given. For current or historical market data, use the relevant `chart_data` MCP tool when available and preserve its source and timestamps. If a live-data call fails, explain the failure; never silently replace it with a mock. The local provider's `mock_get_chart_dataset` fixtures (`monthly_series`, `market_movers`, `portfolio_allocation`, `expense_categories`) are fictional; label them as demonstrations and never present them as live data or the user's finances. If neither the user nor a tool provides compatible data, explain what's missing instead of inventing it.
3. Read [the chart payload contract](references/chart-spec.md), then return one `chart` fenced JSON block after the answer text. Preserve all source labels and values exactly, including their capitalization and language. For an MCP fixture, copy its `title` and `as_of` strings verbatim; do not paraphrase them.
4. Use [the default theme](assets/theme.json) for the block's `colors`. The files in [examples](assets/examples/) show valid payloads to adapt; keep their data only for examples, not as a substitute for the MCP fixture.

The chat frontend reads the block and renders it with Recharts. Do not return React code, HTML, SVG, or an image.
