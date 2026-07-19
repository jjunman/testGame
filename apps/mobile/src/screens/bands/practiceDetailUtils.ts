export type PracticeDetailDto = {
  id: string;
  bandId: string;
  title: string;
  description: string | null;
  dueAt: string;
  status: string;
  startSec: number | null;
  endSec: number | null;
  song: {
    title: string;
    artist: string;
    youtubeUrl: string | null;
  } | null;
  mySubmission: {
    id: string;
    audioUrl: string;
    positionLabel: string;
    submittedAt: string;
  } | null;
  isClosed: boolean;
  memberStatuses: Array<{
    userId: string;
    name: string;
    role: string;
    positionLabel: string;
    submitted: boolean;
    submittedAt: string | null;
  }>;
  mixAudioUrl: string | null;
  mixGeneratedAt: string | null;
};

export type PracticeSubmissionDto = {
  id: string;
  userId: string;
  userName: string;
  positionLabel: string;
  audioUrl: string;
  submittedAt: string;
  durationSec: number | null;
};

export type DraftRecording = {
  id: string;
  uri: string;
  createdAt: string;
  source: 'recorded' | 'picked';
  takeNumber?: number;
  durationSec?: number | null;
  syncOffsetMs?: number | null;
  waveform?: number[];
};

export type PracticeMode = 'main' | 'practice' | 'submit';

export function getSourcePlaybackPlan(segmentStartSec: number, countdownSec: number) {
  const safeSegmentStartSec = Math.max(0, segmentStartSec);
  const availablePreRollSec = Math.min(countdownSec, safeSegmentStartSec);

  return {
    sourceStartSec: safeSegmentStartSec - availablePreRollSec,
    sourceStartDelayMs: (countdownSec - availablePreRollSec) * 1000,
  };
}

export function getRequiredRecordingSec(detail: PracticeDetailDto | null) {
  if (!detail || detail.startSec === null || detail.endSec === null || detail.endSec <= detail.startSec) {
    return null;
  }
  return detail.endSec - detail.startSec;
}

export function isLongEnoughForAssignment(durationSec: number | null, detail: PracticeDetailDto | null) {
  const requiredSec = getRequiredRecordingSec(detail);
  if (requiredSec === null) {
    return true;
  }
  return durationSec !== null && durationSec + 0.75 >= requiredSec;
}

export function buildDurationMessage(detail: PracticeDetailDto | null, durationSec: number | null) {
  const requiredSec = getRequiredRecordingSec(detail);
  if (requiredSec === null) {
    return '녹음 길이를 확인할 수 없습니다. 다시 녹음해 주세요.';
  }
  const actual = durationSec === null ? '확인 불가' : formatSeconds(Math.max(0, Math.floor(durationSec)));
  return `이 과제는 최소 ${formatSeconds(requiredSec)} 녹음해야 저장할 수 있어요. 현재 녹음 길이: ${actual}`;
}

export function getNextTakeNumber(drafts: DraftRecording[]) {
  return drafts.reduce((max, draft, index) => Math.max(max, draft.takeNumber ?? getLegacyTakeNumber(drafts, index)), 0) + 1;
}

export function getLegacyTakeNumber(drafts: DraftRecording[], index: number) {
  const ordered = [...drafts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const draft = drafts[index];
  const legacyIndex = ordered.findIndex((item) => item.id === draft.id);
  return legacyIndex >= 0 ? legacyIndex + 1 : index + 1;
}

export function getYoutubeVideoId(url: string | null) {
  if (!url) {
    return null;
  }
  const match = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
  return match?.[1] ?? null;
}

export function getFallbackYoutubeVideoId(title?: string | null, artist?: string | null) {
  const key = `${title ?? ''} ${artist ?? ''}`.replace(/\s+/g, '').toLowerCase();
  if (key.includes('그대에게') || key.includes('신해철')) {
    return 'gJqCO8E63-s';
  }
  return null;
}

export function formatRange(startSec: number | null, endSec: number | null) {
  if (startSec === null && endSec === null) {
    return '구간 미정';
  }
  return `${formatSeconds(startSec ?? 0)} - ${endSec === null ? '?' : formatSeconds(endSec)}`;
}

export function formatDateOnly(value: string) {
  return new Date(value).toLocaleDateString('ko-KR');
}

export function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function getPracticeProgress(startSec: number | null, endSec: number | null) {
  if (startSec === null || endSec === null || endSec <= startSec) {
    return 20;
  }
  return Math.max(10, Math.min(100, Math.round(((endSec - startSec) / 180) * 100)));
}

export function meteringToWaveHeight(metering: number) {
  const clamped = Math.max(-60, Math.min(0, metering));
  return Math.max(0.08, Math.min(1, (clamped + 60) / 60));
}

export function normalizeWaveform(samples?: number[]) {
  const fallback = Array.from({ length: 32 }, (_, index) => 0.2 + (((index * 7) % 18) / 24));
  const source = samples && samples.length > 0 ? samples : fallback;

  return Array.from({ length: 32 }, (_, index) => {
    const start = Math.floor((index / 32) * source.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / 32) * source.length));
    const chunk = source.slice(start, end);
    const average = chunk.reduce((sum, value) => sum + value, 0) / chunk.length;
    return Math.max(0.08, Math.min(1, average));
  });
}
