import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

const STEPS = [
  "Resolving DNS records",
  "Fetching WHOIS history",
  "Analyzing SSL certificate",
  "Cross-referencing threat intel",
  "Compiling forensic report",
];

interface Props {
  onComplete: () => void;
}

export const InvestigationSteps = ({ onComplete }: Props) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= STEPS.length) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setActive((a) => a + 1), 700 + Math.random() * 500);
    return () => clearTimeout(t);
  }, [active, onComplete]);

  return (
    <div className="bg-gradient-card border border-primary/30 rounded-2xl p-4 space-y-2 scanline animate-slide-up">
      <div className="text-xs font-mono text-primary/80 mb-2 tracking-widest">
        ▸ INVESTIGATION IN PROGRESS
      </div>
      {STEPS.map((s, i) => {
        const done = i < active;
        const running = i === active;
        return (
          <div
            key={s}
            className={`flex items-center gap-2 font-mono text-sm transition-opacity ${
              i > active ? "opacity-30" : "opacity-100"
            }`}
          >
            {done ? (
              <Check className="h-4 w-4 text-success" />
            ) : running ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
            )}
            <span className={done ? "text-success" : running ? "text-primary text-glow-cyan" : "text-muted-foreground"}>
              {s}
              {running && "..."}
            </span>
          </div>
        );
      })}
    </div>
  );
};
