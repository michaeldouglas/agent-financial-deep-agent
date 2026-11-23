---
name: math-rendering
description: >-
  Produces scientific, statistical, algebraic, probability, or financial
  derivations with KaTeX-compatible notation. Use whenever the user requests a
  formula, display math, KaTeX, or a derivation, and for precision-sensitive
  financial or scientific notation. Simple arithmetic without a request for
  notation can remain plain text.
metadata:
  include_tools: python_scripts
  user_invocable: "false"
---

# Math rendering

- Use only `$...$` inline. Put display delimiters on their own lines, with the
  expression between them; never put a formula on the same line as `$$`:
  `$$`, newline, expression, newline, `$$`. Never emit `\(...\)` or `\[...\]`;
  although the frontend normalizes legacy delimiters, use the supported `$`
  forms in every answer.
- Target KaTeX, not full LaTeX. Prefer `\frac`, `\sqrt`, `\sum`, `\prod`,
  `\begin{aligned}`, `\begin{matrix}` and supported symbols. Never claim a
  delimiter check proves a command is supported.
- Keep financial values, units, signs, and precision unchanged. Explain
  variables and assumptions in prose.
- For every derivation or response containing multiple equations, call
  `run_skill_python_script` once before the final answer with
  `skill_name="math-rendering"`, `script_name="validate_math_delimiters.py"`,
  and `input_json={"text":"<complete response>"}`. If the delimiters are
  invalid, correct them and validate again. This checks delimiters only; actual
  KaTeX parsing checks command compatibility.
- Treat a derivation as multiple equations even when the steps share one display
  block. Do not skip the script because the formulas appear visually together.
  Simple arithmetic or a single short expression needs no script call.
- Read [KaTeX reference](references/katex.md) for supported syntax and examples.
  If rendering fails, show the original expression as code and explain briefly.
