import { useEffect, useState } from "react";

const STEPS = [
  "Resolving DNS records",
  "Fetching WHOIS history",
  "Analyzing SSL certificate",
  "Cross-referencing threat intel",
  "Compiling report",
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
    const t = setTimeout(() => setActive((a) => a + 1), 650 + Math.random() * 400);
    return () => clearTimeout(t);
  }, [active, onComplete]);

  return (
    <div className="animate-slide-up py-2">
      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground mb-3 uppercase">
        Investigating
      </div>
      <div className="space-y-1.5">
        {STEPS.map((s, i) => {
          const done = i < active;
          const running = i === active;
          return (
            <div
              key={s}
              className={`flex items-center gap-3 font-mono text-xs transition-opacity duration-300 ${
                i > active ? "opacity-25" : "opacity-100"
              }`}
            >
              <span className={`inline-block h-1 w-1 rounded-full ${
                done ? "bg-foreground" : running ? "bg-foreground animate-pulse" : "bg-muted-foreground/30"
              }`} />
              <span className={done ? "text-muted-foreground line-through decoration-1" : running ? "text-foreground" : "text-muted-foreground"}>
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
