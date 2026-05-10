import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import { CameraPanel } from "./components/CameraPanel";
import { ResultPanel } from "./components/ResultPanel";
import { ScoreBoard } from "./components/ScoreBoard";
import type { Choice, MatchScore, RecordScore, RoundResult } from "./types";

const countdownWords = ["가위", "바위", "보"] as const;
const choiceOrder: Choice[] = ["rock", "paper", "scissors"];
const matchPoint = 3;

const gestureToChoiceMap: Record<string, Choice> = {
  Closed_Fist: "rock",
  Open_Palm: "paper",
  Victory: "scissors",
};

const choiceLabelMap: Record<Choice, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};

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
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

function createConfettiPieces() {
  return Array.from({ length: 18 }, (_, index) => ({
    id: index,
    left: `${(index * 13) % 100}%`,
    delay: `${(index % 6) * 0.08}s`,
    duration: `${2.4 + (index % 5) * 0.15}s`,
    rotation: `${index * 19}deg`,
  }));
}

export default function GameApp() {
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
  const [liveChoice, setLiveChoice] = useState<Choice | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [record, setRecord] = useState<RecordScore>(createInitialRecord);
  const [matchScore, setMatchScore] = useState<MatchScore>(createInitialMatchScore);
  const [countdownText, setCountdownText] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "카메라를 켜고 손을 화면에 비춘 뒤 시작 버튼을 눌러보세요.",
  );
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [matchWinner, setMatchWinner] = useState<"player" | "computer" | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [cameraState, setCameraState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [cameraMessage, setCameraMessage] = useState(
    "카메라를 켜면 손모양을 실시간으로 읽기 시작해요.",
  );

  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const liveChoiceRef = useRef<Choice | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<number[]>([]);
  const confettiPiecesRef = useRef(createConfettiPieces());

  useEffect(() => {
    liveChoiceRef.current = liveChoice;
  }, [liveChoice]);

  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopDetectionLoop = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const runDetectionLoop = () => {
    const recognizer = gestureRecognizerRef.current;
    const video = videoRef.current;

    if (!recognizer || !video || video.readyState < 2) {
      animationFrameRef.current = window.requestAnimationFrame(runDetectionLoop);
      return;
    }

    const result = recognizer.recognizeForVideo(video, performance.now());
    const topGesture = result.gestures[0]?.[0];
    const nextChoice = topGesture ? gestureToChoiceMap[topGesture.categoryName] ?? null : null;

    setLiveChoice((prev) => (prev === nextChoice ? prev : nextChoice));
    animationFrameRef.current = window.requestAnimationFrame(runDetectionLoop);
  };

  const startCamera = async () => {
    if (cameraState === "loading") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
      setCameraMessage("이 브라우저에서는 카메라 기능을 사용할 수 없어요.");
      return;
    }

    setCameraState("loading");
    setCameraMessage("카메라와 손 인식 모델을 준비하는 중이에요...");

    try {
      if (!gestureRecognizerRef.current) {
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/gesture_recognizer.task",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
          cannedGesturesClassifierOptions: {
            categoryAllowlist: ["Closed_Fist", "Open_Palm", "Victory"],
            scoreThreshold: 0.65,
          },
        });
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState("ready");
      setCameraMessage("손을 화면 안에 보여주세요. 가위, 바위, 보를 실시간으로 읽고 있어요.");
      stopDetectionLoop();
      runDetectionLoop();
    } catch (error) {
      console.error(error);
      setCameraState("error");
      setCameraMessage("카메라를 시작하지 못했어요. 권한을 허용한 뒤 다시 시도해주세요.");
    }
  };

  const resetMatch = () => {
    timeoutRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRef.current = [];

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setPlayerChoice(null);
    setComputerChoice(null);
    setRoundResult(null);
    setRecord(createInitialRecord());
    setMatchScore(createInitialMatchScore());
    setCountdownText("");
    setStatusMessage("새로운 대결이에요. 카메라 앞에서 손모양을 준비해보세요.");
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
            ? "이번 판은 승리예요! 카메라 앞에서 다음 손모양도 준비해봐요."
            : nextResult === "draw"
              ? "이번 판은 무승부예요. 조금 더 또렷하게 보여줘도 좋아요."
              : "이번 판은 패배예요. 다음 판에서 다시 도전해봐요!";
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
    if (cameraState !== "ready" || isCountingDown || matchWinner) {
      if (cameraState !== "ready") {
        setStatusMessage("먼저 카메라를 켜고 손모양이 보이도록 맞춰주세요.");
      }
      return;
    }

    setPlayerChoice(null);
    setComputerChoice(null);
    setRoundResult(null);
    setStatusMessage("카메라에 손을 보여준 채로 보까지 유지해보세요!");
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
      const lockedChoice = liveChoiceRef.current;

      if (!lockedChoice) {
        setCountdownText("");
        setIsCountingDown(false);
        setStatusMessage("보 순간에 손모양을 읽지 못했어요. 화면 안에서 다시 시도해주세요.");
        timeoutRef.current = [];
        return;
      }

      finishRound(lockedChoice);
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
          이번 버전은 버튼 대신 카메라로 손모양을 읽어요. 시작 버튼을 누르면 음성으로
          <strong> 가위 - 바위 - 보 </strong>
          카운트다운이 나오고, 마지막 순간에 보인 손모양으로 승부를 정합니다.
        </p>

        <div className="hero-actions">
          <button
            type="button"
            className="start-button"
            disabled={cameraState !== "ready" || isCountingDown || matchWinner !== null}
            onClick={startCountdown}
          >
            {isCountingDown ? "카운트다운 중..." : "시작!"}
          </button>
          <button
            type="button"
            className="camera-button"
            onClick={startCamera}
            disabled={cameraState === "loading"}
          >
            {cameraState === "ready"
              ? "카메라 다시 연결"
              : cameraState === "loading"
                ? "카메라 준비 중..."
                : "카메라 켜기"}
          </button>
          <button type="button" className="reset-button" onClick={resetMatch}>
            다시 시작
          </button>
        </div>

        <p className="helper-text">
          규칙: 이기면 1점, 지면 컴퓨터가 1점, 먼저 3점을 얻는 쪽이 최종 승리예요.
        </p>
      </section>

      <CameraPanel
        videoRef={videoRef}
        cameraState={cameraState}
        cameraMessage={cameraMessage}
        liveChoice={liveChoice}
        isCountingDown={isCountingDown}
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

      <section className="card tip-card">
        <p className="section-label">실시간 인식 팁</p>
        <p className="tip-text">
          지금 읽히는 손모양:
          <strong>{liveChoice ? ` ${choiceLabelMap[liveChoice]}` : " 아직 감지 전"}</strong>
        </p>
        <p className="tip-text">
          가위는 브이, 바위는 주먹, 보는 손바닥을 카메라 쪽으로 또렷하게 보여주면 더 잘 인식돼요.
        </p>
      </section>

      <div className="confetti-layer" aria-hidden="true">
        {confettiPiecesRef.current.map((piece) => (
          <span
            key={`${confettiBurst}-${piece.id}`}
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
