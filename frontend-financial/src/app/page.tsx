"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import useSWR from "swr";
import ChartRenderer from "./chart-renderer";
import type { ChartSpec } from "./chart-renderer";
import DocumentRenderer, { isDocumentSpec } from "./document-renderer";
import type { DocumentSpec } from "./document-renderer";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  selectedSkills?: string[];
  chart?: ChartSpec;
  document?: DocumentSpec;
};

type SkillOption = {
  name: string;
  label: string;
  description: string;
};

const suggestions = [
  {
    level: "Iniciante",
    title: "Organize gastos do mês",
    summary: "Veja um exemplo de orçamento em um gráfico de barras.",
    prompt: "Use estes dados fictícios de gastos mensais: moradia R$ 1.400, alimentação R$ 850, transporte R$ 300 e lazer R$ 450. Mostre em um gráfico de barras e explique o que chama atenção.",
  },
  {
    level: "Iniciante",
    title: "Entenda a regra 50/30/20",
    summary: "Distribua uma renda de exemplo e visualize cada parte.",
    prompt: "Explique a regra 50/30/20 usando uma renda mensal fictícia de R$ 4.000. Mostre necessidades, desejos e objetivos em um gráfico de rosca.",
  },
  {
    level: "Iniciante",
    title: "Planeje uma reserva",
    summary: "Calcule uma meta simples com despesas mensais de exemplo.",
    prompt: "Considere despesas mensais fictícias de R$ 2.500. Explique uma meta de reserva para 6 meses e mostre o progresso em um gráfico, partindo de R$ 5.000 guardados.",
  },
  {
    level: "Intermediário",
    title: "Visualize uma carteira fictícia",
    summary: "Compare a distribuição entre classes de ativos.",
    prompt: "Monte um gráfico de rosca para esta carteira fictícia de R$ 100.000: renda fixa R$ 45.000, ações R$ 30.000, FIIs R$ 15.000 e caixa R$ 10.000. Explique a distribuição.",
  },
  {
    level: "Intermediário",
    title: "Compare rendimentos",
    summary: "Explore uma série mensal de exemplo em um gráfico de linhas.",
    prompt: "Compare estas rentabilidades mensais fictícias em um gráfico de linhas: Fundo A: 0%, 1%, 2%, 1%, 3%; Fundo B: 0%, 2%, 1%, 2%, 2,5%. Explique a diferença sem tratar os dados como reais.",
  },
  {
    level: "Intermediário",
    title: "Prepare um resumo financeiro",
    summary: "Veja um documento formatado a partir de dados fornecidos.",
    prompt: "Crie um resumo financeiro demonstrativo com estes dados fictícios: renda mensal R$ 7.500, despesas R$ 5.200, economia no mês R$ 2.300. Inclua um título, indicadores e uma tabela curta.",
  },
  {
    level: "Avançado",
    title: "Acompanhe uma ação da B3",
    summary: "Busque uma série histórica na BRAPI e visualize a tendência.",
    prompt: "Consulte na BRAPI a série histórica de PETR4 dos últimos 3 meses. Crie um gráfico de linhas com os dados retornados e informe a fonte e o período disponível. Não invente pontos que a consulta não trouxer.",
  },
  {
    level: "Avançado",
    title: "Veja a cotação atual",
    summary: "Consulte um preço disponível na BRAPI e visualize o resultado.",
    prompt: "Consulte na BRAPI a cotação atual de PETR4. Mostre o preço retornado em um gráfico de barras, informe a data ou horário da cotação e cite a fonte. Mencione a variação percentual no texto, sem inventar dados.",
  },
  {
    level: "Avançado",
    title: "Analise risco e retorno",
    summary: "Use dados fictícios para explorar uma relação em dispersão.",
    prompt: "Com dados fictícios, crie um gráfico de dispersão de risco anual x retorno anual para quatro ativos: A (risco 5%, retorno 7%), B (10%, 12%), C (18%, 14%) e D (8%, 6%). Explique como ler os pontos.",
  },
];
const suggestionPages = Array.from(
  { length: Math.ceil(suggestions.length / 3) },
  (_, page) => suggestions.slice(page * 3, page * 3 + 3),
);

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

function isSkillOption(value: unknown): value is SkillOption {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "label" in value &&
    typeof value.label === "string" &&
    "description" in value &&
    typeof value.description === "string"
  );
}

