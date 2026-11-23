"use client";

import { useEffect, useState } from "react";
import type { BundledLanguage } from "shiki";

type Token = { content: string; htmlStyle?: Record<string, string> };
type Props = { code: string; language?: string };
type Highlight = { code: string; language: string; tokens: Token[][] };
const aliases: Record<string, string> = {
  py: "python", python3: "python", ts: "typescript", js: "javascript",
  sh: "bash", shell: "bash", yml: "yaml", plaintext: "text",
};

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase().replace(/^language-/, "");
  return (aliases[normalized] ?? normalized) || "text";
}

export default function CodeBlock({ code, language = "text" }: Props) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [copied, setCopied] = useState(false);
  const lang = normalizeLanguage(language);
  const codeLines = code.split("\n");
  if (codeLines.length > 1 && codeLines[codeLines.length - 1] === "") codeLines.pop();

  useEffect(() => {
    let active = true;
    if (lang === "text") return;
    void import("shiki").then(({ codeToTokens }) => codeToTokens(code, {
      lang: lang as BundledLanguage, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false,
    })).then(({ tokens: nextTokens }) => { if (active) setHighlight({ code, language: lang, tokens: nextTokens }); })
      .catch(() => { if (active) setHighlight(null); });
    return () => { active = false; };
  }, [code, lang]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  }

  return (
    <div className="rich-code-block">
      <div className="rich-code-toolbar">
        <span className="rich-code-language">{lang}</span>
        <button type="button" onClick={() => void copyCode()} aria-label={copied ? "Código copiado" : "Copiar código"}>
          {copied ? "Copiado" : "Copiar código"}
        </button>
      </div>
      <pre tabIndex={0} aria-label={`Código ${lang}, ${codeLines.length} linhas`}><code>
        {codeLines.map((line, index) => {
          const highlightedLine = highlight?.code === code && highlight.language === lang
            ? highlight.tokens[index]
            : null;

          return (
            <span className="rich-code-line" key={index}>
              <span className="rich-code-line-number" aria-hidden="true">{index + 1}</span>
              <span className="rich-code-content">{highlightedLine
                ? highlightedLine.map((token, tokenIndex) => (
                  <span key={tokenIndex} style={token.htmlStyle as React.CSSProperties}>{token.content}</span>
                ))
                : line}</span>
            </span>
          );
        })}
      </code></pre>
    </div>
  );
}
