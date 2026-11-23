# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the existing app and this redesign request: Portuguese-speaking people who use a browser chat to understand financial concepts, explore illustrative scenarios, or ask for analysis of supplied or connected financial data.

## Product Purpose

The Financial Deep Agent answers financial questions in a conversational interface. It can present explanations and, where appropriate, structured documents, charts, mathematics, code, and diagrams. Success means users can understand the answer, its limits, and the origin or illustrative status of relevant data.

## Positioning

No exclusive market position is confirmed. The current product combines a chat workflow with progressively selected agent Skills and rich content renderers.

## Operating Context

Users interact in Portuguese (Brazil) through a Next.js web client connected to a Python API. They can type a question, select a Skill through the composer, choose a suggested prompt, and review a response with text or structured financial content.

## Capabilities and Constraints

- Frontend: Next.js, React, TypeScript, and Tailwind CSS.
- Backend: Python, FastAPI, LangChain, LangGraph, and Deep Agents.
- Preserve existing API behavior, financial Skills, Recharts charts, document contracts, and rich-text renderers.
- Supported response content includes Markdown/GFM, KaTeX math, highlighted code, Mermaid, Recharts charts, and structured documents.
- Suggestions may contain fictional examples and must remain clearly identified as illustrative.
- Never imply access to live prices or account data unless the response has a real source and timestamp.
- Do not execute model-generated code or render arbitrary HTML/scripts.

## Brand Commitments

- Keep the interface clear, professional, and trustworthy for a financial context.
- Use Portuguese (Brazil) for interface copy.
- Keep the existing informational disclaimer; do not present the agent as personalized financial advice.

## Evidence on Hand

- The current application contains nine example prompts spanning budgeting, portfolios, market information, risk/return, and financial summaries.
- Some examples are explicitly fictional; they are demonstrations, not evidence of user outcomes or investment performance.
- Existing chart and document renderers can show source, date, and demonstration status when supplied by the response.

## Product Principles

1. Make financial information easy to scan and explain.
2. Distinguish illustrative examples from sourced data.
3. Preserve the user's question and give a direct recovery path when a request fails.
4. Reveal specialized capabilities progressively without turning every conversation into a tool workflow.
5. Keep the chat usable with keyboard, assistive technology, reduced motion, and mobile viewports.
