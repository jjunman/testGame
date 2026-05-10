export enum MemberRole {
  LEADER = 'leader',
  MEMBER = 'member',
}

export enum PositionType {
  LEAD_GUITAR = 'lead_guitar',
  SUB_GUITAR = 'sub_guitar',
  BASS = 'bass',
  DRUMS = 'drums',
  PIANO = 'piano',
  VOCAL = 'vocal',
  CUSTOM = 'custom',
}

export enum SongRoundStatus {
  POSTED = 'posted',
  VOTING = 'voting',
  DONE = 'done',
}

export enum SongDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum PracticeAssignmentStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum PracticeSubmissionStatus {
  SUBMITTED = 'submitted',
}

export enum ScheduleAvailabilityType {
  YES = 'yes',
  NO = 'no',
}

export enum PointLogReason {
  PRACTICE_ON_TIME = 'practice_on_time',
  PRACTICE_MISSED = 'practice_missed',
}

export enum PointLogRelatedType {
  PRACTICE_ASSIGNMENT = 'practice_assignment',
}
