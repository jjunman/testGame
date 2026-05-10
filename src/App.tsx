import { useEffect, useMemo, useRef, useState } from "react";
import { ChoiceButtons } from "./components/ChoiceButtons";
import { ResultPanel } from "./components/ResultPanel";
import { ScoreBoard } from "./components/ScoreBoard";
import type { Choice, MatchScore, RecordScore, RoundResult } from "./types";

const countdownWords = ["가위", "바위", "보"] as const;
const choiceOrder: Choice[] = ["rock", "paper", "scissors"];
const matchPoint = 3;

function getComputerChoice() {
  const randomIndex = Math.floor(Math.random() * choiceOrder.length);
  return choiceOrder[randomIndex];
}

function getRoundResult(playerChoice: Choice, computerChoice: Choice): RoundResult {
  if (playerChoice === computerChoice) {
    return "draw";
  }

  const playerWins =
    (playerChoice === "rock" && computerChoice === "scissors") ||
    (playerChoice === "paper" && computerChoice === "rock") ||
    (playerChoice === "scissors" && computerChoice === "paper");

  return playerWins ? "win" : "lose";
}

function playWinSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(523.25, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(783.99, context.currentTime + 0.18);
  oscillator.frequency.linearRampToValueAtTime(1046.5, context.currentTime + 0.38);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.52);

  oscillator.onended = () => {
    void context.close();
  };
}

function speakWord(word: string) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "ko-KR";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function createInitialRecord(): RecordScore {
  return { win: 0, draw: 0, lose: 0 };
}

function createInitialMatchScore(): MatchScore {
  return { player: 0, computer: 0 };
}

function App() {
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [record, setRecord] = useState<RecordScore>(createInitialRecord);
  const [matchScore, setMatchScore] = useState<MatchScore>(createInitialMatchScore);
  const [countdownText, setCountdownText] = useState("");
  const [statusMessage, setStatusMessage] = useState("손모양을 고른 뒤 시작 버튼을 눌러보세요.");
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [matchWinner, setMatchWinner] = useState<"player" | "computer" | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(0);

  const timeoutRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: `${confettiBurst}-${index}`,
        left: `${(index * 13) % 100}%`,
        delay: `${(index % 6) * 0.08}s`,
        duration: `${2.4 + (index % 5) * 0.15}s`,
        rotation: `${index * 19}deg`,
      })),
    [confettiBurst],
  );

  const resetMatch = () => {
    timeoutRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRef.current = [];
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSelectedChoice(null);
    setPlayerChoice(null);
    setComputerChoice(null);
    setRoundResult(null);
    setRecord(createInitialRecord());
    setMatchScore(createInitialMatchScore());
    setCountdownText("");
    setStatusMessage("새로운 대결을 시작해요. 손모양을 먼저 골라보세요.");
    setIsCountingDown(false);
    setMatchWinner(null);
  };

  const finishRound = (lockedChoice: Choice) => {
    const nextComputerChoice = getComputerChoice();
    const nextResult = getRoundResult(lockedChoice, nextComputerChoice);

    setCountdownText("");
    setPlayerChoice(lockedChoice);
    setComputerChoice(nextComputerChoice);
    setRoundResult(nextResult);
    setIsCountingDown(false);

    setRecord((prev) => ({
      win: prev.win + (nextResult === "win" ? 1 : 0),
      draw: prev.draw + (nextResult === "draw" ? 1 : 0),
      lose: prev.lose + (nextResult === "lose" ? 1 : 0),
    }));

    setMatchScore((prev) => {
      const updated = {
        player: prev.player + (nextResult === "win" ? 1 : 0),
        computer: prev.computer + (nextResult === "lose" ? 1 : 0),
      };

      if (updated.player >= matchPoint) {
        setMatchWinner("player");
        setStatusMessage("당신이 먼저 3점을 달성했어요!");
      } else if (updated.computer >= matchPoint) {
        setMatchWinner("computer");
        setStatusMessage("컴퓨터가 먼저 3점을 달성했어요.");
      } else {
        const roundText =
          nextResult === "win"
            ? "이번 판은 승리! 다음 판도 이어가볼까요?"
            : nextResult === "draw"
              ? "이번 판은 무승부예요."
              : "이번 판은 패배예요. 다음 판에서 만회해봐요!";
        setStatusMessage(roundText);
      }

      return updated;
    });

    if (nextResult === "win") {
      setConfettiBurst((prev) => prev + 1);
      playWinSound();
    }
  };

  const startCountdown = () => {
    if (!selectedChoice || isCountingDown || matchWinner) {
      if (!selectedChoice) {
        setStatusMessage("먼저 가위, 바위, 보 중 하나를 선택해주세요.");
      }
      return;
    }

    setPlayerChoice(null);
    setComputerChoice(null);
    setRoundResult(null);
    setStatusMessage("카운트다운이 진행 중이에요. 잠시만 기다려주세요!");
    setIsCountingDown(true);
    setCountdownText(countdownWords[0]);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    countdownWords.forEach((word, index) => {
      const timeoutId = window.setTimeout(() => {
        setCountdownText(word);
        speakWord(word);
      }, index * 800);
      timeoutRef.current.push(timeoutId);
    });

    const finalTimeout = window.setTimeout(() => {
      finishRound(selectedChoice);
      timeoutRef.current = [];
    }, countdownWords.length * 800 + 120);
    timeoutRef.current.push(finalTimeout);
  };

  return (
    <main className="app-shell">
      <div className="petal petal-a" />
      <div className="petal petal-b" />
      <div className="petal petal-c" />

      <section className="hero card">
        <p className="eyebrow">Spring Match</p>
        <h1>벚꽃 가위바위보</h1>
        <p className="hero-text">
          손모양을 먼저 고르고 시작 버튼을 누르면, 음성으로
          <strong> 가위 - 바위 - 보 </strong>
          카운트다운이 흘러나와요.
        </p>

        <div className="hero-actions">
          <button
            type="button"
            className="start-button"
            disabled={isCountingDown || matchWinner !== null}
            onClick={startCountdown}
          >
            {isCountingDown ? "카운트다운 중..." : "시작!"}
          </button>
          <button type="button" className="reset-button" onClick={resetMatch}>
            다시 시작
          </button>
        </div>

        <p className="helper-text">
          규칙: 이기면 1점, 지면 컴퓨터가 1점, 먼저 3점을 얻는 쪽이 최종 승리예요.
        </p>
      </section>

      <ChoiceButtons
        selectedChoice={selectedChoice}
        disabled={isCountingDown || matchWinner !== null}
        onSelect={setSelectedChoice}
      />

      <ResultPanel
        playerChoice={playerChoice}
        computerChoice={computerChoice}
        roundResult={roundResult}
        statusMessage={statusMessage}
        countdownText={countdownText}
        matchWinner={matchWinner}
      />

      <ScoreBoard record={record} matchScore={matchScore} />

      <div className="confetti-layer" aria-hidden="true">
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className={`confetti-piece ${roundResult === "win" ? "show" : ""}`}
            style={{
              left: piece.left,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              rotate: piece.rotation,
            }}
          />
        ))}
      </div>
    </main>
  );
}

export default App;
