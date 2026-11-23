"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import CodeBlock from "./code-block";
import MermaidRenderer from "./mermaid-renderer";

function normalizeMathDelimiters(markdown: string) {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `\n$$\n${formula.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`);
}

function codeText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(codeText).join("");
  return "";
}

export default function RichContentRenderer({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, trust: false }]]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const language = /language-([^\s]+)/.exec(className ?? "")?.[1];
            if (!language) return <code>{children}</code>;
            const source = codeText(children).replace(/\n$/, "");
            if (language.toLowerCase() === "mermaid") return <MermaidRenderer source={source} />;
            return <CodeBlock code={source} language={language} />;
          },
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        }}
      >{normalizeMathDelimiters(content)}</ReactMarkdown>
    </div>
  );
}
