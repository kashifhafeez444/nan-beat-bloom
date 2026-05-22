import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Intro } from "@/components/beat-wall/Intro";
import { Gameplay, type GameResult } from "@/components/beat-wall/Gameplay";
import { Results } from "@/components/beat-wall/Results";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [phase, setPhase] = useState<"intro" | "play" | "results">("intro");
  const [player, setPlayer] = useState({ name: "", email: "" });
  const [result, setResult] = useState<GameResult | null>(null);

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
          setPhase("results");
        }}
      />
    );
  }
  return (
    <Results
      result={result!}
      playerName={player.name}
      onReplay={() => {
        setResult(null);
        setPhase("intro");
      }}
    />
  );
}
