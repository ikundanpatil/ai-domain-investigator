import { useEffect, useRef, useState } from "react";
import { Send, Shield, Sparkles } from "lucide-react";
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
    document.title = "NEON · AI Domain Detective";
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
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-xl bg-gradient-neon flex items-center justify-center shadow-glow-cyan">
              <Shield className="h-5 w-5 text-background" />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-success border-2 border-background animate-pulse-glow" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">
                NEON <span className="text-primary text-glow-cyan">DETECTIVE</span>
              </h1>
              <p className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                · live domain forensics
              </p>
            </div>
          </div>
          <MusicToggle />
        </div>
      </header>

      {/* Chat scroll area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10 space-y-6 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/40 bg-secondary/5 text-xs font-mono text-secondary tracking-widest">
                <Sparkles className="h-3 w-3" /> ONLINE · READY TO INVESTIGATE
              </div>
              <div>
                <h2 className="text-3xl font-bold leading-tight">
                  Drop a domain.<br />
                  I'll <span className="bg-gradient-neon bg-clip-text text-transparent">dig up everything</span>.
                </h2>
                <p className="text-sm text-muted-foreground mt-3 max-w-sm mx-auto">
                  Real DNS, WHOIS patterns, threat intel — investigated live, explained like a friend.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-mono tracking-widest text-muted-foreground">TRY ONE:</p>
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left px-4 py-3 rounded-xl border border-border bg-card/50 hover:border-primary/50 hover:bg-card hover:shadow-glow-cyan transition-all font-mono text-sm"
                  >
                    <span className="text-primary mr-2">▸</span>
                    {s}
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
      <footer className="sticky bottom-0 backdrop-blur-xl bg-background/80 border-t border-border">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card focus-within:border-primary/60 focus-within:shadow-glow-cyan transition-all px-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any domain..."
              disabled={streaming || investigating}
              className="flex-1 bg-transparent px-3 py-3 outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming || investigating}
              className="h-10 w-10 rounded-xl bg-gradient-neon text-primary-foreground flex items-center justify-center disabled:opacity-30 disabled:bg-none disabled:bg-muted shadow-glow-cyan transition-all hover:scale-105 active:scale-95"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="text-[10px] font-mono text-muted-foreground/60 text-center mt-2 tracking-widest">
            ENTER TO INVESTIGATE · POWERED BY CLAUDE + LIVE DNS
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
