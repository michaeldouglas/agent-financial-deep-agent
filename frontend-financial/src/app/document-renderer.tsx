"use client";

import { useRef } from "react";
import Ajv from "ajv";
import documentSchema from "./document.schema.json";
import { downloadFile, filenameSlug } from "./download-file";

export type DocumentClassification = "demonstration" | "user-provided" | "connected-source";
export type DocumentCell = string | number | null;

type DocumentColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: "text" | "number" | "currency" | "percent" | "date";
};

type DocumentBlock =
  | { type: "heading"; level: "h2" | "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; caption?: string; columns: DocumentColumn[]; rows: Record<string, DocumentCell>[] }
  | { type: "indicator"; label: string; value: string | number; unit?: string; trend?: "up" | "down" | "neutral"; detail?: string }
  | { type: "callout"; tone: "info" | "warning" | "success"; text: string }
  | { type: "page_break" };

export type DocumentSpec = {
  schema_version: "1.0";
  document_type: "report" | "statement" | "proposal" | "summary" | "other";
  title: string;
  subtitle?: string;
  metadata: {
    classification: DocumentClassification;
    generated_at?: string;
    as_of?: string;
    period?: string;
    currency?: string;
    source?: string;
    notice?: string;
    language?: "pt-BR" | "en-US";
  };
  sections: { title: string; blocks: DocumentBlock[] }[];
  footer?: string;
};

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(documentSchema);

function hasValidSemantics(document: DocumentSpec): boolean {
  if (document.metadata.classification === "demonstration" && !document.metadata.notice?.trim()) return false;
  if (document.metadata.classification === "connected-source" && !document.metadata.source?.trim()) return false;

  for (const section of document.sections) {
    for (const block of section.blocks) {
      if (block.type === "table") {
        const keys = block.columns.map((column) => column.key);
        if (new Set(keys).size !== keys.length) return false;
        for (const row of block.rows) {
          if (Object.keys(row).some((key) => !keys.includes(key))) return false;
          if (Object.values(row).some((value) => typeof value === "number" && !Number.isFinite(value))) return false;
        }
      }
      if (block.type === "indicator" && typeof block.value === "number" && !Number.isFinite(block.value)) return false;
    }
  }
  return true;
}

export function isDocumentSpec(value: unknown): value is DocumentSpec {
  return validateSchema(value) && hasValidSemantics(value as DocumentSpec);
}

const classificationLabels: Record<DocumentClassification, string> = {
  demonstration: "Demonstrativo",
  "user-provided": "Dados fornecidos pelo usuário",
  "connected-source": "Fonte conectada",
};

const documentTypeLabels: Record<DocumentSpec["document_type"], string> = {
  report: "Relatório",
  statement: "Extrato",
  proposal: "Proposta",
  summary: "Resumo",
  other: "Documento financeiro",
};

function numberFormat(value: number, language: "pt-BR" | "en-US"): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 20 }).format(value);
}

function formatCell(value: DocumentCell, column: DocumentColumn, document: DocumentSpec): string {
  if (value === null) return "—";
  if (typeof value !== "number") return value;
  const language = document.metadata.language ?? "pt-BR";
  if (column.format === "currency" && document.metadata.currency) {
    return new Intl.NumberFormat(language, {
      style: "currency",
      currency: document.metadata.currency,
      maximumFractionDigits: 20,
    }).format(value);
  }
  if (column.format === "percent") return `${numberFormat(value, language)}%`;
  if (column.format === "number") return numberFormat(value, language);
  return String(value);
}

function indicatorValue(block: Extract<DocumentBlock, { type: "indicator" }>, document: DocumentSpec): string {
  const value = typeof block.value === "number"
    ? (block.unit === document.metadata.currency && document.metadata.currency
      ? new Intl.NumberFormat(document.metadata.language ?? "pt-BR", {
        style: "currency",
        currency: document.metadata.currency,
        maximumFractionDigits: 20,
      }).format(block.value)
      : numberFormat(block.value, document.metadata.language ?? "pt-BR"))
    : block.value;
  return block.unit && block.unit !== document.metadata.currency ? `${value} ${block.unit}` : value;
}

