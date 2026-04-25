"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

type Message = { role: "user" | "assistant"; content: string };

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

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || loading) return;
    const nextMessages: Message[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMessages.filter((message) => message.role !== "assistant" || message.content.length > 0) }),
    });

    if (!response.body) {
      setLoading(false);
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
    setLoading(false);
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
        <Bot className="h-5 w-5" />
      </Button>
      <Button
        aria-label="Open AI advisor"
        size="icon"
        variant="outline"
        className="fixed bottom-[10.5rem] right-4 z-40 rounded-full lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Bot className="h-5 w-5" />
      </Button>

      {open ? (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-ledger-border bg-background shadow-2xl">
          <header className="safe-top flex items-center justify-between border-b border-ledger-border p-4">
            <div>
              <p className="text-sm font-semibold">AI Financial Advisor</p>
              <p className="text-xs text-muted-ledger">Bedrock Claude with live finance context</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close advisor">
              <X className="h-5 w-5" />
            </Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={message.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-blue-ledger p-3 text-sm text-white" : "max-w-[90%] rounded-lg bg-surface p-3 text-sm leading-6"}
              >
                {message.content || "Thinking..."}
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="safe-bottom border-t border-ledger-border p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="I just got paid £3,200. What should I do?"
                className="min-h-12"
              />
              <Button type="submit" size="icon" disabled={loading} aria-label="Send message">
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
