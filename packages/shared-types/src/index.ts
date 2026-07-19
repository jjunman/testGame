export type UserSummary = {
  id: string;
  email: string;
  name: string;
};

export type PositionType =
  | 'lead_guitar'
  | 'sub_guitar'
  | 'bass'
  | 'drums'
  | 'piano'
  | 'vocal'
  | 'custom';

export type MemberRole = 'leader' | 'member';
export type SongRoundStatus = 'posted' | 'voting' | 'done';
export type SongDifficulty = 'easy' | 'medium' | 'hard';
export type PracticeAssignmentStatus = 'open' | 'closed';
export type PracticeSubmissionStatus = 'submitted';
export type ScheduleAvailabilityType = 'yes' | 'no';
export type StudioCandidateStatus = 'open' | 'confirmed';
export type TodoType =
  | 'start_song_round'
  | 'vote_song'
  | 'vote_schedule_proposal'
  | 'submit_practice'
  | 'submit_schedule';

export type BandSummary = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  inviteCode: string;
  myRole: MemberRole;
  myPosition: string;
  memberCount: number;
  todoCount: number;
};

export type BandMemberSummary = {
  userId: string;
  name: string;
  role: MemberRole;
  profileImageUrl: string | null;
  positionLabel: string;
  joinedAt: string;
};

export type SongCandidateDto = {
  id: string;
  songCatalogId: string;
  title: string;
  artist: string;
  youtubeVideoId: string | null;
  thumbnailUrl: string | null;
  difficulty: SongDifficulty | null;
  requiredInstruments: string[];
  voteCount: number;
  didVote: boolean;
  createdByUserId: string;
  createdByName: string;
  missingInstruments: string[];
  warningMessage?: string | null;
};

export type SongRoundDto = {
  id: string;
  status: SongRoundStatus;
  finalCandidateId: string | null;
  myRole: MemberRole;
  votingDeadlineAt?: string | null;
  candidates: SongCandidateDto[];
};

export type PracticeAssignmentDto = {
  id: string;
  bandId: string;
  songCandidateId: string | null;
  title: string;
  description: string | null;
  dueAt: string;
  status: PracticeAssignmentStatus;
  startSec: number | null;
  endSec: number | null;
  hasSubmitted: boolean;
  songTitle?: string | null;
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

export type PracticeFeedbackDto = {
  id: string;
  submissionId: string;
  authorId: string;
  authorName: string;
  content: string;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSlotDto = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  createdByUserId: string;
  createdByName: string;
  yesCount: number;
  noCount: number;
  myAvailability: ScheduleAvailabilityType | null;
  availableMembers: Array<{
    userId: string;
    name: string;
    profileImageUrl: string | null;
  }>;
};

export type ScheduleSummaryDto = {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  allAvailable: boolean;
  availableCount: number;
  unavailableMemberNames: string[];
  message: string;
};

export type ScheduleProposalDto = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  createdByUserId: string;
  createdByName: string;
  active: boolean;
  yesCount: number;
  noCount: number;
  myAvailability: ScheduleAvailabilityType | null;
  allAgreed: boolean;
  confirmed: boolean;
  message: string;
};

export type StudioDto = {
  id: string;
  name: string;
  region: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  externalUrl: string | null;
  sourceUrl: string | null;
  scrapedAt: string | null;
  hourlyPrice: number | null;
  distanceAverageKm: number | null;
  myDistanceKm: number | null;
};

export type StudioCandidateDto = {
  id: string;
  studio: StudioDto;
  createdByUserId: string;
  createdByName: string;
  note: string | null;
  status: StudioCandidateStatus;
  voteCount: number;
  didVote: boolean;
  expectedHours: number;
  estimatedTotalPrice: number | null;
  estimatedPerMemberPrice: number | null;
  distanceTotalKm: number | null;
  distanceAverageKm: number | null;
  missingLocationCount: number;
  recommendationRank: number | null;
  voteDeadlineAt: string | null;
  voteClosed: boolean;
  createdAt: string;
};

export type StudioVoteDto = {
  id: string;
  candidateId: string;
  userId: string;
};

export type StudioLocationDto = {
  label: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type SettlementParticipantDto = {
  userId: string;
  memberName: string;
  profileImageUrl: string | null;
  amount: number;
  paid: boolean;
  paidAt: string | null;
};

export type SettlementRoundDto = {
  id: string;
  status: 'active' | 'outstanding' | 'completed';
  totalAmount: number;
  participants: SettlementParticipantDto[];
  createdByUserId: string;
  createdByName: string;
  updatedByUserId: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deadlineAt: string;
  version: number;
};

export type SettlementOverviewDto = {
  activeRounds: SettlementRoundDto[];
  outstandingRounds: SettlementRoundDto[];
  outstandingSummary: {
    totalAmount: number;
    unpaidCount: number;
    unpaidMemberCount: number;
  };
  recentCompleted: SettlementRoundDto[];
};

/** @deprecated 이전 정산 화면의 컴파일 호환용입니다. */
export type SettlementDto = {
  selectedStudioId: string | null;
  customTotalPrice: number | null;
  priceMode: 'studio' | 'manual';
  manualHourlyPrice: number | null;
  usageHours: number;
  usageHoursFromSchedule: boolean;
  participantUserIds: string[];
  paidUserIds: string[];
  outstandingAmountsByUserId: Record<string, number>;
  outstandingPaymentHistory: OutstandingPaymentHistoryItemDto[];
  updatedAt: string;
};

export type OutstandingPaymentHistoryItemDto = {
  id: string;
  userId: string;
  memberName: string;
  amount: number;
  paidAt: string;
  markedByUserId: string;
  markedByName: string;
};

export type TodoItemDto = {
  type: TodoType;
  title: string;
  description: string;
  dueLabel?: string | null;
  dueAt?: string | null;
  shortcut?: 'song_round' | 'practice' | 'schedule';
  targetId?: string | null;
};

export type VoteStepStatus = 'none' | 'needed' | 'done';

export type VoteSummaryDto = {
  song: VoteStepStatus;
  schedule: VoteStepStatus;
  studio: VoteStepStatus;
};

export type BandSongCardDto = {
  id: string;
  title: string;
  artist: string;
  youtubeUrl?: string | null;
  thumbnailUrl: string | null;
  practiceAssignmentId?: string | null;
  practiceDueAt?: string | null;
  practiceStatus?: 'open' | 'closed' | null;
  practiceAssignments?: Array<{
    id: string;
    title: string;
    dueAt: string;
    status: 'open' | 'closed';
  }>;
  kind: 'song' | 'picking';
};

export type BandHomeDto = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  inviteCode: string;
  memberCount: number;
  myMembership: {
    role: MemberRole;
    positionLabel: string;
    profileImageUrl: string | null;
  };
  activeSongRound: {
    id: string;
    status: SongRoundStatus;
    finalCandidateId: string | null;
  } | null;
  openPracticeCount: number;
  openScheduleSlotCount: number;
  nextRehearsal: {
    date: string;
    startTime: string;
    endTime: string;
  } | null;
  confirmedStudioName: string | null;
  todos: TodoItemDto[];
  voteSummary: VoteSummaryDto;
  songCards: BandSongCardDto[];
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};
