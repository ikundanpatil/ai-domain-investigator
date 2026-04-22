import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { ChatMessage } from "@/components/investigator/ChatMessage";
import { InvestigationSteps } from "@/components/investigator/InvestigationSteps";
import { MusicToggle } from "@/components/investigator/MusicToggle";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; streaming?: boolean };

const STARTERS = [
  "Is google.com safe?",
  "Can I trust amazon.com?",
  "Investigate giithub.com",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const Index = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Msg[] | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, investigating]);

  useEffect(() => {
    document.title = "Detective · Domain Forensics";
  }, []);

  const runInvestigation = async (history: Msg[]) => {
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "", streaming: true }]);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/investigate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${resp.status})`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: acc, streaming: true };
          return next;
        });
      }
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: acc, streaming: false };
        return next;
      });
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      toast.error(e instanceof Error ? e.message : "Investigation failed");
    } finally {
      setStreaming(false);
    }
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming || investigating) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setInvestigating(true);
    pendingRef.current = history;
  };

  const onStepsDone = () => {
    setInvestigating(false);
    if (pendingRef.current) {
      runInvestigation(pendingRef.current);
      pendingRef.current = null;
    }
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-1.5 rounded-full bg-foreground" />
            <h1 className="text-sm font-medium tracking-tight">
              Detective
              <span className="text-muted-foreground font-normal"> — domain forensics</span>
            </h1>
          </div>
          <MusicToggle />
        </div>
      </header>

      {/* Chat scroll area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-12 space-y-8">
          {messages.length === 0 && (
            <div className="py-16 space-y-10">
              <div className="space-y-4">
                <h2 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight">
                  Drop a domain.<br />
                  <span className="italic text-muted-foreground">I'll investigate.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                  Real DNS records, WHOIS patterns, and threat signals — examined live and explained plainly.
                </p>
              </div>
              <div className="space-y-1 pt-2">
                <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase mb-3">
                  Suggestions
                </p>
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left py-2.5 text-sm text-foreground/80 hover:text-foreground border-b border-border/60 transition-colors"
                  >
                    {s}
                    <span className="float-right text-muted-foreground">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} streaming={m.streaming} />
          ))}

          {investigating && <InvestigationSteps onComplete={onStepsDone} />}
        </div>
      </main>

      {/* Input */}
      <footer className="sticky bottom-0 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 rounded-full border border-border bg-card focus-within:border-foreground/40 transition-colors pl-5 pr-1.5 py-1.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any domain…"
              disabled={streaming || investigating}
              className="flex-1 bg-transparent py-2 outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming || investigating}
              className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-20 transition-opacity"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
          <p className="text-[10px] font-mono text-muted-foreground/70 text-center mt-3 tracking-[0.15em] uppercase">
            Enter to investigate
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
