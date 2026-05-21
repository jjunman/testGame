export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type BandsStackParamList = {
  BandList: undefined;
  Profile: undefined;
  BandAdd: undefined;
  CreateBand: undefined;
  JoinBand: undefined;
  BandHome: { bandId: string };
  VoteHub: { bandId: string };
  BandMembers: { bandId: string };
  SongRound: { bandId: string; initialTab?: 'vote' | 'library' };
  AddSongCandidate: { bandId: string };
  PracticeAssignments: { bandId: string };
  CreatePracticeAssignment: { bandId: string };
  PracticeAssignmentDetail: { bandId: string; assignmentId: string };
  Schedule: { bandId: string };
  ScheduleEdit: { bandId: string; period: 'morning' | 'afternoon' };
  CreateScheduleSlot: { bandId: string };
  Studios: { bandId: string };
  CreateStudioCandidate: { bandId: string };
};
