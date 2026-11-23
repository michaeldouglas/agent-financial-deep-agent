"use client";

import { useEffect, useId, useState } from "react";

type RenderState = { source: string; svg?: string; error?: boolean };

export default function MermaidRenderer({ source }: { source: string }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [resultState, setResultState] = useState<RenderState | null>(null);
  const svg = resultState?.source === source ? resultState.svg ?? "" : "";
  const error = resultState?.source === source && resultState.error === true;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        htmlLabels: false,
        suppressErrorRendering: true,
        theme: "base",
        themeVariables: {
          darkMode: true,
          background: "#10272c",
          primaryColor: "#17353a",
          primaryTextColor: "#f0f5ee",
          primaryBorderColor: "#79ded0",
          lineColor: "#79ded0",
          secondaryColor: "#23344a",
          tertiaryColor: "#352f52",
          fontFamily: "IBM Plex Sans, sans-serif",
          fontSize: "14px",
        },
      });
      await mermaid.parse(source);
      const result = await mermaid.render(id, source);
      const { default: DOMPurify } = await import("dompurify");
      const safeSvg = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
      if (active) setResultState({ source, svg: safeSvg });
    }).catch(() => { if (active) setResultState({ source, error: true }); });
    return () => { active = false; };
  }, [id, source]);

  async function copySource() {
    try { await navigator.clipboard.writeText(source); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setCopied(false); }
  }

  return (
    <section className="mermaid-card" aria-label="Diagrama Mermaid">
      <div className="mermaid-toolbar"><span>Diagrama</span><button type="button" onClick={() => void copySource()} aria-label="Copiar definição Mermaid">{copied ? "Copiado" : "Copiar código"}</button></div>
      {svg && <div className="mermaid-visual" role="img" aria-label="Diagrama renderizado" dangerouslySetInnerHTML={{ __html: svg }} />}
      {error && <p className="mermaid-error" role="status">Não foi possível renderizar este diagrama. A definição original continua disponível abaixo.</p>}
      <details><summary>Ver definição Mermaid</summary><pre><code>{source}</code></pre></details>
    </section>
  );
}
