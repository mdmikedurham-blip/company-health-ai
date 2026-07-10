"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  doctorDocumentCount,
  doctorInitialMessages,
  doctorResponses,
  doctorSuggestedPrompts,
  getDoctorExplainPrompt,
  getDoctorExplainResponse,
} from "@/lib/doctor";
import type { DoctorMessage } from "@/lib/types";
import { DoctorResponseCard } from "./DoctorResponseCard";

interface DoctorChatProps {
  initialPrompt?: string;
  explainRiskId?: string;
}

function formatTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function findResponse(content: string) {
  return (
    doctorResponses[content] ?? {
      summary:
        "I've reviewed your connected systems but need more context to give a precise answer. Try one of the suggested prompts, or ask about a specific dimension, risk, or document.",
      riskLevel: "low" as const,
      evidenceSources: ["Google Drive", "QuickBooks", "HubSpot", "Box", "Carta"],
      recommendedAction:
        "Use the suggested prompts below to explore specific areas of company health.",
    }
  );
}

export function DoctorChat({ initialPrompt, explainRiskId }: DoctorChatProps) {
  const [messages, setMessages] = useState<DoctorMessage[]>(doctorInitialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const sendMessage = useCallback(
    (content: string, responseOverride?: DoctorMessage["response"]) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: DoctorMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: trimmed,
        timestamp: formatTime(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsTyping(true);

      setTimeout(() => {
        const response = responseOverride ?? findResponse(trimmed);
        const assistantMessage: DoctorMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: "",
          timestamp: formatTime(),
          response,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsTyping(false);
        setTimeout(scrollToBottom, 50);
      }, 900);
    },
    [scrollToBottom],
  );

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (handledRef.current) return;

    if (explainRiskId) {
      const explainResponse = getDoctorExplainResponse(explainRiskId);
      if (explainResponse) {
        handledRef.current = true;
        sendMessage(getDoctorExplainPrompt(explainRiskId), explainResponse);
        return;
      }
    }

    if (initialPrompt) {
      handledRef.current = true;
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, explainRiskId, sendMessage]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 ring-1 ring-indigo-500/25">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7v1a2 2 0 01-2 2h-1v1a2 2 0 01-2 2H9a2 2 0 01-2-2v-1H6a2 2 0 01-2-2v-1a7 7 0 017-7h1V5.73A2 2 0 0112 2z" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[85%] ${message.role === "user" ? "order-first" : ""}`}>
                {message.role === "user" ? (
                  <div className="rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3 text-[13px] text-white">
                    {message.content}
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                    {message.response && <DoctorResponseCard response={message.response} />}
                  </div>
                )}
                <p className="mt-1 px-1 text-[10px] text-zinc-600">{message.timestamp}</p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7v1a2 2 0 01-2 2h-1v1a2 2 0 01-2 2H9a2 2 0 01-2-2v-1H6a2 2 0 01-2-2v-1a7 7 0 017-7h1V5.73A2 2 0 0112 2z" />
                </svg>
              </div>
              <div className="flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {messages.length <= 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {doctorSuggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={isTyping}
                  className="rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-white/15 hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isTyping) sendMessage(input);
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] focus-within:border-indigo-500/40">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isTyping) sendMessage(input);
                  }
                }}
                placeholder="Ask Company Doctor anything about your company's health..."
                rows={2}
                className="w-full resize-none bg-transparent px-4 py-3 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="shrink-0 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-zinc-600">
            Answers include evidence citations from {doctorDocumentCount.toLocaleString()} analyzed
            documents
          </p>
        </div>
      </div>
    </div>
  );
}
