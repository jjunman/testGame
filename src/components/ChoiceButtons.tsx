import type { Choice } from "../types";

const choiceMeta: Array<{ value: Choice; label: string; emoji: string }> = [
  { value: "scissors", label: "가위", emoji: "✌️" },
  { value: "rock", label: "바위", emoji: "✊" },
  { value: "paper", label: "보", emoji: "🖐️" },
];

interface ChoiceButtonsProps {
  selectedChoice: Choice | null;
  disabled: boolean;
  onSelect: (choice: Choice) => void;
}

export function ChoiceButtons({
  selectedChoice,
  disabled,
  onSelect,
}: ChoiceButtonsProps) {
  return (
    <div className="choice-grid">
      {choiceMeta.map((choice) => {
        const isActive = choice.value === selectedChoice;

        return (
          <button
            key={choice.value}
            type="button"
            className={`choice-button ${isActive ? "active" : ""}`}
            disabled={disabled}
            onClick={() => onSelect(choice.value)}
          >
            <span className="choice-emoji" aria-hidden="true">
              {choice.emoji}
            </span>
            <span>{choice.label}</span>
          </button>
        );
      })}
    </div>
  );
}
