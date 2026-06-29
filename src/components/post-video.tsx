import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

export function PostVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  // Pause when scrolled out of view to save data on mobile.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !el.paused) {
          el.pause();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  async function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
        setStarted(true);
      } catch {
        // Autoplay blocked; user gesture will retry on next tap.
      }
    } else {
      el.pause();
    }
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }

  return (
    <div
      className="relative mt-3 overflow-hidden rounded-2xl border border-border/60 bg-black"
      onClick={togglePlay}
    >
      <video
        ref={ref}
        src={src}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        controls={started}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="max-h-[520px] w-full object-contain"
      />
      {!playing && (
        <button
          type="button"
          aria-label="Play video"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
