"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  "Como montar uma reserva de emergência?",
  "Explique a diferença entre CDI e Selic",
  "Como calcular juros compostos?",
];

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

function normalizeMathDelimiters(markdown: string) {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `\n$$\n${formula.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`);
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const endOfMessages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;

    const userMessage: Message = { id: Date.now(), role: "user", content };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setPending(true);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
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

      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: data.resposta.trim() },
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

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f8fa]">
      <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-10">
        <a href="/" className="flex items-center gap-3" aria-label="Assistente Financeiro, início">
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">F</span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Assistente Financeiro</span>
            <span className="block text-xs text-slate-500">Seu espaço para aprender</span>
          </span>
        </a>
        <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
          Chat financeiro
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-8">
        <div className="flex flex-1 flex-col py-8 sm:py-12">
          {messages.length === 0 ? (
            <div className="m-auto w-full max-w-2xl pb-12">
              <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
                  <path d="M4 18.5V5.8c0-.99.81-1.8 1.8-1.8h12.4c.99 0 1.8.81 1.8 1.8v9.4c0 .99-.81 1.8-1.8 1.8H9l-5 3v-1.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
              <p className="mb-2 text-sm font-medium text-indigo-700">Olá, vamos conversar?</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Como posso ajudar você hoje?</h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">Tire dúvidas sobre finanças pessoais, peça explicações ou explore conceitos no seu ritmo.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <button
                    className="rounded-xl border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/50"
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    type="button"
                  >
                    {suggestion}
                    <span className="mt-2 block text-lg text-indigo-600" aria-hidden="true">↗</span>
                  </button>
                ))}
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
                      <p>{message.content}</p>
                    ) : (
                      <div className="chat-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {normalizeMathDelimiters(message.content)}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {pending && (
                <div className="flex items-center gap-3 text-sm text-slate-500" role="status">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">F</span>
                  Preparando uma resposta...
                </div>
              )}
              {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
              <div ref={endOfMessages} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[#f7f8fa] pb-5 pt-2">
          <form onSubmit={sendMessage} className="mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
            <label className="sr-only" htmlFor="message">Escreva sua mensagem</label>
            <textarea
              id="message"
              className="max-h-36 min-h-12 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Escreva sua pergunta..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
            />
            <div className="flex items-center justify-between border-t border-slate-100 px-2 pt-2">
              <p className="text-xs text-slate-400">Enter para enviar · Shift + Enter para nova linha</p>
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