function isChartSpec(value: unknown): value is ChartSpec {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const supportedTypes = ["bar", "line", "area", "pie", "composed", "scatter", "radar", "radialBar", "treemap", "funnel", "sankey", "sunburst"];
  if (typeof candidate.type !== "string" || !supportedTypes.includes(candidate.type)) return false;
  if (typeof candidate.title !== "string" || !candidate.title.trim()) return false;

  const isRecord = (entry: unknown): entry is Record<string, unknown> =>
    typeof entry === "object" && entry !== null && !Array.isArray(entry);
  const isHierarchyNode = (entry: unknown): boolean => {
    if (!isRecord(entry) || (typeof entry.label !== "string" && typeof entry.name !== "string")) return false;
    if (typeof entry.value !== "number" || !Number.isFinite(entry.value) || entry.value < 0) return false;
    return entry.children === undefined || (Array.isArray(entry.children) && entry.children.length > 0 && entry.children.every(isHierarchyNode));
  };
  const rows = candidate.data;
  if (candidate.type === "sankey") {
    if (!Array.isArray(candidate.nodes) || candidate.nodes.length < 2 || !candidate.nodes.every((node) => isRecord(node) && typeof node.name === "string")) return false;
    const nodes = candidate.nodes;
    if (!Array.isArray(candidate.links) || candidate.links.length === 0 || !candidate.links.every((link) =>
      isRecord(link) && Number.isInteger(link.source) && Number.isInteger(link.target) &&
      Number(link.source) >= 0 && Number(link.target) >= 0 && Number(link.source) < nodes.length && Number(link.target) < nodes.length &&
      link.source !== link.target && typeof link.value === "number" && Number.isFinite(link.value) && link.value >= 0,
    )) return false;
  } else {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 100) return false;
    const allRowsValid = rows.every((row) => {
      if (!isRecord(row)) return false;
      if (candidate.type === "scatter") {
        const xKey = typeof candidate.x_key === "string" ? candidate.x_key : "x";
        const yKey = typeof candidate.y_key === "string" ? candidate.y_key : "y";
        return typeof row[xKey] === "number" && Number.isFinite(row[xKey]) && typeof row[yKey] === "number" && Number.isFinite(row[yKey]);
      }
      const hasLabel = typeof row.label === "string" || typeof row.name === "string";
      if (!hasLabel) return false;
      if (candidate.type === "treemap" || candidate.type === "sunburst") {
        return isHierarchyNode(row);
      }
      const chartSeries = Array.isArray(candidate.series) ? candidate.series : [];
      const keys = chartSeries.length ? chartSeries.map((entry) => isRecord(entry) ? entry.key : undefined) : ["value"];
      return keys.every((key) => typeof key === "string" && typeof row[key] === "number" && Number.isFinite(row[key]));
    });
    if (!allRowsValid) return false;
    if (candidate.type === "pie" || candidate.type === "radialBar" || candidate.type === "funnel") {
      const values = rows.map((row) => isRecord(row) ? row.value : undefined);
      if (!values.every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0)) return false;
      if (candidate.type === "pie" && values.reduce<number>((total, item) => total + Number(item), 0) <= 0) return false;
      if (candidate.type === "funnel" && values.some((item, index) => index > 0 && Number(item) > Number(values[index - 1]))) return false;
    }
    if (candidate.series !== undefined && (!Array.isArray(candidate.series) || candidate.series.length === 0 || !candidate.series.every((entry) =>
      isRecord(entry) && typeof entry.key === "string" && entry.key.length > 0 &&
      (entry.type === undefined || ["bar", "line", "area"].includes(String(entry.type))),
    ))) return false;
  }

  return (
    (candidate.colors === undefined || (Array.isArray(candidate.colors) && candidate.colors.every((color) => typeof color === "string"))) &&
    (candidate.unit === undefined || typeof candidate.unit === "string") &&
    (candidate.as_of === undefined || typeof candidate.as_of === "string") &&
    (candidate.mock === undefined || typeof candidate.mock === "boolean")
  );
}

function parseChartResponse(content: string): { content: string; chart?: ChartSpec } {
  const match = content.match(/```chart\s*\n([\s\S]*?)\n```/i);
  if (!match) return { content };

  try {
    const chart: unknown = JSON.parse(match[1]);
    if (isChartSpec(chart)) {
      const start = match.index ?? content.indexOf(match[0]);
      return {
        content: `${content.slice(0, start)}${content.slice(start + match[0].length)}`.trim(),
        chart,
      };
    }
  } catch {
    // Keep malformed model output visible as markdown so it can be inspected.
  }

  return { content };
}

