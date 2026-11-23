---
name: rich-text
description: >-
  Produces professional Markdown and GitHub Flavored Markdown. Use when the user
  requests a structured guide, long technical explanation, or explicit headings,
  nested lists, GFM tables, links, or citations; ordinary short answers need no
  presentation Skill.
metadata:
  include_tools: python_scripts
  user_invocable: "false"
---

# Rich text

- Write standard Markdown supported by `react-markdown` and `remark-gfm`; do not
  emit raw HTML, JSX, or a JSON wrapper for prose.
- Use headings in order, concise paragraphs, nested lists only when they clarify
  relationships, and GFM tables for compact comparisons.
- Keep fenced code, math delimiters, chart/document payload fences, and Mermaid
  fences intact so the frontend can route each format to its renderer.
- Do not normalize or rewrite financial values, code, or math. Whenever this
  Skill is activated, validate the complete draft with `run_skill_python_script` using
  `skill_name="rich-text"`, `script_name="validate_markdown.py"` and
  `input_json={"markdown":"<complete response>"}`. This checks fence closure
  without changing the response.
- Read [formatting reference](references/formatting.md) for syntax and safe
  examples. A validator warning is advisory; preserve source text and explain
  unsupported syntax instead of silently changing meaning.
