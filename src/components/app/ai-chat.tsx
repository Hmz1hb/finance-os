"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type Message = { role: "user" | "assistant"; content: string };

const MAX_MESSAGE_LENGTH = 4000;

export function AIChatButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ask about allocation, taxes, subscriptions, debt payoff, hiring, or a big purchase.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Message is too long. Please keep prompts under ${MAX_MESSAGE_LENGTH} characters.` },
      ]);
      return;
    }
    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.filter((message) => message.role !== "assistant" || message.content.length > 0),
        }),
      });

      if (response.status === 503) {
        const body = await response.json().catch(() => ({}));
        if (body.code === "AI_UNAVAILABLE") {
          setUnavailable(true);
          setMessages([
            ...nextMessages,
            {
              role: "assistant",
              content:
                "The AI advisor is temporarily unavailable. Anthropic Bedrock access for this account is pending — try again later.",
            },
          ]);
          return;
        }
      }
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        setMessages([...nextMessages, { role: "assistant", content: body.error ?? "Request failed. Try again." }]);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      setMessages([...nextMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value);
        setMessages([...nextMessages, { role: "assistant", content: assistant }]);
      }
    } catch (error) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: error instanceof Error ? error.message : "Network error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        aria-label="Open AI advisor"
        size="icon"
        variant="outline"
        className="fixed bottom-24 right-4 z-40 hidden rounded-full lg:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-5 w-5" aria-hidden="true" />
      </Button>
      <Button
        aria-label="Open AI advisor"
        size="icon"
        variant="outline"
        className="fixed bottom-[10.5rem] right-4 z-40 rounded-full lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-5 w-5" aria-hidden="true" />
      </Button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-advisor-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-ledger-border bg-background shadow-2xl"
          >
            <header className="safe-top flex items-center justify-between border-b border-ledger-border p-4">
              <div>
                <p id="ai-advisor-title" className="text-sm font-semibold">AI Financial Advisor</p>
                <p className="text-xs text-muted-ledger">Bedrock Claude with live finance context</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close advisor">
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-lg bg-blue-ledger p-3 text-sm text-white"
                      : "max-w-[90%] rounded-lg bg-surface p-3 text-sm leading-6"
                  }
                >
                  {message.content || "Thinking..."}
                </div>
              ))}
              {unavailable ? (
                <div className="rounded-lg border border-orange-deadline/40 bg-orange-deadline/10 p-3 text-xs text-muted-ledger">
                  AI advisor unavailable — Bedrock model access for this AWS account is pending Anthropic approval.
                </div>
              ) : null}
            </div>
            <form onSubmit={submit} className="safe-bottom border-t border-ledger-border p-4">
              <label htmlFor="ai-advisor-input" className="sr-only">
                Message the AI advisor
              </label>
              <div className="flex gap-2">
                <Textarea
                  id="ai-advisor-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  placeholder="I just got paid £3,200. What should I do?"
                  className="min-h-12"
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={unavailable}
                />
                <Button type="submit" size="icon" disabled={loading || unavailable || !input.trim()} aria-label="Send message">
                  <Send className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-ledger">
                {input.length}/{MAX_MESSAGE_LENGTH}
              </p>
            </form>
          </div>
        </>
      ) : null}
    </>
  );
}
