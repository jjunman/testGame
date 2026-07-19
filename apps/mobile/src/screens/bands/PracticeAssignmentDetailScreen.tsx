import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PracticeFeedbackDto } from '@band/shared-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioPlayer, AudioRecorder, AudioStatus, RecorderState } from 'expo-audio';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import YoutubePlayer from 'react-native-youtube-iframe';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, PrimaryButton, StatusBadge } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';
import {
  buildDurationMessage,
  DraftRecording,
  formatDateOnly,
  formatRange,
  formatSeconds,
  getFallbackYoutubeVideoId,
  getLegacyTakeNumber,
  getNextTakeNumber,
  getPracticeProgress,
  getRequiredRecordingSec,
  getSourcePlaybackPlan,
  getYoutubeVideoId,
  isLongEnoughForAssignment,
  meteringToWaveHeight,
  normalizeWaveform,
  PracticeDetailDto,
  PracticeMode,
  PracticeSubmissionDto,
} from './practiceDetailUtils';

type Props = NativeStackScreenProps<BandsStackParamList, 'PracticeAssignmentDetail'>;

const MAX_DRAFTS = 5;
const RECORDING_COUNTDOWN_SECONDS = 7;
const AUDIO_LOAD_TIMEOUT_MS = 12000;
const AUDIO_PLAYER_OPTIONS = { keepAudioSessionActive: true };

