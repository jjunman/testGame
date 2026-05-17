import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import type { AVPlaybackStatus } from 'expo-av/build/AV.types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import YoutubePlayer from 'react-native-youtube-iframe';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, PrimaryButton, StatusBadge } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'PracticeAssignmentDetail'>;

type PracticeDetailDto = {
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
    submittedAt: string;
  } | null;
  isClosed: boolean;
  pointStatus: {
    currentVolumePoints: number | null;
    applied: boolean;
    changeAmount: number;
    reason: string | null;
  };
  memberStatuses: Array<{
    userId: string;
    name: string;
    role: string;
    submitted: boolean;
    submittedAt: string | null;
    pointChange: number;
    currentVolumePoints: number | null;
  }>;
  mixAudioUrl: string | null;
  mixGeneratedAt: string | null;
};

type PracticeSubmissionDto = {
  id: string;
  userId: string;
  userName: string;
  audioUrl: string;
  submittedAt: string;
};

type DraftRecording = {
  id: string;
  uri: string;
  createdAt: string;
  source: 'recorded' | 'picked';
  durationSec?: number | null;
  waveform?: number[];
};

type PracticeMode = 'main' | 'practice' | 'submit' | 'submissions';

const MAX_DRAFTS = 5;
const RECORDING_COUNTDOWN_SECONDS = 5;
const AUDIO_LOAD_TIMEOUT_MS = 12000;

