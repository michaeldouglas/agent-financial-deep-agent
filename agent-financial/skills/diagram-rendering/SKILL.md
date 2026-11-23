---
name: diagram-rendering
description: >-
  Creates Mermaid diagrams whenever the user explicitly requests a diagram,
  flowchart, sequence, state model, or visual process, and when relationships,
  processes, or data models are materially clearer visually than in prose. Do
  not add a diagram to a simple explanation without a visual need.
metadata:
  user_invocable: "false"
---

# Diagram rendering

- Put a Mermaid definition in a fenced block tagged `mermaid`. Do not emit HTML,
  SVG, click directives, scripts, or frontend code.
- Choose `flowchart TD` for workflows, `sequenceDiagram` for interactions,
  `stateDiagram-v2` for state, `classDiagram` for types, and `erDiagram` for
  entities. Keep labels short and quote labels containing punctuation.
- Treat labels and identifiers as plain text; avoid HTML and links. The frontend
  runs Mermaid with `securityLevel: "strict"`, validates with its real parser,
  sanitizes generated SVG, and retains the source if rendering fails.
- Read [Mermaid reference](references/mermaid.md) for supported patterns and
  version limitations. Invalid syntax should be repaired or omitted; never
  present an unvalidated diagram as guaranteed to render.
