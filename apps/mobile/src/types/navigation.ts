export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type BandsStackParamList = {
  BandList: undefined;
  Profile: undefined;
  BandAdd: undefined;
  CreateBand: undefined;
  JoinBand: { inviteCode?: string } | undefined;
  BandHome: { bandId: string };
  VoteHub: { bandId: string };
  BandMembers: { bandId: string };
  SongRound: { bandId: string };
  SongVote: { bandId: string };
  AddSongCandidate: { bandId: string };
  PracticeAssignments: { bandId: string };
  SongPracticeDetail: { bandId: string; songCandidateId: string };
  CreatePracticeAssignment: { bandId: string; songCandidateId?: string };
  PracticeAssignmentDetail: { bandId: string; assignmentId: string };
  ScheduleEdit: { bandId: string; period?: 'morning' | 'afternoon'; initialDayIndex?: number };
  CreateScheduleSlot: { bandId: string };
  Studios: { bandId: string };
  Settlement: { bandId: string };
  SettlementDetail: { bandId: string; settlementId: string };
  SettlementHistory: { bandId: string };
  CreateStudioCandidate: { bandId: string };
};
