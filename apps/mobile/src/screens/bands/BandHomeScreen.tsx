import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BandHomeDto, TodoItemDto, VoteSummaryDto, VoteStepStatus } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'BandHome'>;

export function BandHomeScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const { setCurrentBand } = useCurrentBand();
  const [detail, setDetail] = useState<BandHomeDto | null>(null);
  const [startingVote, setStartingVote] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [deadlineOffsetDays, setDeadlineOffsetDays] = useState<1 | 3 | 7>(3);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const result = await api.get<BandHomeDto>(`/bands/${bandId}`);
      const thumbnailUrl = toApiAssetUrl(result.thumbnailUrl);
      setCurrentBand({
        id: result.id,
        name: result.name,
        thumbnailUrl,
        inviteCode: result.inviteCode,
        myRole: result.myMembership?.role ?? 'member',
        myPosition: result.myMembership?.positionLabel ?? '',
        memberCount: 0,
      });
      setDetail({
        ...result,
        thumbnailUrl,
        myMembership: result.myMembership ?? {
          role: 'member',
          positionLabel: '',
          volumePoints: 0,
        },
        todos: Array.isArray(result.todos) ? result.todos : [],
        voteSummary: result.voteSummary ?? { song: 'none', schedule: 'none', studio: 'none' },
        songCards: Array.isArray(result.songCards) ? result.songCards : [],
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '밴드 정보를 불러오지 못했어요.');
    }
  }, [bandId, setCurrentBand]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const deadlineLabel = useMemo(() => {
    if (deadlineOffsetDays === 1) {
      return '내일까지';
    }
    if (deadlineOffsetDays === 7) {
      return '일주일 뒤까지';
    }
    return '3일 뒤까지';
  }, [deadlineOffsetDays]);

  if (!detail) {
    return (
      <Screen>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>{loadError ? '불러오기 실패' : '불러오는 중'}</Text>
          <Text style={styles.loadingBody}>{loadError ?? '밴드 정보를 불러오고 있어요.'}</Text>
          {loadError ? (
            <Pressable style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          ) : null}
        </View>
      </Screen>
    );
  }

  const todos = Array.isArray(detail.todos) ? detail.todos : [];
  const hasActiveSongVote = detail.activeSongRound?.status === 'voting';
  const primaryTodo = todos[0] ?? null;
  const secondaryTodos = todos.slice(1);
  const pickingCards = detail.songCards.filter((card) => card.kind === 'picking');
  const songCards = detail.songCards.filter((card) => card.kind === 'song');

  const startSongVote = async () => {
    setStartingVote(true);
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + deadlineOffsetDays);
      deadline.setHours(23, 59, 0, 0);

      await api.post(`/bands/${bandId}/song-round/start`, {
        deadlineAt: deadline.toISOString(),
      });
      setDeadlineModalOpen(false);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : '합주곡 투표를 시작하지 못했어요.';
      setLoadError(message);
    } finally {
      setStartingVote(false);
    }
  };

  const openSongCard = (card: BandHomeDto['songCards'][number]) => {
    if (card.kind === 'picking') {
      navigation.navigate('SongRound', { bandId });
      return;
    }

    if (card.practiceAssignmentId) {
      navigation.navigate('PracticeAssignmentDetail', {
        bandId,
        assignmentId: card.practiceAssignmentId,
      });
      return;
    }

    navigation.navigate('PracticeAssignments', { bandId });
  };

  const openTodo = (todo: TodoItemDto) => {
    if (todo.shortcut === 'song_round') {
      navigation.navigate('SongRound', { bandId });
      return;
    }
    if (todo.shortcut === 'schedule') {
      navigation.navigate('Schedule', { bandId });
      return;
    }
    if (todo.shortcut === 'studio') {
      navigation.navigate('Studios', { bandId });
      return;
    }
    navigation.navigate('PracticeAssignments', { bandId });
  };

  const deleteSongCard = (card: BandHomeDto['songCards'][number]) => {
    const isPicking = card.kind === 'picking';
    const title = isPicking ? '곡 투표 삭제하기' : '노래 삭제하기';
    const message = isPicking
      ? '진행 중인 곡 투표를 취소하고 홈에서 없앨까요?'
      : `${card.title}을(를) 노래 목록에서 삭제할까요?${card.practiceAssignmentId ? '\n연습중인 곡 연결도 함께 목록에서 사라져요.' : ''}`;

    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isPicking) {
              await api.delete(`/bands/${bandId}/song-round`);
            } else {
              await api.delete(`/bands/${bandId}/song-candidates/${card.id}`);
            }
            await load();
          } catch (error) {
            Alert.alert('삭제 실패', error instanceof Error ? error.message : '노래 항목을 삭제하지 못했어요.');
          }
        },
      },
    ]);
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="home" navigation={navigation} />}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryText}>
            <Text style={styles.bandName} numberOfLines={1}>{detail.name}</Text>
            <Text style={styles.bandMeta} numberOfLines={1}>
              {detail.myMembership.positionLabel || '파트 미정'} · {detail.myMembership.role === 'leader' ? '리더' : '멤버'}
            </Text>
          </View>
          <StatusBadge label={todos.length > 0 ? `${todos.length}개 필요` : '정리됨'} tone={todos.length > 0 ? 'warning' : 'success'} />
        </View>
        <View style={styles.summaryStats}>
          <SummaryStat label="연습 과제" value={detail.openPracticeCount} />
          <SummaryStat label="등록 일정" value={detail.openScheduleSlotCount} />
          <SummaryStat label="초대코드" value={detail.inviteCode} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>지금 할 일</Text>
        {primaryTodo ? (
          <PrimaryTodoCard todo={primaryTodo} onPress={() => openTodo(primaryTodo)} />
        ) : (
          <EmptyState title="지금은 할 일이 없어요" description="투표나 연습 과제가 생기면 여기에서 바로 확인할 수 있어요." />
        )}
        {secondaryTodos.length > 0 ? (
          <View style={styles.compactTodoList}>
            {secondaryTodos.map((todo) => (
              <CompactTodoItem key={todo.type} todo={todo} onPress={() => openTodo(todo)} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>진행 상황</Text>
        <VoteTimeline
          summary={detail.voteSummary}
          onPress={(target) => {
            if (target === 'song') {
              navigation.navigate('SongRound', { bandId });
              return;
            }
            if (target === 'schedule') {
              navigation.navigate('Schedule', { bandId });
              return;
            }
            navigation.navigate('Studios', { bandId });
          }}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>곡과 연습</Text>
          <Pressable
            style={[styles.startVoteButton, (startingVote || hasActiveSongVote) && styles.startVoteButtonDisabled]}
            onPress={() => setDeadlineModalOpen(true)}
            disabled={startingVote || hasActiveSongVote}
          >
            <Text style={styles.startVoteText}>{hasActiveSongVote ? '투표 진행 중' : startingVote ? '시작 중...' : '투표 시작'}</Text>
          </Pressable>
        </View>

        {pickingCards.length > 0 ? (
          <View style={styles.listGroup}>
            <Text style={styles.groupLabel}>진행 중인 투표</Text>
            {pickingCards.map((card) => (
              <SongListItem key={card.id} card={card} onPress={() => openSongCard(card)} onLongPress={() => deleteSongCard(card)} />
            ))}
          </View>
        ) : null}

        {songCards.length > 0 ? (
          <View style={styles.listGroup}>
            <Text style={styles.groupLabel}>곡 / 연습</Text>
            {songCards.map((card) => (
              <SongListItem key={card.id} card={card} onPress={() => openSongCard(card)} onLongPress={() => deleteSongCard(card)} />
            ))}
          </View>
        ) : null}

        {detail.songCards.length === 0 ? (
          <EmptyState title="아직 곡이 없어요" description="투표를 시작하면 후보곡과 연습 흐름이 여기에 정리돼요." />
        ) : null}
      </View>

      <Modal visible={deadlineModalOpen} transparent animationType="fade" onRequestClose={() => setDeadlineModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>합주곡 투표 시작</Text>
            <Text style={styles.modalBody}>투표 마감일을 먼저 정해 주세요. 시작하면 멤버들이 후보곡을 올리고 바로 투표할 수 있어요.</Text>
            <View style={styles.deadlineOptions}>
              {([
                { label: '내일', value: 1 },
                { label: '3일 뒤', value: 3 },
                { label: '7일 뒤', value: 7 },
              ] as const).map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.deadlineChip, deadlineOffsetDays === option.value && styles.deadlineChipActive]}
                  onPress={() => setDeadlineOffsetDays(option.value)}
                >
                  <Text style={[styles.deadlineChipText, deadlineOffsetDays === option.value && styles.deadlineChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.deadlineSummary}>선택됨: {deadlineLabel}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setDeadlineModalOpen(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={() => void startSongVote()}>
                <Text style={styles.modalConfirmText}>시작하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatLabel}>{label}</Text>
      <Text style={styles.summaryStatValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function PrimaryTodoCard({ todo, onPress }: { todo: TodoItemDto; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryTodoCard} onPress={onPress}>
      <View style={styles.todoTop}>
        <Text style={styles.todoTitle}>{todo.title}</Text>
        <StatusBadge label={todo.dueLabel ?? '바로가기'} tone="warning" />
      </View>
      <Text style={styles.todoDescription}>{todo.description}</Text>
      <Text style={styles.todoAction}>바로가기</Text>
    </Pressable>
  );
}

function CompactTodoItem({ todo, onPress }: { todo: TodoItemDto; onPress: () => void }) {
  return (
    <Pressable style={styles.compactTodoItem} onPress={onPress}>
      <View style={styles.compactTodoText}>
        <Text style={styles.compactTodoTitle} numberOfLines={1}>{todo.title}</Text>
        <Text style={styles.compactTodoDescription} numberOfLines={1}>{todo.description}</Text>
      </View>
      <Text style={styles.compactTodoAction}>열기</Text>
    </Pressable>
  );
}

function SongListItem({
  card,
  onPress,
  onLongPress,
}: {
  card: BandHomeDto['songCards'][number];
  onPress: () => void;
  onLongPress: () => void;
}) {
  const isPicking = card.kind === 'picking';
  return (
    <Pressable style={styles.songListItem} onPress={onPress} onLongPress={onLongPress} delayLongPress={450}>
      <ImageBackground source={{ uri: card.thumbnailUrl ?? undefined }} imageStyle={styles.songCoverImage} style={styles.songCover}>
        <View style={styles.songCoverOverlay} />
        <Text style={styles.songCoverText}>{isPicking ? '투표' : card.title.slice(0, 2)}</Text>
      </ImageBackground>
      <View style={styles.songListBody}>
        <View style={styles.songListTop}>
          <Text style={styles.songTitle} numberOfLines={1}>{card.title}</Text>
          <StatusBadge label={isPicking ? '투표 중' : card.practiceAssignmentId ? '연습' : '곡'} tone={isPicking ? 'warning' : 'default'} />
        </View>
        <Text style={styles.songArtist} numberOfLines={1}>{card.artist}</Text>
        <Text style={styles.songHint} numberOfLines={1}>
          {card.practiceDueAt ? formatDueLabel(card.practiceDueAt) : isPicking ? '눌러서 투표 화면으로 이동' : '길게 누르면 삭제'}
        </Text>
      </View>
    </Pressable>
  );
}

function VoteTimeline({
  summary,
  onPress,
}: {
  summary: VoteSummaryDto;
  onPress: (target: 'song' | 'schedule' | 'studio') => void;
}) {
  const steps: Array<{ key: 'song' | 'schedule' | 'studio'; label: string; status: VoteStepStatus }> = [
    { key: 'song', label: '노래 투표', status: summary.song },
    { key: 'schedule', label: '합주 시간 투표', status: summary.schedule },
    { key: 'studio', label: '합주실 투표', status: summary.studio },
  ];

  return (
    <View style={styles.voteTimelineCard}>
      <Text style={styles.voteTimelineTitle}>투표 진행</Text>
      <View style={styles.voteSteps}>
        {steps.map((step, index) => {
          const done = step.status === 'done';
          const needed = step.status === 'needed';
          return (
            <React.Fragment key={step.key}>
              <Pressable style={styles.voteStep} onPress={() => onPress(step.key)}>
                <View style={[styles.voteStepDot, done && styles.voteStepDone, needed && styles.voteStepNeeded]}>
                  {done ? (
                    <Ionicons name="checkmark" size={15} color="#fff" />
                  ) : (
                    <Text style={[styles.voteStepNumber, needed && styles.voteStepNumberNeeded]}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.voteStepLabel, needed && styles.voteStepLabelNeeded]} numberOfLines={2}>{step.label}</Text>
                <Text style={styles.voteStepStatus}>{statusLabel(step.status)}</Text>
              </Pressable>
              {index < steps.length - 1 ? <View style={[styles.voteStepLine, done && styles.voteStepLineDone]} /> : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

function statusLabel(status: VoteStepStatus) {
  if (status === 'done') {
    return '완료';
  }
  if (status === 'needed') {
    return '필요';
  }
  return '대기';
}

function formatDueLabel(value: string) {
  return `마감 ${new Date(value).toLocaleDateString('ko-KR')}`;
}

const styles = StyleSheet.create({
  loadingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  loadingTitle: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 18,
  },
  loadingBody: {
    color: theme.colors.textMuted,
  },
  retryButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  section: {
    gap: 10,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryText: {
    flex: 1,
    gap: 4,
  },
  bandName: {
    color: theme.colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  bandMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryStat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
  summaryStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  summaryStatValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  primaryTodoCard: {
    borderRadius: theme.radius.md,
    padding: 16,
    gap: 9,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#f8f8ff',
  },
  compactTodoList: {
    gap: 10,
  },
  compactTodoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  compactTodoText: {
    flex: 1,
    gap: 2,
  },
  compactTodoTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  compactTodoDescription: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  compactTodoAction: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  voteTimelineCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  voteTimelineTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  voteSteps: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  voteStep: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  voteStepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteStepDone: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  voteStepNeeded: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  voteStepNumber: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  voteStepNumberNeeded: {
    color: '#fff',
  },
  voteStepLabel: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
    minHeight: 30,
    textAlign: 'center',
    lineHeight: 15,
  },
  voteStepLabelNeeded: {
    color: theme.colors.text,
  },
  voteStepStatus: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  voteStepLine: {
    width: 22,
    height: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    marginTop: 14,
  },
  voteStepLineDone: {
    backgroundColor: theme.colors.success,
  },
  todoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  todoTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  todoDescription: {
    color: theme.colors.text,
    lineHeight: 19,
  },
  todoAction: {
    color: theme.colors.textMuted,
    fontWeight: '800',
    fontSize: 12,
  },
  startVoteButton: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  startVoteButtonDisabled: {
    opacity: 0.55,
  },
  startVoteText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  listGroup: {
    gap: 8,
  },
  groupLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  songListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 10,
  },
  songListBody: {
    flex: 1,
    gap: 4,
  },
  songListTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  songCover: {
    width: 70,
    height: 70,
    borderRadius: theme.radius.sm,
    backgroundColor: '#20242c',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  songCoverImage: {
    borderRadius: theme.radius.sm,
  },
  songCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 10, 30, 0.45)',
  },
  songCoverText: {
    color: '#fff',
    fontWeight: '800',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  songArtist: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  songHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 18, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalBody: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  deadlineOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  deadlineChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  deadlineChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  deadlineChipText: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  deadlineChipTextActive: {
    color: '#fff',
  },
  deadlineSummary: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  modalCancelText: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  modalConfirm: {
    flex: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '800',
  },
});
