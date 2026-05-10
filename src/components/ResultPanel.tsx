import type { Choice, RoundResult } from "../types";

const choiceLabelMap: Record<Choice, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};

const resultTextMap: Record<RoundResult, string> = {
  win: "이겼어요! 벚꽃 축제를 열어볼까요?",
  draw: "비겼어요. 한 번 더 승부해요!",
  lose: "졌어요. 다음 판에서 뒤집어봐요!",
};

interface ResultPanelProps {
  playerChoice: Choice | null;
  computerChoice: Choice | null;
  roundResult: RoundResult | null;
  statusMessage: string;
  countdownText: string;
  matchWinner: "player" | "computer" | null;
}

export function ResultPanel({
  playerChoice,
  computerChoice,
  roundResult,
  statusMessage,
  countdownText,
  matchWinner,
}: ResultPanelProps) {
  return (
    <section className="result-panel card">
      <p className="section-label">현재 상태</p>
      <h2>{countdownText || statusMessage}</h2>
      {roundResult && <p className={`round-result ${roundResult}`}>{resultTextMap[roundResult]}</p>}

      <div className="result-grid">
        <div className="result-card">
          <span className="result-title">나의 선택</span>
          <strong>{playerChoice ? choiceLabelMap[playerChoice] : "아직 선택 전"}</strong>
        </div>
        <div className="result-card">
          <span className="result-title">컴퓨터 선택</span>
          <strong>{computerChoice ? choiceLabelMap[computerChoice] : "카운트다운 후 공개"}</strong>
        </div>
      </div>

      {matchWinner && (
        <p className="match-winner">
          {matchWinner === "player"
            ? "축하해요! 먼저 3점을 따서 최종 승리했어요."
            : "컴퓨터가 먼저 3점을 땄어요. 다시 도전해봐요."}
        </p>
      )}
    </section>
  );
}
