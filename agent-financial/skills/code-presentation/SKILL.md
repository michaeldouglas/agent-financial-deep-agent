---
name: code-presentation
description: >-
  Guides code presentation. Use whenever an answer contains two or more code
  blocks, code in multiple languages, or meaningful validation or security
  requirements, regardless of snippet length. Also use for complete or
  substantial implementations that need clear language tags, formatting, or
  explanation. A single short snippet without special requirements renders
  automatically and does not need this Skill.
metadata:
  user_invocable: "false"
---

# Code presentation

- Read this Skill before preparing an answer with multiple code blocks, code in
  more than one language, or security-sensitive code examples.
- Use fenced Markdown blocks with a language identifier, for example
  ` ```python `. The frontend highlights the code, offers copy, and preserves
  whitespace; do not wrap code in JSON, HTML, or React.
- Select the language that matches the syntax. Common tags include
  `python`, `typescript`/`ts`, `javascript`/`js`, `sql`, `json`, `yaml`,
  `bash`/`sh`, and `go`; unknown tags fall back to readable plain text.
- Preserve code exactly when reviewing, quoting, or adapting user source. Never
  execute code or imply that the chat provides a runtime.
- Read [code reference](references/code-blocks.md) for aliases and display rules.
