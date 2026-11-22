# Choosing a document structure

Choose a document form that matches the request and the available source data:

- Set the payload `document_type` to `report` for a report, `statement` for an account statement, `proposal` for a proposal, and `summary` for a summary. Use `other` only when none of these match.
- **Financial report:** a title, reporting period or as-of date when supplied, a concise summary, relevant indicators, and tables for detailed figures.
- **Account statement:** a source and period, a transaction table, and totals only when they can be calculated from the supplied or authorized records. Never imply bank access when none occurred.
- **Proposal:** scope, assumptions, options, costs, and terms only when supplied. Missing rates, fees, dates, or conditions must be requested or marked as unavailable.
- **Investment summary:** identify the data source and period, compare supplied figures, and separate historical values from assumptions. Do not turn a demonstration fixture into a real recommendation.
- **Short summary:** use a small number of sections and indicators; do not expand a brief request into a long report.

Use paragraph, heading, list, table, indicator, and callout blocks to organize content. Use a page break only when the user requests a deliberate new page or the next section is a useful standalone page. Browsers paginate long content automatically when printing.

Always include a clear classification in the document metadata. Use `demonstration` for mock fixtures or invented examples and disclose that in a visible notice. Use `user-provided` for values pasted or uploaded by the user. Use `connected-source` only for information returned by an authorized connected source. A user-provided account statement must not be described as verified by a bank.

If the data is absent, incompatible, or insufficient for a requested total, do not fabricate a plausible document. State what is missing and ask for the minimum information needed. Preserve negative values, zeroes, and dates exactly; do not silently round financial amounts.
