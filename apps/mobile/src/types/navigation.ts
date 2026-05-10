import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type BandsStackParamList = {
  BandList: undefined;
  CreateBand: undefined;
  JoinBand: undefined;
  BandHome: { bandId: string };
  VoteHub: { bandId: string };
  BandMembers: { bandId: string };
  SongRound: { bandId: string };
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

export type MainTabParamList = {
  BandsTab: NavigatorScreenParams<BandsStackParamList> | undefined;
  UserTab: undefined;
};
