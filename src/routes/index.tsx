import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Intro } from "@/components/beat-wall/Intro";
import { Gameplay, type GameResult } from "@/components/beat-wall/Gameplay";
import { Results } from "@/components/beat-wall/Results";
import { Loading } from "@/components/beat-wall/Loading";
import { renderResultTrack } from "@/lib/audio";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [phase, setPhase] = useState<"intro" | "play" | "loading" | "results">("intro");
  const [player, setPlayer] = useState({ name: "", email: "" });
  const [result, setResult] = useState<GameResult | null>(null);
  const [track, setTrack] = useState<{ url: string | null; duration: number; trackNumber: number }>({
    url: null, duration: 0, trackNumber: 1,
  });

  if (phase === "intro") {
    return (
      <Intro
        onStart={(name, email) => {
          setPlayer({ name, email });
          setPhase("play");
        }}
      />
    );
  }
  if (phase === "play") {
    return (
      <Gameplay
        playerName={player.name}
        onEnd={(r) => {
          setResult(r);
          setPhase("loading");
          // Kick off async track generation in parallel with the 5s loading UI
          renderResultTrack().then((t) => setTrack(t)).catch(() => {});
        }}
      />
    );
  }
  if (phase === "loading") {
    return <Loading onDone={() => setPhase("results")} />;
  }
  return (
    <Results
      result={result!}
      playerName={player.name}
      trackUrl={track.url}
      trackDuration={track.duration}
      trackNumber={track.trackNumber}
      onReplay={() => {
        setResult(null);
        if (track.url) URL.revokeObjectURL(track.url);
        setTrack({ url: null, duration: 0, trackNumber: 1 });
        setPhase("intro");
      }}
    />
  );
}
