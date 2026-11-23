"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import useSWR from "swr";
import RichContentRenderer from "../components/rich-content/rich-content-renderer";
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

function getSkillSlashQuery(value: string): string | null {
  const match = value.match(/(?:^|\s)\/([a-z0-9-]*)$/i);
  return match?.[1] ?? null;
}

function getPendingStatus(elapsedSeconds: number, selectedSkillLabels: string[]) {
  if (selectedSkillLabels.length > 0 && elapsedSeconds < 4) {
    return `Pergunta enviada com ${selectedSkillLabels.join(" e ")}.`;
  }
  if (elapsedSeconds < 10) return "Aguardando a resposta…";
  return "A resposta está demorando mais que o normal. Você pode continuar aguardando.";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [activeSkillIndex, setActiveSkillIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [pendingElapsedSeconds, setPendingElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [failedRequest, setFailedRequest] = useState<{
    content: string;
    selectedSkills: string[];
  } | null>(null);
  const [activeSuggestionPage, setActiveSuggestionPage] = useState(0);
  const endOfMessages = useRef<HTMLDivElement>(null);
  const messageSequence = useRef(0);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const suggestionCarousel = useRef<HTMLDivElement>(null);
  const appRoot = useRef<HTMLElement>(null);
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
    endOfMessages.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, pending]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (messages.length > 0 || prefersReducedMotion) {
      return;
    }

    let cancelled = false;
    let animationContext: { revert: () => void } | undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        if (cancelled) return;

        const gsap = gsapModule.gsap;
        const { ScrollTrigger } = scrollTriggerModule;
        gsap.registerPlugin(ScrollTrigger);
        animationContext = gsap.context(() => {
          const entrance = gsap.timeline({ defaults: { ease: "power3.out" } });
          entrance
            .fromTo(
              "[data-brand-mark]",
              { scale: 0.86, rotate: -8 },
              { scale: 1, rotate: 0, duration: 0.48 },
            )
            .fromTo(
              "[data-intro-item]",
              { y: 18 },
              { y: 0, duration: 0.58, stagger: 0.12 },
              "-=0.2",
            )
            .fromTo(
              "[data-signal-path]",
              { strokeDashoffset: 900 },
              { strokeDashoffset: 0, duration: 1.05, ease: "power2.inOut" },
              "-=0.5",
            )
            .fromTo(
              "[data-signal-node]",
              { scale: 0.88, transformOrigin: "50% 50%" },
              { scale: 1, duration: 0.42, stagger: 0.08, ease: "power3.out" },
              "-=0.65",
            );

          gsap.fromTo(
            "[data-suggestion-item]",
            { y: 16 },
            {
              y: 0,
              duration: 0.5,
              stagger: 0.1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: "[data-suggestions]",
                start: "top 84%",
                once: true,
              },
            },
          );
          gsap.fromTo(
            "[data-composer]",
            { y: 10 },
            { y: 0, duration: 0.42, delay: 0.18, ease: "power3.out" },
          );
        }, appRoot);
      },
    ).catch(() => {
      // Motion is an enhancement; the static interface remains complete.
    });

    return () => {
      cancelled = true;
      animationContext?.revert();
    };
  }, [messages.length]);

  useEffect(() => {
    if (!pending) return;

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setPendingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [pending]);

  async function requestAssistant(content: string, skillsForRequest: string[]) {
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
        id: ++messageSequence.current,
        role: "assistant",
        content: documentResponse.content,
        ...(chartResponse.chart ? { chart: chartResponse.chart } : {}),
        ...(documentResponse.document ? { document: documentResponse.document } : {}),
      },
    ]);
  }

  async function runRequest(content: string, skillsForRequest: string[], retry = false) {
    setPendingElapsedSeconds(0);
    setError("");
    setPending(true);
    if (!retry) {
      setFailedRequest(null);
      setMessages((current) => [
        ...current,
        {
          id: ++messageSequence.current,
          role: "user",
          content,
          selectedSkills: skillsForRequest,
        },
      ]);
    }

    try {
      await requestAssistant(content, skillsForRequest);
      setFailedRequest(null);
    } catch {
      const failed = { content, selectedSkills: skillsForRequest };
      setFailedRequest(failed);
      setError("Não consegui concluir a resposta. Sua pergunta foi preservada.");
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(
    contentToSend = input,
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();
    const content = contentToSend.trim();
    if (!content || pending) return;

    const skillsForRequest = selectedSkills;
    setInput("");
    setSelectedSkills([]);
    await runRequest(content, skillsForRequest);
  }

  async function retryFailedRequest() {
    if (!failedRequest || pending) return;
    await runRequest(failedRequest.content, failedRequest.selectedSkills, true);
  }

  function selectSkill(skill: SkillOption) {
    setSelectedSkills((current) =>
      current.includes(skill.name) ? current : [...current, skill.name],
    );
    setInput((current) =>
      current.replace(/(?:^|\s)\/[a-z0-9-]*$/i, "").trimEnd(),
    );
    setActiveSkillIndex(0);
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
    <main ref={appRoot} className="app-shell flex min-h-dvh flex-col text-foreground">
      <a className="skip-link" href="#conversation-content">Pular para o conteúdo principal</a>
      <header className="app-header flex h-[4.5rem] shrink-0 items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Assistente Financeiro, início">
          <span data-brand-mark className="brand-mark flex size-11 items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="size-6">
              <path d="M5 18V11M12 18V6M19 18V9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M3.5 20h17" stroke="#5B7651" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <span className="brand-name block text-sm font-semibold" translate="no">Financial Deep Agent</span>
            <span className="brand-subtitle block text-xs">Assistente financeiro</span>
          </span>
        </Link>
        <span className="status-chip hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          Orientação informativa
        </span>
      </header>

      <section id="conversation-content" className="workspace mx-auto flex w-full flex-1 flex-col px-4 sm:px-8">
        <div className="flex flex-1 flex-col py-4 sm:py-6">
          {messages.length === 0 ? (
            <div className="welcome-screen m-auto">
              <div className="welcome-hero">
                <div className="hero-copy-block">
                  <h1 data-intro-item className="hero-title">
                    Entenda o que<br />
                    <em>move seus números.</em>
                  </h1>
                  <p data-intro-item className="hero-copy mt-5">
                    Explore conceitos, compare cenários e visualize dados financeiros.
                  </p>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <svg className="signal-art" viewBox="0 0 520 180" fill="none">
                    <path className="signal-track" data-signal-path d="M260 90C230 52 110 52 90 90C70 128 230 128 260 90C290 52 410 52 430 90C450 128 290 128 260 90" />
                    <path className="signal-flow" d="M260 90C230 52 110 52 90 90C70 128 230 128 260 90C290 52 410 52 430 90C450 128 290 128 260 90" />
                    <g data-signal-node transform="translate(90 90)">
                      <circle className="signal-node-shell" r="36" />
                      <circle className="signal-node-core" r="26" />
                      <path d="M-9-5h18v13H1l-7 5V8h-3z" stroke="#17353A" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M-5-1h10M-5 3h7" stroke="#17353A" strokeWidth="1.5" strokeLinecap="round" />
                      <text className="signal-label" y="51" textAnchor="middle">PERGUNTA</text>
                      <text className="signal-caption" y="67" textAnchor="middle">o ponto de partida</text>
                    </g>
                    <g data-signal-node transform="translate(260 90)">
                      <circle className="signal-node-shell" r="42" />
                      <circle className="signal-node-core-aqua" r="31" />
                      <path d="M-13 10h26M-10 6V-2M-2 6V-11M6 6V-7M13 6V-15" stroke="#10272C" strokeWidth="2" strokeLinecap="round" />
                      <text className="signal-label" y="55" textAnchor="middle">ANÁLISE</text>
                      <text className="signal-caption" y="71" textAnchor="middle">ideias em relação</text>
                    </g>
                    <g data-signal-node transform="translate(430 90)">
                      <circle className="signal-node-shell" r="36" />
                      <circle className="signal-node-core-violet" r="26" />
                      <path d="m-9 0 6 6 12-13" stroke="#1C1932" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <text className="signal-label" y="51" textAnchor="middle">CLAREZA</text>
                      <text className="signal-caption" y="67" textAnchor="middle">próximo passo</text>
                    </g>
                  </svg>
                </div>
              </div>
              <div data-suggestions className="suggestions-area">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="suggestions-title">Comece por aqui</h2>
                  <div className="flex items-center gap-2">
                    <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
                      {activeSuggestionPage + 1} / {suggestionPages.length}
                    </span>
                    <button
                      type="button"
                      className="carousel-control flex size-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Sugestões anteriores"
                      disabled={activeSuggestionPage === 0}
                      onClick={() => goToSuggestionPage(activeSuggestionPage - 1)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true"><path d="m14.5 5-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button
                      type="button"
                      className="carousel-control flex size-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Próximas sugestões"
                      disabled={activeSuggestionPage === suggestionPages.length - 1}
                      onClick={() => goToSuggestionPage(activeSuggestionPage + 1)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true"><path d="m9.5 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>
                <div
                  ref={suggestionCarousel}
                  className="suggestion-carousel flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
                  role="region"
                  aria-roledescription="carrossel"
                  aria-label="Sugestões de conversa"
                  onScroll={(event) => {
                    const width = event.currentTarget.clientWidth;
                    if (width > 0) {
                      setActiveSuggestionPage(Math.round(event.currentTarget.scrollLeft / width));
                    }
                  }}
                >
                  {suggestionPages.map((page, pageIndex) => (
                    <div className="grid min-w-full flex-none snap-start grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3" key={pageIndex} role="group" aria-roledescription="página" aria-label={`Página ${pageIndex + 1} de ${suggestionPages.length}`}>
                      {page.map((suggestion) => (
                        <button
                          data-suggestion-item
                          className="suggestion-card group flex min-h-[4.5rem] items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:flex-col sm:items-start sm:gap-0 sm:p-4"
                          key={suggestion.title}
                          disabled={pending}
                          onClick={() => void sendMessage(suggestion.prompt)}
                          type="button"
                        >
                          <span className="suggestion-level hidden shrink-0 sm:block">
                            {suggestion.level}
                          </span>
                          <span className="min-w-0 flex-1 sm:mt-1.5 sm:flex-none">
                            <span className="suggestion-title block text-sm leading-5">
                              {suggestion.title}
                            </span>
                            <span className="suggestion-summary mt-0.5 block text-xs leading-5 sm:mt-1">
                              {suggestion.summary}
                            </span>
                          </span>
                          <span className="suggestion-action flex size-10 shrink-0 items-center justify-center rounded-full transition-colors sm:mt-auto sm:size-auto sm:w-full sm:justify-between sm:rounded-none sm:bg-transparent sm:pt-3 sm:text-xs sm:font-medium">
                            <span className="hidden sm:inline">Usar exemplo</span>
                            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-center gap-1" role="group" aria-label="Páginas de sugestões">
                  {suggestionPages.map((_, pageIndex) => (
                    <button
                      key={pageIndex}
                      type="button"
                      className="carousel-dot flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label={`Ir para página ${pageIndex + 1} de sugestões`}
                      aria-current={activeSuggestionPage === pageIndex ? "page" : undefined}
                      onClick={() => goToSuggestionPage(pageIndex)}
                    ><span aria-hidden="true" className={`block h-1.5 rounded-full transition-[width,background-color] ${activeSuggestionPage === pageIndex ? "w-6 bg-primary" : "w-1.5 bg-mist-border hover:bg-muted-foreground"}`} /></button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="conversation mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 pb-8" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversa com o assistente">
              {messages.map((message) => (
                <article className={`message-row flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={message.id}>
                  {message.role === "assistant" && (
                    <span className="assistant-avatar mr-3 mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl" aria-label="Assistente">
                      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true"><path d="M5 18V11M12 18V6M19 18V9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M3.5 20h17" stroke="#C7F36A" strokeWidth="1.7" strokeLinecap="round" /></svg>
                    </span>
                  )}
                  <div className={`max-w-[92%] break-words rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[88%] sm:px-5 ${message.role === "user" ? "user-bubble whitespace-pre-wrap rounded-br-md" : "assistant-bubble rounded-bl-md border"}`}>
                    {message.role === "user" ? (
                      <>
                        {message.selectedSkills &&
                          message.selectedSkills.length > 0 && (
                          <span className="user-skill-label mb-1 block text-xs font-medium">
                            Com apoio de: {message.selectedSkills
                              .map((name) => skillLabel(name, skillOptions))
                              .join(", ")}
                          </span>
                        )}
                        <p>{message.content}</p>
                      </>
                    ) : (
                      <>
                        <RichContentRenderer content={message.content} />
                        {message.document && <DocumentRenderer document={message.document} />}
                        {message.chart && <ChartRenderer chart={message.chart} />}
                      </>
                    )}
                  </div>
                </article>
              ))}
              {pending && (
                <div
                  className="pending-status flex items-center gap-3 text-sm"
                  role="status"
                  aria-live="polite"
                  aria-label={pendingStatus}
                >
                  <span className="assistant-avatar flex size-9 items-center justify-center rounded-xl" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" className="size-5"><path d="M5 18V11M12 18V6M19 18V9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><path d="M3.5 20h17" stroke="#C7F36A" strokeWidth="1.7" strokeLinecap="round" /></svg>
                  </span>
                  <span className="pending-bubble inline-flex items-center gap-3 rounded-2xl rounded-bl-md border px-4 py-3">
                    <span key={pendingStatus}>
                      {pendingStatus}
                    </span>
                    <span className="inline-flex items-center gap-1" aria-hidden="true">
                      {[0, 1, 2].map((dot) => (
                        <span
                          className="typing-dot size-1.5 rounded-full bg-river"
                          key={dot}
                          style={{ animationDelay: `${dot * 0.18}s` }}
                        />
                      ))}
                    </span>
                  </span>
                </div>
              )}
              {error && (
                <div className="error-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm" role="alert">
                  <p>{error}</p>
                  {failedRequest && (
                    <button
                      type="button"
                      className="error-retry min-h-11 rounded-lg px-3 font-semibold underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical focus-visible:ring-offset-2"
                      onClick={() => void retryFailedRequest()}
                      disabled={pending}
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>
              )}
              <div ref={endOfMessages} />
            </div>
          )}
        </div>

        <div data-composer className="composer-dock sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:-mx-8 sm:px-8">
          <form onSubmit={(event) => void sendMessage(input, event)} className="composer-form relative mx-auto max-w-3xl rounded-2xl border p-2 transition-[border-color,box-shadow]">
            {skillSlashQuery !== null && (
              <div
                className="skill-menu absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border"
                aria-label="Skills disponíveis"
                id="skill-options"
                role={matchingSkills.length > 0 && !skillsLoading && !skillsError ? "listbox" : "region"}
              >
                <p className="px-4 py-2 text-xs font-medium text-muted-foreground">
                  Usar uma Skill
                </p>
                {skillsLoading ? (
                  <p className="px-4 pb-3 text-sm text-muted-foreground">
                    Carregando Skills...
                  </p>
                ) : skillsError ? (
                  <p className="px-4 pb-3 text-sm text-critical" role="alert">
                    Não foi possível carregar as Skills. Tente novamente mais tarde.
                  </p>
                ) : matchingSkills.length > 0 ? (
                  matchingSkills.map((skill, index) => (
                    <button
                      key={skill.name}
                      type="button"
                      id={`skill-option-${skill.name}`}
                      role="option"
                      aria-selected={index === activeSkillIndex}
                      className="skill-option block min-h-14 w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onClick={() => selectSkill(skill)}
                      onMouseEnter={() => setActiveSkillIndex(index)}
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        {skillLabel(skill.name, skillOptions)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {skillDescription(skill)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="skill-empty px-4 pb-3 text-sm">
                    Nenhuma Skill encontrada.
                  </p>
                )}
              </div>
            )}
            {selectedSkillOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 px-3 pb-2 pt-1">
                {selectedSkillOptions.map((skill) => (
                  <span
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                    key={skill.name}
                  >
                    {skillLabel(skill.name, skillOptions)}
                    <button
                      type="button"
                      className="skill-chip-remove flex size-8 items-center justify-center rounded-full text-secondary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              name="message"
              autoComplete="off"
              ref={messageInput}
              className="composer-input max-h-36 min-h-12 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Ex.: explique juros compostos…"
              value={input}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={matchingSkills.length > 0 && !skillsLoading && !skillsError}
              aria-controls={skillSlashQuery !== null ? "skill-options" : undefined}
              aria-activedescendant={matchingSkills.length > 0 ? `skill-option-${matchingSkills[Math.min(activeSkillIndex, matchingSkills.length - 1)].name}` : undefined}
              aria-describedby="composer-hint"
              onChange={(event) => {
                setInput(event.target.value);
                setActiveSkillIndex(0);
              }}
              onKeyDown={(event) => {
                if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matchingSkills.length > 0) {
                  event.preventDefault();
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  setActiveSkillIndex((current) =>
                    (current + direction + matchingSkills.length) % matchingSkills.length,
                  );
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (skillSlashQuery !== null && matchingSkills.length > 0) {
                    selectSkill(matchingSkills[Math.min(activeSkillIndex, matchingSkills.length - 1)]);
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 pt-2">
              <p id="composer-hint" className="composer-hint min-w-0 flex-1 text-xs leading-5">Use / para escolher uma Skill. Enter envia; Shift + Enter cria uma linha.</p>
              <button
                type="submit"
                disabled={!input.trim() || pending}
                className="composer-send flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground"
                aria-label="Enviar mensagem"
                title="Enviar mensagem"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                  <path d="M12 19V5m0 0L6 11m6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
          <p className="composer-disclaimer mx-auto mt-3 max-w-3xl text-center text-xs leading-5">As respostas são informativas e não substituem orientação financeira personalizada.</p>
        </div>
      </section>
    </main>
  );
}