export function PracticeAssignmentDetailScreen({ route, navigation }: Props) {
  const { assignmentId, bandId } = route.params;
  const { currentBand } = useCurrentBand();
  const { user } = useAuth();
  const [detail, setDetail] = useState<PracticeDetailDto | null>(null);
  const [submissions, setSubmissions] = useState<PracticeSubmissionDto[]>([]);
  const [feedback, setFeedback] = useState<PracticeFeedbackDto[]>([]);
  const [drafts, setDrafts] = useState<DraftRecording[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [mode, setMode] = useState<PracticeMode>('main');
  const [uploading, setUploading] = useState(false);
  const [generatingMix, setGeneratingMix] = useState(false);
  const [closingAssignment, setClosingAssignment] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingStopSignal, setRecordingStopSignal] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingAutoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTargetStartAtRef = useRef<number | null>(null);
  const recordingSyncOffsetMsRef = useRef<number>(0);
  const autoMixRequestedRef = useRef<string | null>(null);
  const waveformRef = useRef<number[]>([]);

  const isLeader = currentBand?.myRole === 'leader';
  const selectedDraft = drafts.find((item) => item.id === selectedDraftId) ?? null;
  const storageKey = `practice_drafts_${assignmentId}`;
  const youtubeVideoId = useMemo(
    () => getYoutubeVideoId(detail?.song?.youtubeUrl ?? null) ?? getFallbackYoutubeVideoId(detail?.song?.title, detail?.song?.artist),
    [detail?.song?.artist, detail?.song?.title, detail?.song?.youtubeUrl],
  );
  const coverImage = youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : currentBand?.thumbnailUrl || fallbackBandImage;

  const loadDrafts = useCallback(async () => {
    const raw = await AsyncStorage.getItem(storageKey);
    const nextDrafts: DraftRecording[] = raw ? JSON.parse(raw) : [];
    setDrafts(nextDrafts);
    setSelectedDraftId((current) => current ?? nextDrafts[0]?.id ?? null);
  }, [storageKey]);

  const persistDrafts = useCallback(
    async (nextDrafts: DraftRecording[]) => {
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextDrafts));
      setDrafts(nextDrafts);
      setSelectedDraftId(nextDrafts[0]?.id ?? null);
    },
    [storageKey],
  );

  const load = useCallback(async () => {
    const nextDetail = await api.get<PracticeDetailDto>(`/practice-assignments/${assignmentId}`);
    setDetail(nextDetail);
    try {
      setSubmissions(await api.get<PracticeSubmissionDto[]>(`/practice-assignments/${assignmentId}/submissions`));
    } catch {
      setSubmissions([]);
    }
    if (nextDetail.isClosed) {
      try {
        setFeedback(await api.get<PracticeFeedbackDto[]>(`/practice-assignments/${assignmentId}/feedback`));
      } catch {
        setFeedback([]);
      }
    } else {
      setFeedback([]);
    }
    await loadDrafts();
  }, [assignmentId, loadDrafts]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (recordingRef.current) {
        void recordingRef.current.stop().catch(() => undefined);
      }
      if (meteringTimerRef.current) {
        clearInterval(meteringTimerRef.current);
      }
      if (recordingAutoStopTimerRef.current) {
        clearTimeout(recordingAutoStopTimerRef.current);
      }
    };
  }, []);

  const addDraft = async (
    uri: string,
    source: DraftRecording['source'],
    waveform?: number[],
    durationSec?: number | null,
    syncOffsetMs = 0,
  ) => {
    const nextDraft: DraftRecording = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri,
      createdAt: new Date().toISOString(),
      source,
      takeNumber: getNextTakeNumber(drafts),
      durationSec: durationSec ?? null,
      syncOffsetMs,
      waveform: normalizeWaveform(waveform),
    };
    await persistDrafts([nextDraft, ...drafts].slice(0, MAX_DRAFTS));
  };

  const beginRecording = async () => {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
    const nextRecording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await nextRecording.prepareToRecordAsync({
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });
    nextRecording.record();
    const targetStartAt = recordingTargetStartAtRef.current;
    recordingSyncOffsetMsRef.current = targetStartAt === null ? 0 : Math.max(-1500, Math.min(1500, Date.now() - targetStartAt));
    recordingRef.current = nextRecording;
    waveformRef.current = [];
    meteringTimerRef.current = setInterval(() => {
      try {
        const status = nextRecording.getStatus();
        if (typeof status.metering === 'number') {
          waveformRef.current.push(meteringToWaveHeight(status.metering));
        }
      } catch {
        // Ignore transient status reads while the recorder is stopping.
      }
    }, 180);
    setRecording(true);

    const requiredSec = getRequiredRecordingSec(detail);
    if (requiredSec !== null) {
      recordingAutoStopTimerRef.current = setTimeout(() => {
        recordingAutoStopTimerRef.current = null;
        if (recordingRef.current) {
          void stopRecording();
        }
      }, requiredSec * 1000 + 250);
    }
  };

  const startRecording = async () => {
    const confirmed = await showRecordingReadyAlert();
    if (!confirmed) {
      return false;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '녹음을 하려면 마이크 권한이 필요해요.');
      return false;
    }

    setCountdown(RECORDING_COUNTDOWN_SECONDS);
    recordingTargetStartAtRef.current = Date.now() + RECORDING_COUNTDOWN_SECONDS * 1000;
    countdownTimerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current === null) {
          return null;
        }
        if (current <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          countdownTimerRef.current = null;
          void beginRecording();
          return null;
        }
        return current - 1;
      });
    }, 1000);
    return true;
  };

  const stopRecording = async () => {
    if (!recordingRef.current) {
      return;
    }

    if (meteringTimerRef.current) {
      clearInterval(meteringTimerRef.current);
      meteringTimerRef.current = null;
    }
    if (recordingAutoStopTimerRef.current) {
      clearTimeout(recordingAutoStopTimerRef.current);
      recordingAutoStopTimerRef.current = null;
    }

    const status = getRecordingStatusSafely(recordingRef.current);
    const durationSec = typeof status?.durationMillis === 'number' ? status.durationMillis / 1000 : null;
    await recordingRef.current.stop();
    const uri = recordingRef.current.uri ?? status?.url ?? null;
    const waveform = waveformRef.current;
    const syncOffsetMs = recordingSyncOffsetMsRef.current;
    const requiredSec = getRequiredRecordingSec(detail);
    const normalizedDurationSec = requiredSec ?? durationSec;
    recordingRef.current = null;
    recordingTargetStartAtRef.current = null;
    setRecording(false);
    setRecordingStopSignal((value) => value + 1);

    if (!uri) {
      Alert.alert('저장 실패', '녹음 파일을 저장하지 못했어요.');
      return;
    }

    if (!isLongEnoughForAssignment(durationSec, detail)) {
      Alert.alert('녹음 길이 부족', buildDurationMessage(detail, durationSec));
      return;
    }

    await addDraft(uri, 'recorded', waveform, normalizedDurationSec, syncOffsetMs);
    setMode('practice');
  };

  const cancelRecording = async (options?: { silent?: boolean }) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);

    if (recordingRef.current) {
      await recordingRef.current.stop().catch(() => undefined);
      recordingRef.current = null;
    }
    if (meteringTimerRef.current) {
      clearInterval(meteringTimerRef.current);
      meteringTimerRef.current = null;
    }
    if (recordingAutoStopTimerRef.current) {
      clearTimeout(recordingAutoStopTimerRef.current);
      recordingAutoStopTimerRef.current = null;
    }
    waveformRef.current = [];
    recordingTargetStartAtRef.current = null;
    recordingSyncOffsetMsRef.current = 0;
    setRecording(false);
    setRecordingStopSignal((value) => value + 1);
    if (!options?.silent) {
          Alert.alert('녹음 취소', '이번 녹음은 저장하지 않았어요.');
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (mode === 'main') {
        return;
      }

      const actionType = event.data.action.type;
      if (actionType !== 'GO_BACK' && actionType !== 'POP' && actionType !== 'POP_TO_TOP') {
        return;
      }

      event.preventDefault();
      if (mode === 'practice' && (recording || countdown !== null || recordingRef.current)) {
        void cancelRecording({ silent: true });
      }
      setMode('main');
    });

    return unsubscribe;
  }, [cancelRecording, countdown, mode, navigation, recording]);

  const generateMix = async (options?: { silent?: boolean }) => {
    if (submissions.length === 0) {
      if (!options?.silent) {
        Alert.alert('녹음본 없음', '아직 믹싱할 제출본이 없어요.');
      }
      return;
    }

    setGeneratingMix(true);
    try {
      const result = await api.post<{ mixAudioUrl: string; mixGeneratedAt: string; submissionCount: number }>(
        `/practice-assignments/${assignmentId}/mix`,
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              mixAudioUrl: result.mixAudioUrl,
              mixGeneratedAt: result.mixGeneratedAt,
            }
          : current,
      );
      if (!options?.silent) {
        Alert.alert('믹스 생성 완료', `${result.submissionCount}개의 녹음본을 하나의 파일로 합쳤어요.`);
      }
    } catch (error) {
      Alert.alert('믹스 생성 실패', error instanceof Error ? error.message : '믹스 파일을 만들지 못했어요.');
    } finally {
      setGeneratingMix(false);
    }
  };

  useEffect(() => {
    if (!detail?.isClosed || detail.mixAudioUrl || submissions.length === 0 || generatingMix) {
      return;
    }

    const requestKey = `${detail.id}:${submissions.length}`;
    if (autoMixRequestedRef.current === requestKey) {
      return;
    }

    autoMixRequestedRef.current = requestKey;
    void generateMix({ silent: true });
  }, [detail?.id, detail?.isClosed, detail?.mixAudioUrl, submissions.length, generatingMix]);

  const closeAssignmentNow = () => {
    Alert.alert('연습 과제를 지금 끝낼까요?', '마감 처리하면 바로 제출본과 믹스 버전을 확인할 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지금 끝내기',
        style: 'destructive',
        onPress: async () => {
          setClosingAssignment(true);
          try {
            const nextDetail = await api.post<PracticeDetailDto>(`/practice-assignments/${assignmentId}/close`);
            setDetail(nextDetail);
            try {
              setSubmissions(await api.get<PracticeSubmissionDto[]>(`/practice-assignments/${assignmentId}/submissions`));
            } catch {
              setSubmissions([]);
            }
          } catch (error) {
            Alert.alert('마감 실패', error instanceof Error ? error.message : '연습 과제를 마감하지 못했어요.');
          } finally {
            setClosingAssignment(false);
          }
        },
      },
    ]);
  };

  const submitSelectedDraft = async () => {
    if (!selectedDraft) {
      Alert.alert('선택 필요', '제출할 녹음본을 골라 주세요.');
      return;
    }

    if (!isLongEnoughForAssignment(selectedDraft.durationSec ?? null, detail)) {
      Alert.alert('녹음 길이 부족', buildDurationMessage(detail, selectedDraft.durationSec ?? null));
      return;
    }

    const form = new FormData();
    form.append('audio', {
      uri: selectedDraft.uri,
      name: `practice-${selectedDraft.id}.m4a`,
      type: 'audio/m4a',
    } as never);
    form.append('durationSec', String(selectedDraft.durationSec ?? ''));
    form.append('syncOffsetMs', String(selectedDraft.syncOffsetMs ?? 0));

    setUploading(true);
    try {
      await api.post(`/practice-assignments/${assignmentId}/submission`, form);
      Alert.alert('제출 완료', '녹음본을 제출했어요.');
      await load();
      setMode('main');
    } catch (error) {
      Alert.alert('제출 실패', error instanceof Error ? error.message : '녹음본을 제출하지 못했어요.');
    } finally {
      setUploading(false);
    }
  };

  if (!detail) {
    return (
      <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>연습 정보를 불러오는 중</Text>
          <Text style={styles.loadingText}>곡 정보와 녹음본을 준비하고 있어요.</Text>
        </View>
      </Screen>
    );
  }

  const songTitle = detail.song?.title ?? detail.title;
  const artist = detail.song?.artist ?? currentBand?.name ?? '개인 연습';
  const dueLabel = new Date(detail.dueAt).toLocaleDateString('ko-KR');
  const progress = getPracticeProgress(detail.startSec, detail.endSec);

  if (detail.isClosed) {
    return (
      <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
        <ClosedPracticeResult
          title={songTitle}
          artist={artist}
          imageUrl={coverImage}
          submissions={submissions}
          feedback={feedback}
          currentUserId={user?.id ?? ''}
          onFeedbackUpsert={(item) => setFeedback((current) =>
            [...current.filter((existing) => existing.id !== item.id), item]
              .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
          )}
          onFeedbackDelete={(feedbackId) => setFeedback((current) => current.filter((item) => item.id !== feedbackId))}
          isLeader={isLeader}
          mixAudioUrl={detail.mixAudioUrl}
          mixGeneratedAt={detail.mixGeneratedAt}
          generatingMix={generatingMix}
          onGenerateMix={() => void generateMix()}
        />
      </Screen>
    );
  }

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
      <PracticeHeader
        title={songTitle}
        artist={artist}
        dueLabel={dueLabel}
        progress={progress}
        imageUrl={coverImage}
        submitted={Boolean(detail.mySubmission)}
      />

      <PracticeModeTimeline
        mode={mode}
        submitted={Boolean(detail.mySubmission)}
        hasDrafts={drafts.length > 0}
        onChange={setMode}
      />

      {mode === 'main' ? (
        <MainPanel
          detail={detail}
          closing={closingAssignment}
          onCloseNow={closeAssignmentNow}
          onPractice={() => setMode('practice')}
        />
      ) : null}

      {mode === 'practice' ? (
        <PracticePanel
          youtubeVideoId={youtubeVideoId}
          detail={detail}
          recording={recording}
          stopSignal={recordingStopSignal}
          countdown={countdown}
          onStartRecording={startRecording}
          onStopRecording={() => void stopRecording()}
          onCancel={() => void cancelRecording()}
          onSubmit={() => setMode('submit')}
        />
      ) : null}

      {mode === 'submit' ? (
        <SubmitPanel
          drafts={drafts}
          selectedDraftId={selectedDraftId}
          uploading={uploading}
          onSelect={setSelectedDraftId}
          onSubmit={() => void submitSelectedDraft()}
        />
      ) : null}

    </Screen>
  );
}

