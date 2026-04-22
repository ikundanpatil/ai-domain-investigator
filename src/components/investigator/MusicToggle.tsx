import { forwardRef, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

type WebkitWindow = Window & typeof globalThis & {
  webkitAudioContext?: new () => AudioContext;
};

export const MusicToggle = forwardRef<HTMLButtonElement>((_props, ref) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [on, setOn] = useState(false);

  const stopAmbient = () => {
    stopRef.current?.();
    stopRef.current = null;
  };

  const startAmbient = async () => {
    const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio is not supported in this browser.");
    }

    stopAmbient();

    let context = audioContextRef.current;
    if (!context || context.state === "closed") {
      context = new AudioContextClass();
      audioContextRef.current = context;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    const master = context.createGain();
    master.gain.value = 0.08;
    master.connect(context.destination);

    const pulse = context.createOscillator();
    pulse.type = "sine";
    pulse.frequency.value = 0.12;

    const pulseDepth = context.createGain();
    pulseDepth.gain.value = 0.02;
    pulse.connect(pulseDepth);
    pulseDepth.connect(master.gain);

    const createVoice = (frequency: number, gainValue: number, detune = 0) => {
      const oscillator = context.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;

      const gain = context.createGain();
      gain.gain.value = gainValue;

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();

      return { oscillator, gain };
    };

    const voices = [
      createVoice(196, 0.22),
      createVoice(246.94, 0.12, -4),
      createVoice(293.66, 0.08, 3),
    ];

    pulse.start();

    stopRef.current = () => {
      pulse.stop();
      pulse.disconnect();
      pulseDepth.disconnect();
      voices.forEach(({ oscillator, gain }) => {
        oscillator.stop();
        oscillator.disconnect();
        gain.disconnect();
      });
      master.disconnect();
    };
  };

  useEffect(() => {
    return () => {
      stopAmbient();
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  const toggle = async () => {
    if (on) {
      stopAmbient();
      setOn(false);
      return;
    }

    try {
      await startAmbient();
      setOn(true);
    } catch (err) {
      console.error("Ambient music failed", err);
      toast.error("Couldn't start music on this browser.");
      setOn(false);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-label={on ? "Mute ambient music" : "Play ambient music"}
      className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
    </button>
  );
});
MusicToggle.displayName = "MusicToggle";
