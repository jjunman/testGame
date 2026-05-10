import type { RefObject } from "react";
import type { Choice } from "../types";

const liveChoiceLabelMap: Record<Choice, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};

interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement>;
  cameraState: "idle" | "loading" | "ready" | "error";
  cameraMessage: string;
  liveChoice: Choice | null;
  isCountingDown: boolean;
}

export function CameraPanel({
  videoRef,
  cameraState,
  cameraMessage,
  liveChoice,
  isCountingDown,
}: CameraPanelProps) {
  return (
    <section className="camera-panel card">
      <div className="camera-frame">
        <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
        <div className="camera-overlay">
          <span className={`camera-badge ${cameraState}`}>{cameraMessage}</span>
          <span className="gesture-badge">
            실시간 손모양:
            <strong>{liveChoice ? ` ${liveChoiceLabelMap[liveChoice]}` : " 감지 중..."}</strong>
          </span>
          {isCountingDown && <span className="countdown-badge">보까지 손모양 유지!</span>}
        </div>
      </div>
    </section>
  );
}