function parseDocumentResponse(content: string): { content: string; document?: DocumentSpec } {
  const match = content.match(/```document\s*\n([\s\S]*?)\n```/i);
  if (!match) return { content };

  try {
    const document: unknown = JSON.parse(match[1]);
    if (isDocumentSpec(document)) {
      const start = match.index ?? content.indexOf(match[0]);
      return {
        content: `${content.slice(0, start)}${content.slice(start + match[0].length)}`.trim(),
        document,
      };
    }
  } catch {
    // Keep malformed model output visible as markdown so it can be inspected.
  }

  return { content };
}

async function fetchSkills(url: string): Promise<SkillOption[]> {
  const response = await fetch(url, {
    headers: { "Accept-Language": "pt-BR" },
  });
  if (!response.ok) {
    throw new Error(`A API respondeu com status ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("A API retornou um catálogo de Skills inválido.");
  }

  const skills = payload.filter(isSkillOption);
  if (skills.length !== payload.length) {
    throw new Error("A API retornou um catálogo de Skills inválido.");
  }
  return skills;
}

function skillLabel(name: string, skills: SkillOption[]): string {
  if (name === "chart-visualization") return "Gráficos";
  return (
    skills.find((skill) => skill.name === name)?.label ??
    name.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function skillDescription(skill: SkillOption): string {
  if (skill.name === "chart-visualization") {
    return "Cria gráficos interativos com dados de demonstração.";
  }
  return skill.description;
}

function normalizeMathDelimiters(markdown: string) {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `\n$$\n${formula.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`);
}

function getSkillSlashQuery(value: string): string | null {
  const match = value.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
  return match?.[1] ?? null;
}

function getPendingStatus(elapsedSeconds: number, selectedSkillLabels: string[]) {
  if (elapsedSeconds < 2) {
    return selectedSkillLabels.length > 0
      ? `Estou considerando ${selectedSkillLabels.join(" e ")} para orientar a resposta...`
      : "Estou analisando sua pergunta...";
  }
  if (elapsedSeconds < 4) {
    return "Estou organizando os pontos mais importantes...";
  }
  if (elapsedSeconds < 7) {
    return "Estou preparando uma resposta clara e cuidadosa...";
  }
  if (elapsedSeconds < 10) {
    return "Estou cuidando para responder sua pergunta com atenção...";
  }
  return "A resposta está levando um pouco mais de tempo. Assim que chegar, ela aparece aqui.";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [pendingElapsedSeconds, setPendingElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [activeSuggestionPage, setActiveSuggestionPage] = useState(0);
  const endOfMessages = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const suggestionCarousel = useRef<HTMLDivElement>(null);
  const {
    data: skillOptions = [],
    error: skillsError,
    isLoading: skillsLoading,
  } = useSWR<SkillOption[]>(`${apiUrl}/skills`, fetchSkills);
  const skillSlashQuery = getSkillSlashQuery(input);
  const matchingSkills =
    skillSlashQuery === null
      ? []
      : skillOptions.filter((skill) =>
          !selectedSkills.includes(skill.name) &&
          `${skill.name} ${skillLabel(skill.name, skillOptions)} ${skill.description}`
            .toLowerCase()
            .includes(skillSlashQuery.toLowerCase()),
        );
  const selectedSkillOptions = skillOptions.filter((skill) =>
    selectedSkills.includes(skill.name),
  );
  const latestMessage = messages[messages.length - 1];
  const pendingSkillLabels =
    latestMessage?.role === "user"
      ? (latestMessage.selectedSkills ?? []).map((name) =>
          skillLabel(name, skillOptions),
        )
      : [];
  const pendingStatus = getPendingStatus(
    pendingElapsedSeconds,
    pendingSkillLabels,
  );

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!pending) {
      setPendingElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setPendingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [pending]);

  async function sendMessage(
    contentToSend = input,
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();
    const content = contentToSend.trim();
    if (!content || pending) return;

    const skillsForRequest = selectedSkills;
    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content,
      selectedSkills: skillsForRequest,
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSelectedSkills([]);
    setError("");
    setPending(true);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": "pt-BR",
        },
        body: JSON.stringify({
          message: content,
          ...(skillsForRequest.length > 0
            ? { selected_skills: skillsForRequest }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`A API respondeu com status ${response.status}.`);
      }

      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("resposta" in data) ||
        typeof data.resposta !== "string"
      ) {
        throw new Error("A resposta da API não contém o campo 'resposta'.");
      }

      const chartResponse = parseChartResponse(data.resposta);
      const documentResponse = parseDocumentResponse(chartResponse.content);

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: documentResponse.content,
          ...(chartResponse.chart ? { chart: chartResponse.chart } : {}),
          ...(documentResponse.document ? { document: documentResponse.document } : {}),
        },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} Verifique se a API está ativa em ${apiUrl}.`
          : `Não foi possível conectar à API em ${apiUrl}.`,
      );
    } finally {
      setPending(false);
    }
  }

  function selectSkill(skill: SkillOption) {
    setSelectedSkills((current) =>
      current.includes(skill.name) ? current : [...current, skill.name],
    );
    setInput((current) =>
      current.replace(/(?:^|\s)\/[a-z0-9-]*$/i, "").trimEnd(),
    );
    messageInput.current?.focus();
  }

  function goToSuggestionPage(page: number) {
    const carousel = suggestionCarousel.current;
    if (!carousel) return;
    const nextPage = Math.max(0, Math.min(page, suggestionPages.length - 1));
    carousel.scrollTo({ left: nextPage * carousel.clientWidth, behavior: "smooth" });
    setActiveSuggestionPage(nextPage);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f8fa]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="Assistente Financeiro, início">
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">F</span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Assistente Financeiro</span>
            <span className="block text-xs text-slate-500">Seu espaço para aprender</span>
          </span>
        </a>
        <span className="hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 sm:inline-flex">
          Chat financeiro
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-8">
        <div className="flex flex-1 flex-col py-4 sm:py-6">
          {messages.length === 0 ? (
            <div className="m-auto w-full max-w-3xl py-2">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
                  <path d="M4 18.5V5.8c0-.99.81-1.8 1.8-1.8h12.4c.99 0 1.8.81 1.8 1.8v9.4c0 .99-.81 1.8-1.8 1.8H9l-5 3v-1.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
              <p className="mb-1 text-sm font-medium text-indigo-700">Olá, vamos conversar?</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Como posso ajudar você hoje?</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Tire dúvidas, explore exemplos financeiros ou peça gráficos e documentos.</p>
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-800">Sugestões para começar</h2>
                  <div className="flex items-center gap-2">
                    <span className="min-w-10 text-center text-xs tabular-nums text-slate-500" aria-live="polite">
                      {activeSuggestionPage + 1} / {suggestionPages.length}
                    </span>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40"
                      aria-label="Sugestões anteriores"
                      disabled={activeSuggestionPage === 0}
                      onClick={() => goToSuggestionPage(activeSuggestionPage - 1)}
                    >
                      <span aria-hidden="true">←</span>
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40"
                      aria-label="Próximas sugestões"
                      disabled={activeSuggestionPage === suggestionPages.length - 1}
                      onClick={() => goToSuggestionPage(activeSuggestionPage + 1)}
                    >
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
                <div
                  ref={suggestionCarousel}
                  className="suggestion-carousel flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
                  aria-label="Sugestões de conversa"
                  onScroll={(event) => {
                    const width = event.currentTarget.clientWidth;
                    if (width > 0) {
                      setActiveSuggestionPage(Math.round(event.currentTarget.scrollLeft / width));
                    }
                  }}
                >
                  {suggestionPages.map((page, pageIndex) => (
                    <div className="grid min-w-full flex-none snap-start grid-cols-1 gap-3 sm:grid-cols-3" key={pageIndex}>
                      {page.map((suggestion) => (
                        <button
                          className="group flex min-h-32 flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-wait disabled:opacity-60 sm:min-h-36"
                          key={suggestion.title}
                          disabled={pending}
                          onClick={() => void sendMessage(suggestion.prompt)}
                          type="button"
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                            {suggestion.level}
                          </span>
                          <span className="mt-1.5 text-sm font-semibold leading-5 text-slate-800 group-hover:text-indigo-800">
                            {suggestion.title}
                          </span>
                          <span className="mt-1 text-xs leading-5 text-slate-500">
                            {suggestion.summary}
                          </span>
                          <span className="mt-auto flex w-full items-center justify-between pt-3 text-xs font-medium text-indigo-600">
                            Começar conversa <span aria-hidden="true">↗</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-center gap-1.5" aria-label="Páginas de sugestões">
                  {suggestionPages.map((_, pageIndex) => (
                    <button
                      key={pageIndex}
                      type="button"
                      className={`h-1.5 rounded-full transition-all ${activeSuggestionPage === pageIndex ? "w-6 bg-indigo-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                      aria-label={`Ir para página ${pageIndex + 1} de sugestões`}
                      aria-current={activeSuggestionPage === pageIndex ? "page" : undefined}
                      onClick={() => goToSuggestionPage(pageIndex)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 pb-8" aria-live="polite">
              {messages.map((message) => (
                <article className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={message.id}>
                  {message.role === "assistant" && (
                    <span className="mr-3 mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white" aria-label="Assistente">F</span>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 sm:px-5 ${message.role === "user" ? "whitespace-pre-wrap rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm"}`}>
                    {message.role === "user" ? (
                      <>
                        {message.selectedSkills &&
                          message.selectedSkills.length > 0 && (
                          <span className="mb-1 block text-xs font-medium text-indigo-100">
                            Skills: {message.selectedSkills
                              .map((name) => skillLabel(name, skillOptions))
                              .join(", ")}
                          </span>
                        )}
                        <p>{message.content}</p>
                      </>
                    ) : (
                      <>
                        <div className="chat-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {normalizeMathDelimiters(message.content)}
                          </ReactMarkdown>
                        </div>
                        {message.document && <DocumentRenderer document={message.document} />}
                        {message.chart && <ChartRenderer chart={message.chart} />}
                      </>
                    )}
                  </div>
                </article>
              ))}
              {pending && (
                <div
                  className="flex items-center gap-3 text-sm text-slate-500"
                  role="status"
                  aria-live="polite"
                  aria-label={pendingStatus}
                >
                  <span className="typing-avatar relative flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                    F
                  </span>
                  <span className="typing-bubble inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <span key={pendingStatus} className="typing-copy">
                      {pendingStatus}
                    </span>
                    <span className="inline-flex items-center gap-1" aria-hidden="true">
                      {[0, 1, 2].map((dot) => (
                        <span
                          className="typing-dot size-1.5 rounded-full bg-indigo-500"
                          key={dot}
                          style={{ animationDelay: `${dot * 0.18}s` }}
                        />
                      ))}
                    </span>
                  </span>
                </div>
              )}
              {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
              <div ref={endOfMessages} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#f7f8fa] pb-5 pt-2">
          <form onSubmit={(event) => void sendMessage(input, event)} className="relative mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
            {skillSlashQuery !== null && (
              <div
                className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                aria-label="Skills disponíveis"
                id="skill-options"
                role="region"
              >
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Usar uma Skill
                </p>
                {skillsLoading ? (
                  <p className="px-4 pb-3 text-sm text-slate-500">
                    Carregando Skills...
                  </p>
                ) : skillsError ? (
                  <p className="px-4 pb-3 text-sm text-rose-600" role="alert">
                    Não foi possível carregar as Skills. Tente novamente mais tarde.
                  </p>
                ) : matchingSkills.length > 0 ? (
                  matchingSkills.map((skill) => (
                    <button
                      key={skill.name}
                      type="button"
                      className="block w-full px-4 py-3 text-left transition hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
                      onClick={() => selectSkill(skill)}
                    >
                      <span className="block text-sm font-medium text-slate-800">
                        {skillLabel(skill.name, skillOptions)}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {skillDescription(skill)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 pb-3 text-sm text-slate-500">
                    Nenhuma Skill encontrada.
                  </p>
                )}
              </div>
            )}
            {selectedSkillOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pb-2 pt-1">
                {selectedSkillOptions.map((skill) => (
                  <span
                    className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                    key={skill.name}
                  >
                    {skillLabel(skill.name, skillOptions)}
                    <button
                      type="button"
                      className="rounded-full px-1 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
                      aria-label={`Remover Skill ${skillLabel(skill.name, skillOptions)}`}
                      onClick={() =>
                        setSelectedSkills((current) =>
                          current.filter((name) => name !== skill.name),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <label className="sr-only" htmlFor="message">Escreva sua mensagem</label>
            <textarea
              id="message"
              ref={messageInput}
              className="max-h-36 min-h-12 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Escreva sua pergunta..."
              value={input}
              aria-expanded={skillSlashQuery !== null}
              aria-controls={skillSlashQuery !== null ? "skill-options" : undefined}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (skillSlashQuery !== null && matchingSkills.length > 0) {
                    selectSkill(matchingSkills[0]);
                    return;
                  }
                  event.currentTarget.form?.requestSubmit();
                } else if (event.key === "Escape" && skillSlashQuery !== null) {
                  event.preventDefault();
                  setInput((current) =>
                    current.replace(/(?:^|\s)\/[a-z0-9-]*$/i, "").trimEnd(),
                  );
                }
              }}
              rows={1}
            />
            <div className="flex items-center justify-between border-t border-slate-100 px-2 pt-2">
              <p className="text-xs text-slate-400">Digite / para adicionar Skills · Enter para enviar · Shift + Enter para nova linha</p>
              <button
                type="submit"
                disabled={!input.trim() || pending}
                className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                aria-label="Enviar mensagem"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                  <path d="M12 19V5m0 0L6 11m6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
          <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-slate-400">As respostas são informativas e não substituem orientação financeira personalizada.</p>
        </div>
      </section>
    </main>
  );
}
