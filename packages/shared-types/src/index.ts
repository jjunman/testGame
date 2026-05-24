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
  | 'vote_studio'
  | 'submit_practice'
  | 'submit_schedule'
  | 'start_studio';

export type BandSummary = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  inviteCode: string;
  myRole: MemberRole;
  myPosition: string;
  memberCount: number;
};

export type BandMemberSummary = {
  userId: string;
  name: string;
  role: MemberRole;
  positionLabel: string;
  volumePoints: number;
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
  audioUrl: string;
  submittedAt: string;
};

export type ScheduleSlotDto = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  yesCount: number;
  noCount: number;
  myAvailability: ScheduleAvailabilityType | null;
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
  priceNote: string | null;
  amenitiesNote: string | null;
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

export type TodoItemDto = {
  type: TodoType;
  title: string;
  description: string;
  dueLabel?: string | null;
  dueAt?: string | null;
  shortcut?: 'song_round' | 'practice' | 'schedule' | 'studio';
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
    volumePoints: number;
  };
  activeSongRound: {
    id: string;
    status: SongRoundStatus;
    finalCandidateId: string | null;
  } | null;
  openPracticeCount: number;
  openScheduleSlotCount: number;
  todos: TodoItemDto[];
  voteSummary: VoteSummaryDto;
  songCards: BandSongCardDto[];
};

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};
