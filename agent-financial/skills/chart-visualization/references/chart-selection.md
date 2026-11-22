# Choosing a chart

Choose a chart that makes the requested comparison clear. The frontend supports these Recharts forms:

- **Bar:** compare values across assets or categories. Use `market_movers` for investment comparisons and `expense_categories` for category comparisons. Negative values are valid.
- **Line:** show how one or more values change over ordered time. Use `monthly_series` for a monthly trend.
- **Area:** show a time trend when the magnitude or accumulated volume matters. Use only with ordered time-series data.
- **Composed:** combine bars, lines, and areas when comparing related measures with the same category or time labels. Return `series`, with each entry's `key`, optional `name`, and optional `type` (`bar`, `line`, or `area`); every row must contain a finite number for each series key.
- **Pie:** show positive parts of one whole. `portfolio_allocation` sums to 100; `expense_categories` can show spending shares. Do not use pie for returns, rates, negative values, or values that do not form a whole.
- **Radial bar:** compare a small set of non-negative magnitudes in a circular layout. It does not imply a percentage unless the data is actually a percentage.
- **Radar:** compare multiple measures across the same dimensions, such as risk, liquidity, and return for several portfolios. Use one `series` key per portfolio and one row per dimension. Avoid many dimensions or series because the chart becomes hard to read.
- **Scatter:** show the relationship between two numeric variables, such as risk and return. Every row needs numeric `x` and `y`; optional numeric `z` controls bubble size. Set `x_key`, `y_key`, and `z_key` only when using different field names. Do not infer a relationship from category/value data.
- **Treemap:** show hierarchical parts of a whole, such as allocation by asset class and then asset. Use nested `children` with non-negative `value` fields.
- **Sunburst:** show the same kind of hierarchy as a treemap, with nested levels as rings. Use only when the hierarchy itself is useful to the question.
- **Funnel:** show ordered stages with non-increasing values, for example a simulated conversion funnel. Do not use it for ordinary category comparisons.
- **Sankey:** show flows between named stages. Supply `nodes` and `links`; each link uses zero-based node indexes for `source` and `target` and a non-negative `value`. Use only when the source data actually describes flows.

For the sample chat prompts, the beginner request about where money goes maps to `expense_categories`; investment comparison maps to `market_movers`; a question about a rate changing over time maps to `monthly_series`. If the user supplies compatible data, chart those values without replacing them with a fixture. If the requested relationship or data is absent, say that the current demo fixture cannot answer it instead of inventing values.

If the user names a chart type, honor it when it suits the data. If it would mislead, briefly explain the issue and choose a clearer supported type.

Never emit an empty chart or an incomplete payload when the requested data is missing. If a requested relationship is absent, explain why that chart cannot be made. When the available source still supports a useful alternative chart, explain the limitation and chart only the actual available values.

Do not reshape the current simple label/value MCP fixtures into scatter, hierarchical, or flow data: those relationships are not present in the fixture. Use these advanced forms only when the user provides compatible data or a data tool returns it.
