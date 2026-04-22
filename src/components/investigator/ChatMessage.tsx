interface Props {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export const ChatMessage = ({ role, content, streaming }: Props) => {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[85%] rounded-2xl bg-foreground text-background px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="animate-slide-up max-w-[92%]">
      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground mb-2 uppercase">
        Detective
      </div>
      <div className="text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
        <span className={streaming ? "cursor-blink" : ""}>{content}</span>
      </div>
    </div>
  );
};