export function PracticeAssignmentDetailScreen({ route, navigation }: Props) {
  const { assignmentId, bandId } = route.params;
  const { currentBand } = useCurrentBand();
  const [detail, setDetail] = useState<PracticeDetailDto | null>(null);
  const [submissions, setSubmissions] = useState<PracticeSubmissionDto[]>([]);
  const [drafts, setDrafts] = useState<DraftRecording[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [mode, setMode] = useState<PracticeMode>('main');
  const [uploading, setUploading] = useState(false);
  const [generatingMix, setGeneratingMix] = useState(false);
  const [closingAssignment, setClosingAssignment] = useState(false);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const recordingRef = useRef<any>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingAutoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setDetail(await api.get<PracticeDetailDto>(`/practice-assignments/${assignmentId}`));
    try {
      setSubmissions(await api.get<PracticeSubmissionDto[]>(`/practice-assignments/${assignmentId}/submissions`));
    } catch {
      setSubmissions([]);
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
        void recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
      }
      if (meteringTimerRef.current) {
        clearInterval(meteringTimerRef.current);
      }
      if (recordingAutoStopTimerRef.current) {
        clearTimeout(recordingAutoStopTimerRef.current);
      }
    };
  }, []);

  const addDraft = async (uri: string, source: DraftRecording['source'], waveform?: number[], durationSec?: number | null) => {
    const nextDraft: DraftRecording = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri,
      createdAt: new Date().toISOString(),
      source,
      durationSec: durationSec ?? null,
      waveform: normalizeWaveform(waveform),
    };
    await persistDrafts([nextDraft, ...drafts].slice(0, MAX_DRAFTS));
  };

  const importAudioFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,
    });
    if (!picked.canceled) {
      const durationSec = await getAudioDurationSec(picked.assets[0].uri);
      if (!isLongEnoughForAssignment(durationSec, detail)) {
        Alert.alert('녹음 길이 부족', buildDurationMessage(detail, durationSec));
        return;
      }
      await addDraft(picked.assets[0].uri, 'picked', createFallbackWaveform(picked.assets[0].uri), durationSec);
      setMode('practice');
    }
  };

  const beginRecording = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const nextRecording = new Audio.Recording();
    await nextRecording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });
    await nextRecording.startAsync();
    recordingRef.current = nextRecording;
    waveformRef.current = [];
    meteringTimerRef.current = setInterval(() => {
      void nextRecording.getStatusAsync().then((status: { metering?: number }) => {
        if (typeof status.metering === 'number') {
          waveformRef.current.push(meteringToWaveHeight(status.metering));
        }
      }).catch(() => undefined);
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
    Alert.alert('녹음 안내', '이어폰을 꼭 착용해 주세요. 5초 뒤 녹음이 시작됩니다.');
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '녹음을 하려면 마이크 권한이 필요해요.');
      return;
    }

    setCountdown(RECORDING_COUNTDOWN_SECONDS);
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

    const status = await recordingRef.current.getStatusAsync().catch(() => null);
    const durationSec = typeof status?.durationMillis === 'number' ? status.durationMillis / 1000 : null;
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    const waveform = waveformRef.current;
    recordingRef.current = null;
    setRecording(false);

    if (!uri) {
      Alert.alert('저장 실패', '녹음 파일을 저장하지 못했어요.');
      return;
    }

    if (!isLongEnoughForAssignment(durationSec, detail)) {
      Alert.alert('녹음 길이 부족', buildDurationMessage(detail, durationSec));
      return;
    }

    await addDraft(uri, 'recorded', waveform, durationSec);
    setMode('practice');
  };

  const cancelRecording = async () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);

    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
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
    setRecording(false);
    Alert.alert('녹음 취소', '이번 녹음은 저장하지 않았어요.');
  };

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
            setMode('submissions');
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
        isClosed={detail.isClosed}
        onChange={setMode}
      />

      {mode === 'main' ? (
        <MainPanel
          detail={detail}
          closing={closingAssignment}
          onCloseNow={closeAssignmentNow}
          onPractice={() => setMode('practice')}
          onSubmissions={() => setMode('submissions')}
        />
      ) : null}

      {mode === 'practice' ? (
        <PracticePanel
          youtubeVideoId={youtubeVideoId}
          detail={detail}
          recording={recording}
          countdown={countdown}
          onStartRecording={() => void startRecording()}
          onStopRecording={() => void stopRecording()}
          onCancel={() => void cancelRecording()}
          onImport={() => void importAudioFile()}
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
          onImport={() => void importAudioFile()}
        />
      ) : null}

      {mode === 'submissions' ? (
        <SubmissionsPanel
          mySubmission={detail.mySubmission}
          submissions={submissions}
          memberStatuses={detail.memberStatuses}
          isLeader={isLeader}
          isClosed={detail.isClosed}
          onPlay={(uri) => void playAudioUri(uri)}
          mixAudioUrl={detail.mixAudioUrl}
          mixGeneratedAt={detail.mixGeneratedAt}
          generatingMix={generatingMix}
          onGenerateMix={() => void generateMix()}
        />
      ) : null}
    </Screen>
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
  isClosed,
  onChange,
}: {
  mode: PracticeMode;
  submitted: boolean;
  hasDrafts: boolean;
  isClosed: boolean;
  onChange: (mode: PracticeMode) => void;
}) {
  const steps: Array<{ mode: PracticeMode; label: string; icon: keyof typeof Ionicons.glyphMap; completed: boolean }> = [
    { mode: 'main', label: '과제', icon: 'document-text-outline', completed: true },
    { mode: 'practice', label: '연습', icon: 'musical-notes-outline', completed: hasDrafts || submitted },
    { mode: 'submit', label: '제출', icon: 'mic-outline', completed: submitted },
    { mode: 'submissions', label: '결과', icon: 'albums-outline', completed: isClosed },
  ];

  return (
    <View style={styles.stepperCard}>
      {steps.map((step, index) => {
        const active = mode === step.mode;
        return (
          <React.Fragment key={step.mode}>
            <Pressable style={styles.stepItem} onPress={() => onChange(step.mode)}>
              <View style={[styles.stepDot, step.completed && styles.stepDotDone, active && styles.stepDotActive]}>
                <Ionicons name={step.completed ? 'checkmark' : step.icon} size={14} color={active || step.completed ? '#fff' : theme.colors.primary} />
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step.label}</Text>
            </Pressable>
            {index < steps.length - 1 ? <View style={[styles.stepLine, step.completed && styles.stepLineDone]} /> : null}
          </React.Fragment>
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
  onSubmissions,
}: {
  detail: PracticeDetailDto;
  closing: boolean;
  onCloseNow: () => void;
  onPractice: () => void;
  onSubmissions: () => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>연습 메인</Text>
      <Text style={styles.description}>{detail.description ?? '리더가 정한 구간을 듣고 녹음본을 제출해 주세요.'}</Text>
      <InfoRow label="연습 구간" value={formatRange(detail.startSec, detail.endSec)} />
      <InfoRow label="제출 상태" value={detail.mySubmission ? '제출 완료' : '제출 필요'} />
      {detail.pointStatus.applied ? (
        <InfoRow label="볼륨 포인트" value={`${detail.pointStatus.changeAmount >= 0 ? '+' : ''}${detail.pointStatus.changeAmount}점`} />
      ) : null}
      <ActionRow icon="checkbox-outline" label="연습하러 가기" onPress={onPractice} />
      <ActionRow icon="play-circle-outline" label="녹음본 듣기" onPress={onSubmissions} />
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
  countdown,
  onStartRecording,
  onStopRecording,
  onCancel,
  onImport,
  onSubmit,
}: {
  youtubeVideoId: string | null;
  detail: PracticeDetailDto;
  recording: boolean;
  countdown: number | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancel: () => void;
  onImport: () => void;
  onSubmit: () => void;
}) {
  const playerRef = useRef<any>(null);
  const sourceStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sourcePlaying, setSourcePlaying] = useState(false);

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
    playerRef.current?.pauseVideo?.();
    playerRef.current?.getInternalPlayer?.()?.pauseVideo?.();
  };

  useEffect(() => {
    if (!recording && countdown === null) {
      stopSourcePlayback();
    }
  }, [countdown, recording]);

  const handleRecordPress = () => {
    if (recording) {
      stopSourcePlayback();
      onStopRecording();
      return;
    }

    if (youtubeVideoId) {
      clearSourceStartTimer();
      clearSourceStopTimer();
      const segmentStartSec = Math.max(0, detail.startSec ?? 0);
      const segmentEndSec = detail.endSec !== null && detail.endSec > segmentStartSec ? detail.endSec : null;
      const preRollSec = Math.min(RECORDING_COUNTDOWN_SECONDS, segmentStartSec);
      const sourceStartDelayMs = (RECORDING_COUNTDOWN_SECONDS - preRollSec) * 1000;
      const sourceStartSec = segmentStartSec - preRollSec;
      playerRef.current?.seekTo?.(sourceStartSec, true);

      if (sourceStartDelayMs === 0) {
        setSourcePlaying(true);
      } else {
        setSourcePlaying(false);
        sourceStartTimerRef.current = setTimeout(() => {
          sourceStartTimerRef.current = null;
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
    onStartRecording();
  };

  const handleCancelPress = () => {
    stopSourcePlayback();
    onCancel();
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>연습하기</Text>
      <View style={styles.youtubeBox}>
        {youtubeVideoId ? (
          <YoutubePlayer ref={playerRef} height={178} play={sourcePlaying} videoId={youtubeVideoId} />
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
      <PrimaryButton label="녹음 파일 불러오기" onPress={onImport} disabled={detail.isClosed} style={styles.secondaryAction} />
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
        : '누르면 원곡이 5초 전부터 재생되고, 카운트다운 뒤 녹음돼요.';

  return (
    <View style={styles.recorderCard}>
      <View style={styles.recorderTopRow}>
        <Text style={styles.recorderStatus}>{status}</Text>
        <Text style={styles.recorderTimer}>{preparing ? `00:0${countdown}` : recording ? 'REC' : '00:00'}</Text>
      </View>
      <Pressable
        onPress={onRecord}
        disabled={disabled || preparing}
        style={[
          styles.recordButton,
          recording && styles.recordButtonStop,
          (disabled || preparing) && styles.recordButtonDisabled,
        ]}
      >
        <View style={[styles.recordButtonCore, recording && styles.recordButtonCoreStop]} />
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
  onImport,
}: {
  drafts: DraftRecording[];
  selectedDraftId: string | null;
  uploading: boolean;
  onSelect: (id: string) => void;
  onSubmit: () => void;
  onImport: () => void;
}) {
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) ?? null;

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>제출 녹음본 선택</Text>
      <SelectedDraftPlayer
        draft={selectedDraft}
      />
      {drafts.length === 0 ? (
        <EmptyState title="임시 저장 녹음본이 없어요" description="녹음하거나 오디오 파일을 불러오면 최대 5개까지 보관돼요." />
      ) : (
        <View style={styles.draftList}>
          {drafts.map((draft, index) => {
            const selected = draft.id === selectedDraftId;
            return (
              <Pressable key={draft.id} style={[styles.draftItem, selected && styles.draftItemSelected]} onPress={() => onSelect(draft.id)}>
                <View style={[styles.selectBadge, selected && styles.selectBadgeSelected]}>
                  <Ionicons name={selected ? 'checkmark' : 'musical-note'} size={14} color={selected ? '#fff' : theme.colors.primary} />
                </View>
                <View style={styles.draftBody}>
                  <Text style={[styles.draftTitle, selected && styles.draftTitleSelected]}>take_{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={[styles.draftMeta, selected && styles.draftMetaSelected]}>
                    {draft.source === 'recorded' ? '직접 녹음' : '불러온 파일'} · {new Date(draft.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <PrimaryButton label="녹음 파일 추가하기" onPress={onImport} style={styles.secondaryAction} />
      <PrimaryButton label="제출하기" onPress={onSubmit} loading={uploading} disabled={!selectedDraftId} />
    </View>
  );
}

function SelectedDraftPlayer({ draft }: { draft: DraftRecording | null }) {
  const soundRef = useRef<Awaited<ReturnType<typeof Audio.Sound.createAsync>>['sound'] | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => undefined);
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setPlaying(false);
    if (soundRef.current) {
      void soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    }
  }, [draft?.uri]);

  const togglePlayback = async () => {
    if (!draft) {
      return;
    }

    if (soundRef.current && playing) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
      return;
    }

    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync({ uri: toApiAssetUrl(draft.uri) ?? draft.uri });
      sound.setOnPlaybackStatusUpdate((status: { isLoaded: boolean; didJustFinish?: boolean }) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false);
          void sound.setPositionAsync(0).catch(() => undefined);
        }
      });
      soundRef.current = sound;
    }

    await soundRef.current.playAsync();
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

function SubmissionsPanel({
  mySubmission,
  submissions,
  memberStatuses,
  isLeader,
  isClosed,
  onPlay,
  mixAudioUrl,
  mixGeneratedAt,
  generatingMix,
  onGenerateMix,
}: {
  mySubmission: PracticeDetailDto['mySubmission'];
  submissions: PracticeSubmissionDto[];
  memberStatuses: PracticeDetailDto['memberStatuses'];
  isLeader: boolean;
  isClosed: boolean;
  onPlay: (uri: string) => void;
  mixAudioUrl: string | null;
  mixGeneratedAt: string | null;
  generatingMix: boolean;
  onGenerateMix: () => void;
}) {
  if (!isClosed) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>결과 대기</Text>
        <EmptyState
          title="마감 후 열리는 창이에요"
          description="마감기한이 끝나면 멤버들의 제출본을 합친 믹스 녹음본을 여기에서 들을 수 있어요."
        />
        {mySubmission ? (
          <Pressable style={styles.submissionMain} onPress={() => onPlay(mySubmission.audioUrl)}>
            <Ionicons name="play" size={18} color="#fff" />
            <View style={styles.submissionBody}>
              <Text style={styles.submissionTitle}>내 제출본 확인</Text>
              <Text style={styles.submissionMeta}>{new Date(mySubmission.submittedAt).toLocaleString('ko-KR')}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>결과</Text>
      {submissions.length > 0 && !mixAudioUrl ? (
        <View style={styles.mixButton}>
          <Ionicons name={generatingMix ? 'hourglass-outline' : 'albums-outline'} size={18} color="#fff" />
          <View style={styles.submissionBody}>
            <Text style={styles.submissionTitle}>{generatingMix ? '믹스 생성 중' : '믹스 자동 생성 준비 중'}</Text>
            <Text style={styles.submissionMeta}>
              {`${submissions.length}개의 제출본을 하나의 결과 파일로 자동 생성해요`}
            </Text>
          </View>
        </View>
      ) : null}
      {mixAudioUrl ? (
        <>
          <RemoteAudioPlayer
            uri={mixAudioUrl}
            title="믹싱된 녹음본"
            subtitle={
              mixGeneratedAt
                ? `생성됨 ${new Date(mixGeneratedAt).toLocaleString('ko-KR')}`
                : '멤버 제출본을 합친 믹스'
            }
          />
          <PrimaryButton label="믹스 다시 생성하기" onPress={onGenerateMix} loading={generatingMix} style={styles.secondaryAction} />
        </>
      ) : null}
      {submissions.length === 0 ? (
        <EmptyState title="제출본이 없어요" description="마감 전 제출된 녹음본이 있어야 결과 믹스를 만들 수 있어요." />
      ) : null}
      {isLeader ? (
        <View style={styles.memberGrid}>
          {memberStatuses.map((member) => (
            <View key={member.userId} style={styles.memberCard}>
              <Text style={styles.memberName}>{member.name}</Text>
              <StatusBadge label={member.submitted ? '제출 완료' : '미제출'} tone={member.submitted ? 'success' : 'danger'} />
              <Text style={styles.memberPoint}>포인트 {member.pointChange >= 0 ? `+${member.pointChange}` : member.pointChange}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RemoteAudioPlayer({ uri, title, subtitle }: { uri: string; title: string; subtitle: string }) {
  const soundRef = useRef<Awaited<ReturnType<typeof Audio.Sound.createAsync>>['sound'] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => undefined);
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (soundRef.current) {
      void soundRef.current.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
  }, [uri]);

  const togglePlayback = async () => {
    if (loading) {
      return;
    }

    if (soundRef.current && playing) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      if (!soundRef.current) {
        const audioUri = toApiAssetUrl(uri) ?? uri;
        const { sound } = await withTimeout<Awaited<ReturnType<typeof Audio.Sound.createAsync>>>(
          Audio.Sound.createAsync({ uri: audioUri }),
          AUDIO_LOAD_TIMEOUT_MS,
          '녹음본을 불러오지 못했어요. 서버 주소나 네트워크를 확인해 주세요.',
        );
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlaying(false);
            void sound.setPositionAsync(0).catch(() => undefined);
          }
        });
        soundRef.current = sound;
      }
      await soundRef.current.playAsync();
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
        <Ionicons name={loading ? 'hourglass-outline' : playing ? 'pause' : 'play'} size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

function ActionRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <Ionicons name={icon} size={19} color={theme.colors.primary} />
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

async function playAudioUri(uri: string) {
  const { sound } = await Audio.Sound.createAsync({ uri: toApiAssetUrl(uri) ?? uri });
  await sound.playAsync();
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

function meteringToWaveHeight(metering: number) {
  const clamped = Math.max(-60, Math.min(0, metering));
  return Math.max(0.08, Math.min(1, (clamped + 60) / 60));
}

function normalizeWaveform(samples?: number[]) {
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

function createFallbackWaveform(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }
  return Array.from({ length: 32 }, (_, index) => {
    const value = Math.sin((index + 1) * (hash % 13 + 3)) * 0.5 + 0.5;
    return 0.18 + value * 0.72;
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

async function getAudioDurationSec(uri: string) {
  try {
    const { sound, status } = await Audio.Sound.createAsync({ uri }, {}, false);
    await sound.unloadAsync();
    return status.isLoaded && typeof status.durationMillis === 'number' ? status.durationMillis / 1000 : null;
  } catch {
    return null;
  }
}

function getRequiredRecordingSec(detail: PracticeDetailDto | null) {
  if (!detail || detail.startSec === null || detail.endSec === null || detail.endSec <= detail.startSec) {
    return null;
  }
  return detail.endSec - detail.startSec;
}

function isLongEnoughForAssignment(durationSec: number | null, detail: PracticeDetailDto | null) {
  const requiredSec = getRequiredRecordingSec(detail);
  if (requiredSec === null) {
    return true;
  }
  return durationSec !== null && durationSec + 0.75 >= requiredSec;
}

function buildDurationMessage(detail: PracticeDetailDto | null, durationSec: number | null) {
  const requiredSec = getRequiredRecordingSec(detail);
  if (requiredSec === null) {
    return '녹음 길이를 확인할 수 없습니다. 다시 녹음해 주세요.';
  }
  const actual = durationSec === null ? '확인 불가' : formatSeconds(Math.max(0, Math.floor(durationSec)));
  return `이 과제는 최소 ${formatSeconds(requiredSec)} 녹음해야 저장할 수 있어요. 현재 녹음 길이: ${actual}`;
}

function getYoutubeVideoId(url: string | null) {
  if (!url) {
    return null;
  }
  const match = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?&]+)/);
  return match?.[1] ?? null;
}

function getFallbackYoutubeVideoId(title?: string | null, artist?: string | null) {
  const key = `${title ?? ''} ${artist ?? ''}`.replace(/\s+/g, '').toLowerCase();
  if (key.includes('그대에게') || key.includes('신해철')) {
    return 'gJqCO8E63-s';
  }
  return null;
}

function formatRange(startSec: number | null, endSec: number | null) {
  if (startSec === null && endSec === null) {
    return '구간 미정';
  }
  return `${formatSeconds(startSec ?? 0)} - ${endSec === null ? '?' : formatSeconds(endSec)}`;
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getPracticeProgress(startSec: number | null, endSec: number | null) {
  if (startSec === null || endSec === null || endSec <= startSec) {
    return 20;
  }
  return Math.max(10, Math.min(100, Math.round(((endSec - startSec) / 180) * 100)));
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
    fontSize: 12,
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
    width: 48,
    alignItems: 'center',
    gap: 6,
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
    fontSize: 11,
    fontWeight: '800',
  },
  stepLabelActive: {
    color: theme.colors.primaryDark,
  },
  stepLine: {
    flex: 1,
    height: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    marginHorizontal: 2,
    marginBottom: 20,
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
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  actionRow: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  actionText: {
    flex: 1,
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  actionArrow: {
    width: 28,
    height: 18,
    borderRadius: 999,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '900',
  },
  audioHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
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
  recorderTimer: {
    color: theme.colors.danger,
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
  recordButtonDisabled: {
    opacity: 0.55,
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
  recorderHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
  memberGrid: {
    gap: 10,
  },
  memberCard: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
  },
  memberName: {
    color: theme.colors.text,
    fontWeight: '900',
  },
  memberPoint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
});
