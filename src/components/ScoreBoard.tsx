import type { MatchScore, RecordScore } from "../types";

interface ScoreBoardProps {
  record: RecordScore;
  matchScore: MatchScore;
}

export function ScoreBoard({ record, matchScore }: ScoreBoardProps) {
  return (
    <section className="scoreboard card">
      <div>
        <p className="section-label">누적 전적</p>
        <div className="record-grid">
          <div>
            <span className="record-label">승</span>
            <strong>{record.win}</strong>
          </div>
          <div>
            <span className="record-label">무</span>
            <strong>{record.draw}</strong>
          </div>
          <div>
            <span className="record-label">패</span>
            <strong>{record.lose}</strong>
          </div>
        </div>
      </div>

      <div>
        <p className="section-label">먼저 3점</p>
        <div className="match-score">
          <div>
            <span>나</span>
            <strong>{matchScore.player}</strong>
          </div>
          <span className="vs-text">VS</span>
          <div>
            <span>컴퓨터</span>
            <strong>{matchScore.computer}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
