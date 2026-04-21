import { Shield } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export const ChatMessage = ({ role, content, streaming }: Props) => {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-neon text-primary-foreground px-4 py-2.5 text-sm font-medium shadow-glow-cyan">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 animate-slide-up">
      <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-card border border-primary/40 flex items-center justify-center shadow-glow-cyan">
        <Shield className="h-4 w-4 text-primary" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card/80 backdrop-blur border border-border px-4 py-2.5 text-sm leading-relaxed">
        <div className="text-[10px] font-mono tracking-widest text-primary/70 mb-1">NEON</div>
        <span className={streaming ? "cursor-blink" : ""}>{content}</span>
      </div>
    </div>
  );
};