function ClosedPracticeResult({
  title,
  artist,
  imageUrl,
  submissions,
  feedback,
  currentUserId,
  onFeedbackUpsert,
  onFeedbackDelete,
  isLeader,
  mixAudioUrl,
  mixGeneratedAt,
  generatingMix,
  onGenerateMix,
}: {
  title: string;
  artist: string;
  imageUrl: string;
  submissions: PracticeSubmissionDto[];
  feedback: PracticeFeedbackDto[];
  currentUserId: string;
  onFeedbackUpsert: (feedback: PracticeFeedbackDto) => void;
  onFeedbackDelete: (feedbackId: string) => void;
  isLeader: boolean;
  mixAudioUrl: string | null;
  mixGeneratedAt: string | null;
  generatingMix: boolean;
  onGenerateMix: () => void;
}) {
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const playableSubmissions = submissions;

  return (
    <View style={styles.closedResult}>
      <ImageBackground source={{ uri: imageUrl }} imageStyle={styles.closedThumbImage} style={styles.closedThumb}>
        <View style={styles.closedThumbOverlay} />
        <View style={styles.closedThumbText}>
          <Text style={styles.closedTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.closedArtist} numberOfLines={1}>{artist}</Text>
        </View>
        <StatusBadge label="연습 완료" tone="success" />
      </ImageBackground>

      {mixAudioUrl ? (
        <RemoteAudioPlayer
          audioId="mix"
          activeAudioId={activeAudioId}
                onActiveAudioChange={setActiveAudioId}
          uri={mixAudioUrl}
          title="믹스 녹음본"
          subtitle={mixGeneratedAt ? `생성 ${new Date(mixGeneratedAt).toLocaleString('ko-KR')}` : '멤버 제출본을 합친 녹음본'}
          onRefresh={isLeader ? onGenerateMix : undefined}
          refreshing={generatingMix}
        />
      ) : submissions.length > 0 ? (
        <View style={styles.mixButton}>
          <Ionicons name={generatingMix ? 'hourglass-outline' : 'albums-outline'} size={18} color="#fff" />
          <View style={styles.submissionBody}>
            <Text style={styles.submissionTitle}>{generatingMix ? '믹스 생성 중' : '믹스 준비 중'}</Text>
            <Text style={styles.submissionMeta}>{`${submissions.length}개의 녹음본을 합치고 있어요`}</Text>
          </View>
        </View>
      ) : null}


      {playableSubmissions.length > 0 ? (
        <>
          <Text style={styles.submissionSectionLabel}>-- 멤버들의 개별 녹음본 --</Text>
          <View style={styles.closedSubmissionList}>
            {playableSubmissions.map((submission) => (
              <SubmissionTilePlayer
                key={submission.id}
                audioId={submission.id}
                activeAudioId={activeAudioId}
                onActiveAudioChange={setActiveAudioId}
                uri={submission.audioUrl}
                title={submission.userName}
                positionLabel={submission.positionLabel}
                dateLabel={formatDateOnly(submission.submittedAt)}
                ownerId={submission.userId}
                currentUserId={currentUserId}
                feedback={feedback.filter((item) => item.submissionId === submission.id)}
                onFeedbackUpsert={onFeedbackUpsert}
                onFeedbackDelete={onFeedbackDelete}
              />
            ))}
          </View>
        </>
      ) : (
        <EmptyState title="녹음본이 없어요" description="마감 전에 제출된 녹음본이 없어서 들을 파일이 없어요." />
      )}
    </View>
  );
}

function PracticeHeader({
  title,
  artist,
  dueLabel,
  progress,
  imageUrl,
  submitted,
}: {
  title: string;
  artist: string;
  dueLabel: string;
  progress: number;
  imageUrl: string;
  submitted: boolean;
}) {
  return (
    <ImageBackground source={{ uri: imageUrl }} imageStyle={styles.headerImage} style={styles.header}>
      <View style={styles.headerOverlay} />
      <StatusBadge label={submitted ? '제출 완료' : '연습 진행중'} tone={submitted ? 'success' : 'danger'} />
      <View style={styles.headerText}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>{artist}</Text>
        <Text style={styles.headerMeta}>마감일 {dueLabel}</Text>
        <Text style={styles.headerMeta}>진행률 {progress}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </ImageBackground>
  );
}