function printDocument(root: HTMLElement | null) {
  if (!root) return;
  const previousTarget = document.querySelector<HTMLElement>("[data-document-print-target='true']");
  previousTarget?.removeAttribute("data-document-print-target");
  root.setAttribute("data-document-print-target", "true");
  document.body.classList.add("printing-financial-document");

  let cleanupTimer = 0;
  const cleanup = () => {
    root.removeAttribute("data-document-print-target");
    document.body.classList.remove("printing-financial-document");
    window.removeEventListener("afterprint", cleanup);
    window.clearTimeout(cleanupTimer);
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  cleanupTimer = window.setTimeout(cleanup, 120_000);
  window.print();
}

function renderBlock(block: DocumentBlock, document: DocumentSpec, sectionTitle: string, index: number) {
  if (block.type === "page_break") return <div className="financial-document-page-break" key={`page-break-${index}`} aria-hidden="true" />;
  if (block.type === "heading") {
    return block.level === "h2"
      ? <h2 className="financial-document-heading" key={`heading-${index}`}>{block.text}</h2>
      : <h3 className="financial-document-subheading" key={`subheading-${index}`}>{block.text}</h3>;
  }
  if (block.type === "paragraph") return <p className="financial-document-paragraph" key={`paragraph-${index}`}>{block.text}</p>;
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return <List className="financial-document-list" key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</List>;
  }
  if (block.type === "callout") {
    return <aside className={`financial-document-callout tone-${block.tone}`} key={`callout-${index}`}>{block.text}</aside>;
  }
  if (block.type === "indicator") {
    const trendLabel = block.trend === "up" ? "Em alta" : block.trend === "down" ? "Em queda" : block.trend === "neutral" ? "Estável" : undefined;
    return (
      <div className="financial-document-indicator" key={`indicator-${index}`}>
        <span className="financial-document-indicator-label">{block.label}</span>
        <strong>{indicatorValue(block, document)}</strong>
        {trendLabel && <span className="financial-document-trend">{trendLabel}</span>}
        {block.detail && <span className="financial-document-indicator-detail">{block.detail}</span>}
      </div>
    );
  }
  return (
    <div className="financial-document-table-wrap" key={`table-${index}`}>
      {block.caption && <div className="financial-document-table-caption">{block.caption}</div>}
      <table className="financial-document-table" aria-label={block.caption ?? sectionTitle}>
        <thead><tr>{block.columns.map((column) => <th key={column.key} className={`align-${column.align ?? "left"}`}>{column.label}</th>)}</tr></thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {block.columns.map((column) => <td key={column.key} className={`align-${column.align ?? "left"}`}>{formatCell(row[column.key] ?? null, column, document)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocumentRenderer({ document: spec }: { document: DocumentSpec }) {
  const rootRef = useRef<HTMLElement>(null);
  const language = spec.metadata.language ?? "pt-BR";

  function downloadJson() {
    downloadFile(
      filenameSlug(spec.title, "json"),
      JSON.stringify(spec, null, 2),
      "application/json;charset=utf-8",
    );
  }

  return (
    <div className="financial-document-shell mt-4 w-full min-w-0">
      <div className="document-toolbar mb-2 flex flex-wrap justify-end gap-2">
        <button
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          onClick={() => printDocument(rootRef.current)}
          type="button"
        >
          Imprimir / salvar PDF
        </button>
        <button
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          onClick={downloadJson}
          type="button"
        >
          Baixar JSON
        </button>
      </div>
      <article ref={rootRef} className="financial-document" lang={language} aria-label={`${documentTypeLabels[spec.document_type]}: ${spec.title}`}>
        <header className="financial-document-header">
          <div className="financial-document-brand">Assistente Financeiro</div>
          <span className={`financial-document-classification class-${spec.metadata.classification}`}>
            {classificationLabels[spec.metadata.classification]}
          </span>
          <p className="financial-document-type">{documentTypeLabels[spec.document_type]}</p>
          <h1 className="financial-document-title">{spec.title}</h1>
          {spec.subtitle && <p className="financial-document-subtitle">{spec.subtitle}</p>}
          {(spec.metadata.as_of || spec.metadata.period || spec.metadata.source || spec.metadata.currency) && (
            <dl className="financial-document-metadata">
              {spec.metadata.as_of && <div><dt>Data-base</dt><dd>{spec.metadata.as_of}</dd></div>}
              {spec.metadata.period && <div><dt>Período</dt><dd>{spec.metadata.period}</dd></div>}
              {spec.metadata.currency && <div><dt>Moeda</dt><dd>{spec.metadata.currency}</dd></div>}
              {spec.metadata.source && <div><dt>Fonte</dt><dd>{spec.metadata.source}</dd></div>}
            </dl>
          )}
          {spec.metadata.notice && <aside className="financial-document-notice">{spec.metadata.notice}</aside>}
        </header>
        <div className="financial-document-content">
          {spec.sections.map((section, sectionIndex) => (
            <section className="financial-document-section" key={`${sectionIndex}-${section.title}`}>
              <h2 className="financial-document-section-title">{section.title}</h2>
              <div className="financial-document-blocks">
                {section.blocks.map((block, blockIndex) => renderBlock(block, spec, section.title, blockIndex))}
              </div>
            </section>
          ))}
        </div>
        {spec.footer && <footer className="financial-document-footer">{spec.footer}</footer>}
        {spec.metadata.generated_at && <div className="financial-document-generated">Gerado em {spec.metadata.generated_at}</div>}
      </article>
    </div>
  );
}
