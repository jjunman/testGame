import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BandHomeDto, TodoItemDto, VoteStepStatus } from '@band/shared-types';
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
  const [loadError, setLoadError] = useState<string | null>(null);

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
  const primaryTodo = todos[0] ?? null;
  const secondaryTodos = todos.slice(1);

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
        <Text style={styles.sectionTitle}>밴드 진행</Text>
        <BandFlowTimeline
          detail={detail}
          onPress={(target) => {
            if (target === 'song') {
              navigation.navigate('SongRound', { bandId });
              return;
            }
            if (target === 'practice') {
              navigation.navigate('SongRound', { bandId });
              return;
            }
            navigation.navigate('Studios', { bandId });
          }}
        />
      </View>
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
      <Text style={styles.priorityLabel}>{todoPriorityLabel(todo)}</Text>
      <View style={styles.todoTop}>
        <Text style={styles.todoTitle}>{todo.title}</Text>
        <StatusBadge label={todo.dueLabel ?? '바로가기'} tone="warning" />
      </View>
      <Text style={styles.todoDescription}>{todo.description}</Text>
      <Text style={styles.todoAction}>바로가기</Text>
    </Pressable>
  );
}

function todoPriorityLabel(todo: TodoItemDto) {
  if (todo.type === 'submit_practice') {
    return '중요';
  }
  if (todo.type === 'submit_schedule') {
    return '먼저 필요';
  }
  return '응답 필요';
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

function BandFlowTimeline({
  detail,
  onPress,
}: {
  detail: BandHomeDto;
  onPress: (target: 'song' | 'practice' | 'studio') => void;
}) {
  const hasConfirmedSong = detail.songCards.some((card) => card.kind === 'song');
  const practiceStatus: VoteStepStatus = detail.openPracticeCount > 0 ? 'needed' : hasConfirmedSong ? 'done' : 'none';
  const steps: Array<{ key: 'song' | 'practice' | 'studio'; label: string; status: VoteStepStatus; description: string }> = [
    {
      key: 'song',
      label: '곡 정하기',
      status: detail.voteSummary.song,
      description: detail.voteSummary.song === 'done' ? '합주곡 확정' : detail.voteSummary.song === 'needed' ? '투표 진행 중' : '대기 중',
    },
    {
      key: 'practice',
      label: '연습하기',
      status: practiceStatus,
      description: practiceStatus === 'done' ? '연습 정리됨' : practiceStatus === 'needed' ? '제출 필요' : '곡 확정 후 시작',
    },
    {
      key: 'studio',
      label: '합주실 잡기',
      status: detail.voteSummary.studio,
      description: detail.voteSummary.studio === 'done' ? '합주실 확정' : detail.voteSummary.studio === 'needed' ? '후보 투표 중' : '대기 중',
    },
  ];

  return (
    <View style={styles.voteTimelineCard}>
      <Text style={styles.voteTimelineTitle}>곡부터 합주실까지</Text>
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
                <Text style={styles.voteStepStatus} numberOfLines={2}>{step.description}</Text>
              </Pressable>
              {index < steps.length - 1 ? <View style={[styles.voteStepLine, done && styles.voteStepLineDone]} /> : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
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
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#ddd6ff',
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
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  primaryTodoCard: {
    borderRadius: theme.radius.md,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#fbfaff',
  },
  priorityLabel: {
    alignSelf: 'flex-start',
    color: theme.colors.primaryDark,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '900',
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
    backgroundColor: '#fbfaff',
    borderWidth: 1,
    borderColor: '#ddd6ff',
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
    backgroundColor: theme.colors.primary,
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
});
