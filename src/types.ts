export type Choice = "rock" | "paper" | "scissors";

export type RoundResult = "win" | "draw" | "lose";

export interface RecordScore {
  win: number;
  draw: number;
  lose: number;
}

export interface MatchScore {
  player: number;
  computer: number;
}
