import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Royalty-free ambient cyberpunk loop (Pixabay CDN).
const TRACK_URL =
  "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e0d3a8.mp3?filename=cyberpunk-future-bass-22678.mp3";

export const MusicToggle = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const a = new Audio(TRACK_URL);
    a.loop = true;
    a.volume = 0.18;
    a.preload = "auto";
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (on) {
      a.pause();
      setOn(false);
    } else {
      a.play().then(() => setOn(true)).catch(() => setOn(false));
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={on ? "Mute ambient music" : "Play ambient music"}
      className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all ${
        on
          ? "border-primary/60 text-primary shadow-glow-cyan"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
};