function PracticeModeTimeline({
  mode,
  submitted,
  hasDrafts,
  onChange,
}: {
  mode: PracticeMode;
  submitted: boolean;
  hasDrafts: boolean;
  onChange: (mode: PracticeMode) => void;
}) {
  const steps: Array<{ mode: PracticeMode; label: string; icon: keyof typeof Ionicons.glyphMap; completed: boolean }> = [
    { mode: 'main', label: '과제', icon: 'document-text-outline', completed: true },
    { mode: 'practice', label: '연습', icon: 'musical-notes-outline', completed: hasDrafts || submitted },
    { mode: 'submit', label: '제출', icon: 'mic-outline', completed: submitted },
  ];

  return (
    <View style={styles.stepperCard}>
      {steps.map((step, index) => {
        const active = mode === step.mode;
        return (
          <Pressable key={step.mode} style={styles.stepItem} onPress={() => onChange(step.mode)}>
            {index < steps.length - 1 ? <View style={[styles.stepLine, step.completed && styles.stepLineDone]} /> : null}
            <View style={[styles.stepDot, step.completed && styles.stepDotDone, active && styles.stepDotActive]}>
              <Ionicons name={step.completed ? 'checkmark' : step.icon} size={14} color={active || step.completed ? '#fff' : theme.colors.primary} />
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MainPanel({
  detail,
  closing,
  onCloseNow,
  onPractice,
}: {
  detail: PracticeDetailDto;
  closing: boolean;
  onCloseNow: () => void;
  onPractice: () => void;
}) {
  return (
    <View style={styles.mainPanel}>
      <View style={styles.rangeHighlight}>
        <View style={styles.rangeHighlightHeader}>
          <View style={styles.rangeHighlightIcon}>
            <Ionicons name="timer-outline" size={18} color={theme.colors.accent} />
          </View>
          <Text style={styles.rangeHighlightLabel}>연습 구간</Text>
        </View>
        <Text style={styles.rangeHighlightValue}>{formatRange(detail.startSec, detail.endSec)}</Text>
      </View>
      <View style={styles.memoBlock}>
        <View style={styles.memoHeader}>
          <Ionicons name="document-text-outline" size={17} color={theme.colors.textMuted} />
          <Text style={styles.memoLabel}>메모</Text>
        </View>
        <Text style={[styles.memoText, !detail.description && styles.memoTextEmpty]}>
          {detail.description || '등록된 메모가 없어요.'}
        </Text>
      </View>
      <ActionRow icon="musical-notes-outline" label={detail.mySubmission ? '다시 연습하기' : '연습 시작'} onPress={onPractice} />
      {!detail.isClosed ? (
        <Pressable
          onPress={onCloseNow}
          disabled={closing}
          style={[styles.subtleEndButton, closing && styles.subtleEndButtonDisabled]}
        >
          <Text style={styles.subtleEndButtonText}>{closing ? '끝내는 중...' : '지금 끝내기'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PracticePanel({
  youtubeVideoId,
  detail,
  recording,
  stopSignal,
  countdown,
  onStartRecording,
  onStopRecording,
  onCancel,
  onSubmit,
}: {
  youtubeVideoId: string | null;
  detail: PracticeDetailDto;
  recording: boolean;
  stopSignal: number;
  countdown: number | null;
  onStartRecording: () => Promise<boolean>;
  onStopRecording: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const playerRef = useRef<any>(null);
  const sourceStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const [playerResetKey, setPlayerResetKey] = useState(0);

  useEffect(() => {
    return () => {
      if (sourceStartTimerRef.current) {
        clearTimeout(sourceStartTimerRef.current);
      }
      if (sourceStopTimerRef.current) {
        clearTimeout(sourceStopTimerRef.current);
      }
    };
  }, []);

  const clearSourceStartTimer = () => {
    if (sourceStartTimerRef.current) {
      clearTimeout(sourceStartTimerRef.current);
      sourceStartTimerRef.current = null;
    }
  };

  const clearSourceStopTimer = () => {
    if (sourceStopTimerRef.current) {
      clearTimeout(sourceStopTimerRef.current);
      sourceStopTimerRef.current = null;
    }
  };

  const stopSourcePlayback = () => {
    clearSourceStartTimer();
    clearSourceStopTimer();
    setSourcePlaying(false);
    setPlayerResetKey((value) => value + 1);
    playerRef.current?.pauseVideo?.();
    playerRef.current?.getInternalPlayer?.()?.pauseVideo?.();
  };

  useEffect(() => {
    if (stopSignal > 0) {
      stopSourcePlayback();
    }
  }, [stopSignal]);

  const handleRecordPress = async () => {
    if (recording) {
      stopSourcePlayback();
      onStopRecording();
      return;
    }

    const recordingStarted = await onStartRecording();
    if (!recordingStarted) {
      return;
    }

    if (youtubeVideoId) {
      clearSourceStartTimer();
      clearSourceStopTimer();
      const segmentStartSec = Math.max(0, detail.startSec ?? 0);
      const segmentEndSec = detail.endSec !== null && detail.endSec > segmentStartSec ? detail.endSec : null;
      const { sourceStartDelayMs, sourceStartSec } = getSourcePlaybackPlan(segmentStartSec, RECORDING_COUNTDOWN_SECONDS);

      if (sourceStartDelayMs === 0) {
        playerRef.current?.seekTo?.(sourceStartSec, true);
        setSourcePlaying(true);
      } else {
        playerRef.current?.pauseVideo?.();
        playerRef.current?.getInternalPlayer?.()?.pauseVideo?.();
        setSourcePlaying(false);
        sourceStartTimerRef.current = setTimeout(() => {
          sourceStartTimerRef.current = null;
          playerRef.current?.seekTo?.(sourceStartSec, true);
          setSourcePlaying(true);
        }, sourceStartDelayMs);
      }

      if (segmentEndSec !== null) {
        const stopDelayMs = RECORDING_COUNTDOWN_SECONDS * 1000 + (segmentEndSec - segmentStartSec) * 1000 + 250;
        sourceStopTimerRef.current = setTimeout(() => {
          sourceStopTimerRef.current = null;
          stopSourcePlayback();
          onStopRecording();
        }, stopDelayMs);
      }
    }
  };

  const handleCancelPress = () => {
    stopSourcePlayback();
    onCancel();
  };

  return (
    <View style={styles.panel}>
      <View style={styles.youtubeBox}>
        {youtubeVideoId ? (
          <YoutubePlayer
            key={`${youtubeVideoId}-${playerResetKey}`}
            ref={playerRef}
            height={178}
            play={sourcePlaying}
            videoId={youtubeVideoId}
          />
        ) : (
          <View style={styles.playerFallback}>
            <MaterialCommunityIcons name="youtube" size={38} color={theme.colors.primary} />
            <Text style={styles.description}>연결된 유튜브 영상이 없어요.</Text>
          </View>
        )}
      </View>
      <View style={styles.segmentCard}>
        <Text style={styles.segmentTitle}>연습 구간</Text>
        <FakeTimeline startSec={detail.startSec} endSec={detail.endSec} />
        <Text style={styles.segmentText}>{formatRange(detail.startSec, detail.endSec)}</Text>
      </View>
      <RecorderDeck
        recording={recording}
        countdown={countdown}
        disabled={detail.isClosed}
        onRecord={handleRecordPress}
        onCancel={handleCancelPress}
      />
      <PrimaryButton label="제출하러 가기" onPress={onSubmit} />
    </View>
  );
}

function RecorderDeck({
  recording,
  countdown,
  disabled,
  onRecord,
  onCancel,
}: {
  recording: boolean;
  countdown: number | null;
  disabled: boolean;
  onRecord: () => void;
  onCancel: () => void;
}) {
  const preparing = countdown !== null;
  const status = disabled
    ? '마감됨'
    : recording
      ? '녹음 중'
      : preparing
        ? '준비'
        : '대기';
  const hint = disabled
    ? '마감된 과제는 새 녹음을 만들 수 없어요.'
    : recording
      ? '연주가 끝나면 가운데 버튼을 눌러 저장해요.'
      : preparing
        ? '원곡은 재생 중이고 아직 녹음되지 않아요.'
        : '누르면 원곡이 7초 전부터 재생되고, 카운트다운 뒤 녹음돼요.';

  return (
    <View style={styles.recorderCard}>
      <View style={styles.recorderTopRow}>
        <Text style={styles.recorderStatus}>{status}</Text>
      </View>
      <Pressable
        onPress={() => void onRecord()}
        disabled={disabled || preparing}
        style={[
          styles.recordButton,
          recording && styles.recordButtonStop,
          preparing && styles.recordButtonCountingDown,
          (disabled || preparing) && styles.recordButtonDisabled,
        ]}
      >
        {preparing ? (
          <Text style={styles.recordCountdownText}>{countdown}</Text>
        ) : (
          <View style={[styles.recordButtonCore, recording && styles.recordButtonCoreStop]} />
        )}
      </Pressable>
      <Text style={styles.recorderHint}>{hint}</Text>
      {recording || preparing ? (
        <Pressable style={styles.cancelPill} onPress={onCancel}>
          <Text style={styles.cancelPillText}>취소</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SubmitPanel({
  drafts,
  selectedDraftId,
  uploading,
  onSelect,
  onSubmit,
}: {
  drafts: DraftRecording[];
  selectedDraftId: string | null;
  uploading: boolean;
  onSelect: (id: string) => void;
  onSubmit: () => void;
}) {
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null;

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>제출 녹음본 선택</Text>
      <SelectedDraftPlayer
        draft={selectedDraft}
      />
      {drafts.length === 0 ? (
        <EmptyState title="임시 저장 녹음본이 없어요" description="연습 화면에서 직접 녹음하면 최대 5개까지 보관돼요." />
      ) : (
        <View style={styles.draftList}>
          {drafts.map((draft, index) => {
            const selected = draft.id === selectedDraftId;
            const takeNumber = draft.takeNumber ?? getLegacyTakeNumber(drafts, index);
            return (
              <Pressable key={draft.id} style={[styles.draftItem, selected && styles.draftItemSelected]} onPress={() => onSelect(draft.id)}>
                <View style={[styles.selectBadge, selected && styles.selectBadgeSelected]}>
                  <Ionicons name={selected ? 'checkmark' : 'musical-note'} size={14} color={selected ? '#fff' : theme.colors.primary} />
                </View>
                <View style={styles.draftBody}>
                  <Text style={[styles.draftTitle, selected && styles.draftTitleSelected]}>take_{String(takeNumber).padStart(2, '0')}</Text>
                  <Text style={[styles.draftMeta, selected && styles.draftMetaSelected]}>
                    {draft.source === 'recorded' ? '직접 녹음' : '불러온 파일'} · {new Date(draft.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <PrimaryButton label="제출하기" onPress={onSubmit} loading={uploading} disabled={!selectedDraftId} />
    </View>
  );
}

function SelectedDraftPlayer({ draft }: { draft: DraftRecording | null }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        releaseAudioPlayer(playerRef.current);
        playerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setPlaying(false);
    if (playerRef.current) {
      releaseAudioPlayer(playerRef.current);
      playerRef.current = null;
    }
  }, [draft?.uri]);

  const togglePlayback = async () => {
    if (!draft) {
      return;
    }

    if (playerRef.current && playing) {
      playerRef.current.pause();
      setPlaying(false);
      return;
    }

    if (!playerRef.current) {
      const player = createBandAudioPlayer(toApiAssetUrl(draft.uri) ?? draft.uri);
      player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          void player.seekTo(0).catch(() => undefined);
        }
      });
      playerRef.current = player;
    }

    playerRef.current.play();
    setPlaying(true);
  };

  return (
    <View style={styles.audioPreview}>
      <View style={styles.audioHeader}>
        <Ionicons name="play" size={13} color="#fff" />
        <Text style={styles.audioTitle}>{draft ? '선택한 녹음본' : '녹음본 플레이어'}</Text>
      </View>
      <Waveform samples={draft?.waveform} active={Boolean(draft)} />
      <View style={styles.playerBottomRow}>
        <Text style={styles.audioHint}>
          {draft
            ? `${draft.source === 'recorded' ? '직접 녹음' : '불러온 파일'} · ${new Date(draft.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
            : '아래 목록에서 녹음본을 고르면 여기에 올라와요.'}
        </Text>
        <Pressable style={[styles.playerPlayButton, !draft && styles.playerPlayButtonDisabled]} disabled={!draft} onPress={() => void togglePlayback()}>
          <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function RemoteAudioPlayer({
  audioId,
  activeAudioId,
  onActiveAudioChange,
  uri,
  title,
  subtitle,
  onRefresh,
  refreshing = false,
}: {
  audioId: string;
  activeAudioId: string | null;
  onActiveAudioChange: (id: string | null) => void;
  uri: string;
  title: string;
  subtitle: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        releaseAudioPlayer(playerRef.current);
        playerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (playerRef.current) {
      releaseAudioPlayer(playerRef.current);
      playerRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
  }, [uri]);

  useEffect(() => {
    if (activeAudioId !== audioId && playerRef.current && playing) {
      void stopAudioPlayer(playerRef.current);
      setPlaying(false);
    }
  }, [activeAudioId, audioId, playing]);

  const togglePlayback = async () => {
    if (loading) {
      return;
    }

    if (playerRef.current && playing) {
      await stopAudioPlayer(playerRef.current);
      setPlaying(false);
      onActiveAudioChange(null);
      return;
    }

    setLoading(true);
    try {
      if (!playerRef.current) {
        const audioUri = toApiAssetUrl(uri) ?? uri;
        const player = await withTimeout<AudioPlayer>(
          createReadyAudioPlayer(audioUri),
          AUDIO_LOAD_TIMEOUT_MS,
          '녹음본을 불러오지 못했어요. 서버 주소나 네트워크를 확인해 주세요.',
        );
        player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlaying(false);
            void player.seekTo(0).catch(() => undefined);
          }
        });
        playerRef.current = player;
      }
      onActiveAudioChange(audioId);
      playerRef.current.play();
      setPlaying(true);
    } catch (error) {
      Alert.alert('재생 실패', error instanceof Error ? error.message : '녹음본을 재생하지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.remotePlayer}>
      <View style={styles.remotePlayerIcon}>
        <Ionicons name="musical-notes" size={18} color="#fff" />
      </View>
      <View style={styles.submissionBody}>
        <Text style={styles.remotePlayerTitle}>{title}</Text>
        <Text style={styles.remotePlayerMeta}>{subtitle}</Text>
      </View>
      <Pressable style={styles.remotePlayerButton} onPress={() => void togglePlayback()} disabled={loading}>
        <Ionicons name={loading ? 'hourglass-outline' : playing ? 'stop' : 'play'} size={18} color="#fff" />
      </Pressable>
      {onRefresh ? (
        <Pressable style={styles.remotePlayerRefreshButton} onPress={onRefresh} disabled={refreshing || loading}>
          <Ionicons name={refreshing ? 'hourglass-outline' : 'refresh'} size={17} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

function SubmissionTilePlayer({
  audioId,
  activeAudioId,
  onActiveAudioChange,
  uri,
  title,
  positionLabel,
  dateLabel,
  ownerId,
  currentUserId,
  feedback,
  onFeedbackUpsert,
  onFeedbackDelete,
}: {
  audioId: string;
  activeAudioId: string | null;
  onActiveAudioChange: (id: string | null) => void;
  uri: string;
  title: string;
  positionLabel: string;
  dateLabel: string;
  ownerId: string;
  currentUserId: string;
  feedback: PracticeFeedbackDto[];
  onFeedbackUpsert: (feedback: PracticeFeedbackDto) => void;
  onFeedbackDelete: (feedbackId: string) => void;
}) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const canWrite = ownerId !== currentUserId;
  const unreadCount = ownerId === currentUserId
    ? feedback.filter((item) => !item.acknowledgedAt).length
    : 0;

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        releaseAudioPlayer(playerRef.current);
        playerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (playerRef.current) {
      releaseAudioPlayer(playerRef.current);
      playerRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
  }, [uri]);

  useEffect(() => {
    if (activeAudioId !== audioId && playerRef.current && playing) {
      void stopAudioPlayer(playerRef.current);
      setPlaying(false);
    }
  }, [activeAudioId, audioId, playing]);

  const togglePlayback = async () => {
    if (loading) {
      return;
    }

    if (playerRef.current && playing) {
      await stopAudioPlayer(playerRef.current);
      setPlaying(false);
      onActiveAudioChange(null);
      return;
    }

    setLoading(true);
    try {
      await ensurePlayer();
      onActiveAudioChange(audioId);
      playerRef.current!.play();
      setPlaying(true);
    } catch (error) {
      Alert.alert('재생 실패', error instanceof Error ? error.message : '녹음본을 재생하지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  const ensurePlayer = async () => {
    if (playerRef.current) {
      return playerRef.current;
    }
    const audioUri = toApiAssetUrl(uri) ?? uri;
    const player = await withTimeout<AudioPlayer>(
      createReadyAudioPlayer(audioUri),
      AUDIO_LOAD_TIMEOUT_MS,
      '녹음본을 불러오지 못했어요. 서버 주소와 네트워크를 확인해 주세요.',
    );
    player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        setPlaying(false);
        void player.seekTo(0).catch(() => undefined);
      }
    });
    playerRef.current = player;
    return player;
  };

  const openFeedbackList = () => {
    setSheetVisible(true);
  };

  return (
    <View style={[styles.submissionTile, playing && styles.submissionTileActive]}>
      <View style={styles.submissionTileMain}>
        <View style={styles.submissionTileIdentity}>
          <Text style={styles.submissionTileTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.submissionTilePosition} numberOfLines={1}>{positionLabel} · {dateLabel}</Text>
        </View>
        <Pressable
          accessibilityLabel={playing ? `${title} 녹음 정지` : `${title} 녹음 재생`}
          style={[styles.submissionTileIcon, playing && styles.submissionTileIconActive]}
          onPress={() => void togglePlayback()}
          disabled={loading}
        >
          <Ionicons name={loading ? 'hourglass-outline' : playing ? 'stop' : 'play'} size={19} color={playing ? '#fff' : theme.colors.primary} />
        </Pressable>
        <Pressable style={styles.feedbackCountButton} onPress={openFeedbackList}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.primaryDark} />
          <Text style={styles.feedbackCountText}>피드백 {feedback.length}</Text>
          {unreadCount > 0 ? <View style={styles.feedbackUnreadDot}><Text style={styles.feedbackUnreadText}>{unreadCount}</Text></View> : null}
        </Pressable>
      </View>
      <FeedbackSheet
        visible={sheetVisible}
        feedback={feedback}
        ownerId={ownerId}
        currentUserId={currentUserId}
        submissionId={audioId}
        canWrite={canWrite}
        onClose={() => setSheetVisible(false)}
        onFeedbackUpsert={onFeedbackUpsert}
        onFeedbackDelete={onFeedbackDelete}
      />
    </View>
  );
}

function FeedbackSheet({
  visible,
  feedback,
  ownerId,
  currentUserId,
  submissionId,
  canWrite,
  onClose,
  onFeedbackUpsert,
  onFeedbackDelete,
}: {
  visible: boolean;
  feedback: PracticeFeedbackDto[];
  ownerId: string;
  currentUserId: string;
  submissionId: string;
  canWrite: boolean;
  onClose: () => void;
  onFeedbackUpsert: (feedback: PracticeFeedbackDto) => void;
  onFeedbackDelete: (feedbackId: string) => void;
}) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingSaving, setEditingSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setContent('');
    }
  }, [visible]);

  const save = async () => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 120) {
      return;
    }
    setSaving(true);
    try {
      const saved = await api.post<PracticeFeedbackDto>(`/practice-submissions/${submissionId}/feedback`, { content: trimmed });
      onFeedbackUpsert(saved);
      setContent('');
    } catch (error) {
      Alert.alert('피드백 저장 실패', error instanceof Error ? error.message : '피드백을 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = async (item: PracticeFeedbackDto) => {
    try {
      onFeedbackUpsert(await api.post<PracticeFeedbackDto>(`/practice-feedback/${item.id}/acknowledge`));
    } catch (error) {
      Alert.alert('확인 처리 실패', error instanceof Error ? error.message : '피드백을 확인 처리하지 못했어요.');
    }
  };

  const saveEdit = async () => {
    const trimmed = editingContent.trim();
    if (!editingId || !trimmed || trimmed.length > 120) {
      return;
    }
    setEditingSaving(true);
    try {
      const updated = await api.patch<PracticeFeedbackDto>(`/practice-feedback/${editingId}`, { content: trimmed });
      onFeedbackUpsert(updated);
      setEditingId(null);
      setEditingContent('');
    } catch (error) {
      Alert.alert('피드백 수정 실패', error instanceof Error ? error.message : '피드백을 수정하지 못했어요.');
    } finally {
      setEditingSaving(false);
    }
  };

  const remove = (item: PracticeFeedbackDto) => {
    Alert.alert('피드백을 삭제할까요?', '삭제한 피드백은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/practice-feedback/${item.id}`);
            onFeedbackDelete(item.id);
          } catch (error) {
            Alert.alert('삭제 실패', error instanceof Error ? error.message : '피드백을 삭제하지 못했어요.');
          }
        },
      },
    ]);
  };

  const showComposer = canWrite;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.feedbackModalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.feedbackBackdrop} onPress={onClose} />
        <View style={styles.feedbackSheet}>
          <View style={styles.feedbackSheetHandle} />
          <View style={styles.feedbackSheetHeader}>
            <View>
              <Text style={styles.feedbackSheetTitle}>피드백</Text>
              <Text style={styles.feedbackSheetSubtitle}>{feedback.length}개의 피드백</Text>
            </View>
            <Pressable style={styles.feedbackCloseButton} onPress={onClose}>
              <Ionicons name="close" size={21} color={theme.colors.text} />
            </Pressable>
          </View>

          {showComposer ? (
            <View style={styles.feedbackComposer}>
              <View style={styles.feedbackComposerHeader}>
                <Text style={styles.feedbackTimestampBadge}>
                  피드백 남기기
                </Text>
                <Text style={styles.feedbackCharacterCount}>{content.length}/120</Text>
              </View>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="짧고 구체적으로 남겨주세요"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={120}
                style={styles.feedbackInput}
                returnKeyType="done"
                onSubmitEditing={() => void save()}
              />
              <View style={styles.feedbackComposerActions}>
                <Pressable
                  style={[styles.feedbackSaveButton, (!content.trim() || saving) && styles.feedbackSaveButtonDisabled]}
                  onPress={() => void save()}
                  disabled={!content.trim() || saving}
                >
                  <Text style={styles.feedbackSaveText}>{saving ? '저장 중' : '남기기'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <ScrollView style={styles.feedbackList} contentContainerStyle={styles.feedbackListContent} keyboardShouldPersistTaps="handled">
            {feedback.length === 0 ? (
              <View style={styles.feedbackEmpty}>
                <Ionicons name="chatbubble-outline" size={25} color={theme.colors.textMuted} />
                <Text style={styles.feedbackEmptyTitle}>아직 피드백이 없어요</Text>
                <Text style={styles.feedbackEmptyText}>아직 남겨진 피드백이 없어요.</Text>
              </View>
            ) : feedback.map((item) => {
              const isAuthor = item.authorId === currentUserId;
              const isOwner = ownerId === currentUserId;
              return (
                <View key={item.id} style={styles.feedbackItem}>
                  <View style={styles.feedbackAvatar}>
                    <Text style={styles.feedbackAvatarText}>{item.authorName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.feedbackItemBody}>
                    <View style={styles.feedbackItemHeader}>
                      <Text style={styles.feedbackAuthor}>{item.authorName}</Text>
                      {item.acknowledgedAt ? (
                        <View style={styles.feedbackAcknowledged}>
                          <Ionicons name="checkmark" size={12} color={theme.colors.success} />
                          <Text style={styles.feedbackAcknowledgedText}>확인</Text>
                        </View>
                      ) : null}
                    </View>
                    {editingId === item.id ? (
                      <View style={styles.feedbackInlineEditor}>
                        <TextInput
                          value={editingContent}
                          onChangeText={setEditingContent}
                          maxLength={120}
                          autoFocus
                          multiline
                          style={styles.feedbackInlineInput}
                        />
                        <View style={styles.feedbackInlineActions}>
                          <Pressable onPress={() => { setEditingId(null); setEditingContent(''); }}>
                            <Text style={styles.feedbackInlineCancel}>취소</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => void saveEdit()}
                            disabled={!editingContent.trim() || editingSaving}
                          >
                            <Text style={[styles.feedbackInlineSave, (!editingContent.trim() || editingSaving) && styles.feedbackInlineSaveDisabled]}>
                              {editingSaving ? '저장 중' : '완료'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.feedbackContent}>{item.content}</Text>
                    )}
                    <View style={styles.feedbackItemActions}>
                      {isOwner && !item.acknowledgedAt ? (
                        <Pressable onPress={() => void acknowledge(item)}><Text style={styles.feedbackActionText}>확인했어요</Text></Pressable>
                      ) : null}
                      {isAuthor ? (
                        <>
                          {editingId !== item.id ? (
                            <Pressable onPress={() => { setEditingId(item.id); setEditingContent(item.content); }}>
                              <Text style={styles.feedbackActionText}>수정</Text>
                            </Pressable>
                          ) : null}
                          <Pressable onPress={() => remove(item)}><Text style={[styles.feedbackActionText, styles.feedbackDeleteText]}>삭제</Text></Pressable>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActionRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={theme.colors.primaryDark} />
      <Text style={styles.actionText}>{label}</Text>
      <View style={styles.actionArrow}>
        <Ionicons name="arrow-forward" size={13} color="#fff" />
      </View>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AudioPreview({ title, emptyText }: { title: string; emptyText: string }) {
  return (
    <View style={styles.audioPreview}>
      <View style={styles.audioHeader}>
        <Ionicons name="play" size={13} color="#fff" />
        <Text style={styles.audioTitle}>{title}</Text>
      </View>
      <Waveform />
      <Text style={styles.audioHint}>{emptyText}</Text>
    </View>
  );
}

function createBandAudioPlayer(uri: string) {
  return createAudioPlayer({ uri }, AUDIO_PLAYER_OPTIONS);
}

async function createReadyAudioPlayer(uri: string) {
  const player = createBandAudioPlayer(uri);
  try {
    await waitForAudioPlayerReady(player);
    return player;
  } catch (error) {
    releaseAudioPlayer(player);
    throw error;
  }
}

function waitForAudioPlayerReady(player: AudioPlayer) {
  return new Promise<void>((resolve, reject) => {
    if (player.isLoaded || player.currentStatus?.isLoaded) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Audio file could not be loaded.'));
    }, AUDIO_LOAD_TIMEOUT_MS);

    const interval = setInterval(() => {
      const status = player.currentStatus;
      if (player.isLoaded || status?.isLoaded) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });
}

async function stopAudioPlayer(player: AudioPlayer) {
  player.pause();
  await player.seekTo(0).catch(() => undefined);
}

function releaseAudioPlayer(player: AudioPlayer) {
  try {
    player.pause();
  } catch {
    // Already released or unavailable.
  }
  try {
    player.remove();
  } catch {
    // Already released or unavailable.
  }
}

function getRecordingStatusSafely(recorder: AudioRecorder): RecorderState | null {
  try {
    return recorder.getStatus();
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function Waveform({ samples, active = false }: { samples?: number[]; active?: boolean }) {
  const bars = normalizeWaveform(samples);
  return (
    <View style={styles.waveform}>
      {bars.map((value, index) => (
        <View key={index} style={[styles.waveBar, active && styles.waveBarActive, { height: 7 + value * 25 }]} />
      ))}
    </View>
  );
}

function showRecordingReadyAlert() {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    Alert.alert(
      '녹음 안내',
      '이어폰을 꼭 착용해 주세요. 확인을 누르면 7초 뒤 녹음이 시작됩니다.',
      [{ text: '확인', onPress: () => settle(true) }],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}

function FakeTimeline({ startSec, endSec }: { startSec: number | null; endSec: number | null }) {
  const start = Math.max(4, Math.min(78, (startSec ?? 15) / 2));
  const width = Math.max(16, Math.min(58, ((endSec ?? 60) - (startSec ?? 15)) / 2));

  return (
    <View style={styles.timelineTrack}>
      <View style={[styles.timelineRange, { left: `${start}%`, width: `${width}%` }]} />
      <View style={[styles.timelineHandle, { left: `${start}%` }]} />
      <View style={[styles.timelineHandle, { left: `${Math.min(94, start + width)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  loadingTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  loadingText: {
    color: theme.colors.textMuted,
  },
  header: {
    minHeight: 172,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
  },
  headerImage: {
    borderRadius: 8,
  },
  closedResult: {
    gap: 12,
  },
  closedThumb: {
    minHeight: 220,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
  },
  closedThumbImage: {
    borderRadius: 8,
  },
  closedThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 12, 30, 0.48)',
  },
  closedThumbText: {
    gap: 5,
  },
  closedTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 31,
  },
  closedArtist: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '800',
  },
  closedSubmissionList: {
    gap: 10,
  },
  submissionSectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  closedSubmissionItem: {
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closedSubmissionThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20242c',
  },
  closedSubmissionImage: {
    borderRadius: 8,
  },
  closedSubmissionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 12, 30, 0.44)',
  },
  closedSubmissionBody: {
    flex: 1,
    gap: 3,
  },
  closedSubmissionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  closedSubmissionMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 12, 30, 0.54)',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    fontWeight: '700',
  },
  headerMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.danger,
  },
  stepperCard: {
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.colors.primarySoft,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepDotActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  stepDotDone: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  stepLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  stepLabelActive: {
    color: theme.colors.primaryDark,
  },
  stepLine: {
    position: 'absolute',
    top: 14,
    left: '50%',
    right: '-50%',
    height: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
  },
  stepLineDone: {
    backgroundColor: theme.colors.primary,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  mainPanel: {
    gap: 16,
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  description: {
    color: theme.colors.textMuted,
    lineHeight: 20,
    fontWeight: '600',
  },
  rangeHighlight: {
    minHeight: 124,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 17,
    justifyContent: 'center',
    gap: 12,
  },
  rangeHighlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeHighlightIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeHighlightLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  rangeHighlightValue: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  memoBlock: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 4,
    paddingTop: 15,
    gap: 9,
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  memoLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  memoText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  memoTextEmpty: {
    color: theme.colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceMuted,
  },
  infoLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  infoValue: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  actionRow: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 11,
  },
  actionRowPressed: {
    backgroundColor: '#e5e0ff',
  },
  actionText: {
    flex: 1,
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  actionArrow: {
    width: 30,
    height: 24,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeBox: {
    borderRadius: 8,
    backgroundColor: '#151224',
    overflow: 'hidden',
    minHeight: 178,
  },
  playerFallback: {
    height: 178,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.surfaceMuted,
  },
  segmentCard: {
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12,
    gap: 8,
  },
  segmentTitle: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  timelineTrack: {
    height: 18,
    borderRadius: 999,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  timelineRange: {
    position: 'absolute',
    top: 7,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  timelineHandle: {
    position: 'absolute',
    top: 4,
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  audioPreview: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioTitle: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  audioHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  waveform: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
  },
  waveBarActive: {
    backgroundColor: theme.colors.primary,
  },
  countdown: {
    color: theme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  recorderCard: {
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
    gap: 12,
  },
  recorderTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recorderStatus: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  recordButton: {
    width: 86,
    height: 86,
    borderRadius: 999,
    borderWidth: 5,
    borderColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f7',
  },
  recordButtonStop: {
    borderColor: theme.colors.primaryDark,
    backgroundColor: theme.colors.surfaceMuted,
  },
  recordButtonCountingDown: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.danger,
  },
  recordButtonDisabled: {
    opacity: 0.78,
  },
  recordButtonCore: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: theme.colors.danger,
  },
  recordButtonCoreStop: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryDark,
  },
  recordCountdownText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
  },
  recorderHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  cancelPill: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  cancelPillText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryAction: {
    backgroundColor: theme.colors.primaryDark,
  },
  subtleEndButton: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subtleEndButtonDisabled: {
    opacity: 0.45,
  },
  subtleEndButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  draftList: {
    gap: 9,
  },
  draftItem: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  draftItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  selectBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBadgeSelected: {
    backgroundColor: theme.colors.primaryDark,
  },
  draftBody: {
    flex: 1,
  },
  draftTitle: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  draftTitleSelected: {
    color: '#fff',
  },
  draftMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  draftMetaSelected: {
    color: 'rgba(255,255,255,0.82)',
  },
  smallIconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerPlayButtonDisabled: {
    opacity: 0.45,
  },
  submissionMain: {
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mixButton: {
    borderRadius: 8,
    backgroundColor: theme.colors.primaryDark,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  remotePlayer: {
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryDark,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  remotePlayerIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remotePlayerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  remotePlayerMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  remotePlayerButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remotePlayerRefreshButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submissionTile: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 11,
    gap: 8,
  },
  submissionTileActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  ...StyleSheet.create({
  submissionTileMain: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  submissionTileIdentity: {
    width: '100%',
    minWidth: 0,
    gap: 2,
  },
  submissionTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submissionTileIconActive: {
    backgroundColor: theme.colors.primary,
  },
  submissionTileTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
  },
  submissionTilePosition: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  submissionTileMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 13,
  },
  feedbackCountButton: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  feedbackCountText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackUnreadDot: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  feedbackUnreadText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  feedbackAtTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 7,
  },
  feedbackAtTimeText: {
    color: theme.colors.primaryDark,
    fontSize: 9,
    fontWeight: '700',
  },
  feedbackModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  feedbackBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 12, 30, 0.45)',
  },
  feedbackSheet: {
    maxHeight: '78%',
    minHeight: 360,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 14,
  },
  feedbackSheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  feedbackSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  feedbackSheetTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  feedbackSheetSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  feedbackCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackComposer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 11,
    gap: 9,
  },
  feedbackComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackTimestampBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  feedbackCharacterCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
  feedbackInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  feedbackComposerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 7,
  },
  feedbackCancelEdit: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  feedbackCancelEditText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackSaveButton: {
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  feedbackSaveButtonDisabled: {
    opacity: 0.45,
  },
  feedbackSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackList: {
    flexGrow: 0,
  },
  feedbackListContent: {
    paddingBottom: 12,
  },
  feedbackEmpty: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  feedbackEmptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  feedbackEmptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
  feedbackItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 11,
    gap: 8,
  },
  feedbackItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  feedbackTimestampButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  feedbackTimestampText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackAuthor: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackAcknowledged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  feedbackAcknowledgedText: {
    color: theme.colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackContent: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  feedbackItemActions: {
    minHeight: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  feedbackActionText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackDeleteText: {
    color: theme.colors.danger,
  },
  }),
  submissionTileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  submissionTileIdentity: {
    flex: 1,
    gap: 3,
  },
  feedbackCountButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 9,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  feedbackCountText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackUnreadDot: {
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackUnreadText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  feedbackAtTimeButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  feedbackAtTimeText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  feedbackBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  feedbackSheet: {
    height: '82%',
    minHeight: 360,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 92 : 82,
  },
  feedbackSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  feedbackSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  feedbackSheetTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  feedbackSheetSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  feedbackCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackComposer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  feedbackComposerHeader: {
    display: 'none',
  },
  feedbackTimestampBadge: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackCharacterCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '400',
  },
  feedbackComposerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackSaveButton: {
    minWidth: 54,
    minHeight: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  feedbackSaveButtonDisabled: {
    opacity: 0.45,
  },
  feedbackSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackCancelEdit: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  feedbackCancelEditText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackList: {
    flex: 1,
  },
  feedbackListContent: {
    gap: 9,
    paddingBottom: 8,
  },
  feedbackEmpty: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  feedbackEmptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  feedbackEmptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  feedbackItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  feedbackAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackAvatarText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackItemBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  feedbackItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedbackTimestampButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    height: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackTimestampText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackAuthor: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackAcknowledged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  feedbackAcknowledgedText: {
    color: theme.colors.success,
    fontSize: 13,
    fontWeight: '900',
  },
  feedbackContent: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
  },
  feedbackInlineEditor: {
    gap: 6,
  },
  feedbackInlineInput: {
    minHeight: 42,
    maxHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '400',
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  feedbackInlineActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
  },
  feedbackInlineCancel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackInlineSave: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  feedbackInlineSaveDisabled: {
    opacity: 0.4,
  },
  feedbackItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 2,
  },
  feedbackActionText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackDeleteText: {
    color: theme.colors.danger,
  },
  submissionBody: {
    flex: 1,
  },
  submissionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  submissionMeta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '700',
  },
  submissionItem: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submissionItemText: {
    color: theme.colors.text,
    fontWeight: '800',
  },
});
