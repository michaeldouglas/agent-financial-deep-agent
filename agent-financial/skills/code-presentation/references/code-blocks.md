# Source code fences

Use a fenced block with a stable language tag:

```python
def compound(principal: float, rate: float, periods: int) -> float:
    return principal * (1 + rate) ** periods
```

The frontend uses Shiki 4.6.0 with on-demand language chunk loading and
light/dark themes. `codeToTokens` returns data rendered as React text nodes; the
UI does not insert highlighted HTML.
Aliases are normalized for common names (`py` → `python`, `ts` → `typescript`,
`js` → `javascript`, `sh` → `bash`, `yml` → `yaml`). The installed Shiki
version's grammar list is broader than this common alias list; unrecognized
grammars remain copyable and readable as plain text. Keep indentation and
trailing newlines meaningful, and split unrelated languages into separate
fences. No fenced content is executed.
