# Graph Report - agent-financial-deep-agent  (2026-11-22)

## Corpus Check
- 59 files · ~17,590 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 10, .example 2, .lock 1)

## Summary
- 445 nodes · 729 edges · 35 communities (22 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `405f8974`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- NativeSkillLoadingTests
- main.go
- chart-renderer.tsx
- agent-financial
- skill_python.py
- routes.py
- package.json
- compilerOptions
- page.tsx
- _build_agent
- dependencies
- test_skill_loading.py
- document-schema.test.cjs
- app.py
- agent.py
- layout.tsx
- mcp.py
- create_skill_tool_resolver
- Banking Operations — Read-Only
- Financial Assistant
- Investment Analysis
- chart-visualization/SKILL.md
- document-renderer.tsx
- scripts
- docker-entrypoint.sh
- agent-financial
- mcp-financial
- validate_document.py
- document-renderer/SKILL.md
- eslint.config.mjs
- react-dom@^19.2.0

## God Nodes (most connected - your core abstractions)
1. `NativeSkillLoadingTests` - 23 edges
2. `_build_agent()` - 16 edges
3. `compilerOptions` - 16 edges
4. `log_skill_observability()` - 13 edges
5. `answer()` - 12 edges
6. `Home()` - 12 edges
7. `ScriptedChatModel` - 11 edges
8. `create_skill_tool_resolver()` - 10 edges
9. `chat_endpoint()` - 9 edges
10. `read_skill_call()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Document renderer` --references--> `run_skill_python_script()`  [INFERRED]
  agent-financial/skills/document-renderer/SKILL.md → agent-financial/src/agent_core/skill_python.py
- `resolve()` --indirect_call--> `run_skill_python_script()`  [INFERRED]
  agent-financial/src/agent_core/skills.py → agent-financial/src/agent_core/skill_python.py
- `lifespan()` --calls--> `discover_financial_mcp_tools()`  [EXTRACTED]
  agent-financial/app.py → agent-financial/src/agent_core/mcp.py
- `configure_mcp_tools()` --calls--> `missing_skill_mcp_tools()`  [EXTRACTED]
  agent-financial/src/agent.py → agent-financial/src/agent_core/skills.py
- `_build_agent()` --calls--> `create_chat_model()`  [EXTRACTED]
  agent-financial/src/agent.py → agent-financial/src/agent_core/config.py

## Import Cycles
- None detected.

## Communities (35 total, 13 thin omitted)

### Community 0 - "NativeSkillLoadingTests"
Cohesion: 0.10
Nodes (6): log_skill_observability(), message_text(), NativeSkillLoadingTests, read_path_call(), read_skill_call(), ScriptedChatModel

### Community 1 - "main.go"
Cohesion: 0.09
Nodes (20): balanceInput, balanceOutput, chartDatasetInput, chartDatasetOutput, chartDatum, getMockBalance(), getMockChartDataset(), getMockMarketQuote() (+12 more)

### Community 2 - "chart-renderer.tsx"
Cohesion: 0.19
Nodes (17): chartCsvRows(), ChartRenderer(), ChartRow, ChartSeries, ChartSpec, ChartTooltip(), ChartType, csvCell() (+9 more)

### Community 3 - "agent-financial"
Cohesion: 0.07
Nodes (34): build, command, condition, env_file, healthcheck, ports, volumes, context (+26 more)

### Community 4 - "skill_python.py"
Cohesion: 0.21
Nodes (4): _run(), run_skill_python_script(), _script_path(), resolve()

### Community 5 - "routes.py"
Cohesion: 0.12
Nodes (15): answer(), _answer(), answer_with_skill(), answer_with_skills(), discover_skills(), chat_endpoint(), health(), _localized_message() (+7 more)

### Community 6 - "package.json"
Cohesion: 0.16
Nodes (16): devDependencies, tailwindcss@^4.1.17, @tailwindcss/postcss@^4.1.17, @types/node@^24.10.0, @types/react@^19.2.0, @types/react-dom@^19.2.0, typescript@^5.9.3, name (+8 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "page.tsx"
Cohesion: 0.15
Nodes (17): apiUrl, fetchSkills(), getPendingStatus(), getSkillSlashQuery(), Home(), sendMessage(), isChartSpec(), isSkillOption() (+9 more)

### Community 9 - "_build_agent"
Cohesion: 0.08
Nodes (7): _build_agent(), create_filesystem_middleware(), create_filesystem_permissions(), create_skills_backend(), _get_agent(), AgentReuseTests, CorsPolicyTests

### Community 10 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, react@^19.2.0, react-markdown@^10.1.0, recharts@^3.11.0, rehype-katex@^7.0.1, remark-gfm@^4.0.1, remark-math@^6.0.0, swr@^2.5.1 (+7 more)

### Community 13 - "document-schema.test.cjs"
Cohesion: 0.15
Nodes (7): ajv@^8.20.0, Ajv, assert, path, test, validate, ajv

### Community 16 - "layout.tsx"
Cohesion: 0.20
Nodes (6): nextConfig, katex@^0.16.22, next@^16.0.0, metadata, katex, next

### Community 19 - "Banking Operations — Read-Only"
Cohesion: 0.29
Nodes (6): Banking Operations — Read-Only, Boundaries, Examples, Output, Prerequisites, Workflow

### Community 20 - "Financial Assistant"
Cohesion: 0.29
Nodes (6): Examples, Financial Assistant, Financial checks, Safety and clarity, Scope and routing, Workflow

### Community 21 - "Investment Analysis"
Cohesion: 0.29
Nodes (6): Calculation checks, Examples, Investment Analysis, Output, Safety and tool use, Workflow

### Community 22 - "chart-visualization/SKILL.md"
Cohesion: 0.33
Nodes (3): Choosing a chart, Chart payload contract, Chart visualization

### Community 23 - "document-renderer.tsx"
Cohesion: 0.16
Nodes (16): ajv, classificationLabels, DocumentBlock, DocumentCell, DocumentClassification, DocumentColumn, DocumentSpec, documentTypeLabels (+8 more)

### Community 24 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

### Community 31 - "validate_document.py"
Cohesion: 0.31
Nodes (3): main(), _semantic_issues(), validate_payload()

### Community 32 - "document-renderer/SKILL.md"
Cohesion: 0.33
Nodes (3): Choosing a document structure, Document payload contract, Document renderer

### Community 33 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9.39.1, eslint-config-next@^16.0.0, eslint, eslint-config-next

## Knowledge Gaps
- **2 isolated node(s):** `agent-financial`, `mcp-financial`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 182 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_build_agent()` connect `_build_agent` to `NativeSkillLoadingTests`, `test_skill_loading.py`, `test_skill_loading.py`, `app.py`, `agent.py`, `create_skill_tool_resolver`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `agent-financial`, `mcp-financial` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `NativeSkillLoadingTests` be split into smaller, more focused modules?**
  _Cohesion score 0.10104529616724739 - nodes in this community are weakly interconnected._
- **Why does `NativeSkillLoadingTests` connect `NativeSkillLoadingTests` to `create_skill_tool_resolver`, `test_skill_loading.py`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `main.go` be split into smaller, more focused modules?**
  _Cohesion score 0.09358974358974359 - nodes in this community are weakly interconnected._
- **Why does `run_skill_python_script()` connect `skill_python.py` to `document-renderer/SKILL.md`, `test_skill_loading.py`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `agent-financial` be split into smaller, more focused modules?**
  _Cohesion score 0.07226890756302522 - nodes in this community are weakly interconnected._