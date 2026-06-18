import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BandHomeDto, PracticeAssignmentDto, TodoItemDto, VoteStepStatus } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, LoadingState } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
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
      const profileImageUrl = toApiAssetUrl(result.myMembership?.profileImageUrl);
      const myMembership = result.myMembership
        ? {
            ...result.myMembership,
            profileImageUrl,
          }
        : {
            role: 'member' as const,
            positionLabel: '',
            profileImageUrl: null,
          };

      setCurrentBand({
        id: result.id,
        name: result.name,
        thumbnailUrl,
        inviteCode: result.inviteCode,
        myRole: result.myMembership?.role ?? 'member',
        myPosition: result.myMembership?.positionLabel ?? '',
        memberCount: result.memberCount ?? 0,
        todoCount: Array.isArray(result.todos) ? result.todos.length : 0,
      });
      setDetail({
        ...result,
        thumbnailUrl,
        myMembership,
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

  useLayoutEffect(() => {
    const profileImageUrl = detail?.myMembership.profileImageUrl;
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityLabel="밴드 정보 보기"
          accessibilityRole="button"
          style={({ pressed }) => [styles.memberHeaderButton, pressed && styles.memberHeaderButtonPressed]}
          onPress={() => navigation.navigate('BandMembers', { bandId })}
        >
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={styles.memberHeaderImage} />
          ) : (
            <Ionicons name="people-outline" size={20} color={theme.colors.primaryDark} />
          )}
          <View style={styles.memberHeaderBadge}>
            <Ionicons name="chevron-forward" size={10} color="#fff" />
          </View>
        </Pressable>
      ),
    });
  }, [bandId, detail?.myMembership.profileImageUrl, navigation]);

  if (!detail) {
    return (
      <Screen>
        {loadError ? (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>불러오기 실패</Text>
            <Text style={styles.loadingBody}>{loadError}</Text>
            <Pressable style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const todos = Array.isArray(detail.todos) ? detail.todos : [];
  const primaryTodo = todos[0];
  const moreTodos = todos.slice(1, 5);
  const flowCards = buildFlowCards(detail);
  const completedCount = flowCards.filter((item) => item.status === 'done').length;
  const progressPercent = Math.round((completedCount / flowCards.length) * 100);

  const openTodo = async (todo: TodoItemDto) => {
    if (todo.type === 'submit_practice') {
      const assignmentId = todo.targetId ?? await findFirstPendingPracticeId(bandId);
      if (assignmentId) {
        navigation.navigate('PracticeAssignmentDetail', { bandId, assignmentId });
      }
      return;
    }
    if (todo.type === 'submit_schedule' || todo.shortcut === 'schedule') {
      navigation.navigate('Schedule', { bandId });
      return;
    }
    if (todo.shortcut === 'studio' || todo.type === 'vote_studio' || todo.type === 'start_studio') {
      navigation.navigate('Studios', { bandId });
      return;
    }
    if (todo.shortcut === 'song_round' || todo.type === 'vote_song' || todo.type === 'start_song_round') {
      navigation.navigate('SongRound', { bandId, initialTab: 'vote' });
      return;
    }
    navigation.navigate('BandHome', { bandId });
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="home" navigation={navigation} />}>
      <View style={styles.dashboardHero}>
        <Image source={{ uri: detail.thumbnailUrl || fallbackBandImage }} style={styles.bandImage} />
        <View style={styles.heroText}>
          <Text style={styles.kicker}>오늘의 밴드 준비</Text>
          <Text style={styles.bandName} numberOfLines={1}>{detail.name}</Text>
          <Text style={styles.memberMeta} numberOfLines={1}>
            {detail.myMembership.role === 'leader' ? '리더' : '멤버'} · {detail.myMembership.positionLabel || '파트 미정'} · 멤버 {detail.memberCount}명
          </Text>
        </View>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressLabel}>합주 준비 진행률</Text>
            <Text style={styles.progressTitle}>{completedCount}/{flowCards.length} 단계 완료</Text>
          </View>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘 할 일</Text>
          {todos.length > 0 ? <Text style={styles.sectionMeta}>{todos.length}개</Text> : null}
        </View>

        {primaryTodo ? (
          <View style={styles.todoStack}>
            <PrimaryTodoCard todo={primaryTodo} onPress={() => void openTodo(primaryTodo)} />
            {moreTodos.length > 0 ? (
              <View style={styles.compactTodoList}>
                {moreTodos.map((todo, index) => (
                  <CompactTodoItem key={`${todo.type}-${todo.targetId ?? index}`} todo={todo} onPress={() => void openTodo(todo)} />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState title="지금 처리할 일이 없어요" description="곡 투표, 일정 응답, 연습 제출이 생기면 여기에서 바로 확인할 수 있어요." />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>준비 흐름</Text>
          <Text style={styles.sectionMeta}>기능은 그대로, 상태만 빠르게</Text>
        </View>
        <View style={styles.flowGrid}>
          {flowCards.map((item) => (
            <FlowCard
              key={item.key}
              item={item}
              onPress={() => {
                if (item.key === 'song') {
                  navigation.navigate('SongRound', { bandId, initialTab: 'vote' });
                  return;
                }
                if (item.key === 'practice') {
                  navigation.navigate('SongRound', { bandId, initialTab: 'library' });
                  return;
                }
                if (item.key === 'schedule') {
                  navigation.navigate('Schedule', { bandId });
                  return;
                }
                navigation.navigate('Studios', { bandId });
              }}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function PrimaryTodoCard({ todo, onPress }: { todo: TodoItemDto; onPress: () => void }) {
  const iconName = todoIconName(todo);
  const deadlineLabel = todoDeadlineLabel(todo);

  return (
    <Pressable
      style={({ pressed }) => [styles.primaryTodoCard, pressed && styles.primaryTodoCardPressed]}
      onPress={onPress}
    >
      <View style={styles.todoTopRow}>
        <View style={styles.todoIcon}>
          <Ionicons name={iconName} size={22} color="#fff" />
        </View>
        {deadlineLabel ? <Text style={styles.todoDeadline}>{deadlineLabel}</Text> : null}
      </View>
      <Text style={styles.todoTitle} numberOfLines={2}>{todo.title}</Text>
      <Text style={styles.todoDescription} numberOfLines={2}>{todo.description}</Text>
      <View style={styles.todoAction}>
        <Text style={styles.todoActionText}>{todoActionLabel(todo)}</Text>
        <Ionicons name="arrow-forward" size={15} color="#fff" />
      </View>
    </Pressable>
  );
}

function CompactTodoItem({ todo, onPress }: { todo: TodoItemDto; onPress: () => void }) {
  const iconName = todoIconName(todo);

  return (
    <Pressable
      style={({ pressed }) => [styles.compactTodoItem, pressed && styles.compactTodoItemPressed]}
      onPress={onPress}
    >
      <View style={styles.compactTodoIcon}>
        <Ionicons name={iconName} size={17} color={theme.colors.primaryDark} />
      </View>
      <View style={styles.compactTodoText}>
        <Text style={styles.compactTodoTitle} numberOfLines={1}>{todo.title}</Text>
        <Text style={styles.compactTodoDescription} numberOfLines={1}>{todo.description}</Text>
      </View>
      <View style={styles.compactTodoGo}>
        <Text style={styles.compactTodoDeadline}>{todoDeadlineLabel(todo)}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

function FlowCard({
  item,
  onPress,
}: {
  item: ReturnType<typeof buildFlowCards>[number];
  onPress: () => void;
}) {
  const done = item.status === 'done';
  const needed = item.status === 'needed';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.flowCard,
        needed && styles.flowCardNeeded,
        done && styles.flowCardDone,
        pressed && styles.flowCardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.flowIcon, needed && styles.flowIconNeeded, done && styles.flowIconDone]}>
        <Ionicons name={done ? 'checkmark' : item.icon} size={18} color={needed || done ? '#fff' : theme.colors.textMuted} />
      </View>
      <Text style={styles.flowTitle} numberOfLines={1}>{item.label}</Text>
      <Text style={styles.flowDescription} numberOfLines={2}>{item.description}</Text>
    </Pressable>
  );
}

function todoDeadlineLabel(todo: TodoItemDto) {
  if (todo.dueAt) {
    const diff = new Date(todo.dueAt).getTime() - Date.now();
    const day = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    return `D-${day}`;
  }
  if (todo.dueLabel?.startsWith('D-')) {
    return todo.dueLabel;
  }
  if (todo.dueLabel === '오늘 마감') {
    return 'D-0';
  }
  if (todo.dueLabel === '내일 마감') {
    return 'D-1';
  }
  return todo.dueLabel ?? '';
}

function todoActionLabel(todo: TodoItemDto) {
  if (todo.type === 'submit_practice' || todo.shortcut === 'practice') {
    return '연습 제출하기';
  }
  if (todo.type === 'submit_schedule') {
    return '가능 시간 입력하기';
  }
  if (todo.type === 'vote_schedule_proposal' || todo.shortcut === 'schedule') {
    return '일정 응답하기';
  }
  if (todo.type === 'vote_studio' || todo.type === 'start_studio' || todo.shortcut === 'studio') {
    return '합주실 확인하기';
  }
  if (todo.type === 'vote_song' || todo.type === 'start_song_round' || todo.shortcut === 'song_round') {
    return '곡 투표하기';
  }
  return '처리하기';
}

function todoIconName(todo: TodoItemDto): keyof typeof Ionicons.glyphMap {
  if (todo.type === 'submit_practice' || todo.shortcut === 'practice') {
    return 'mic-outline';
  }
  if (todo.type === 'submit_schedule' || todo.type === 'vote_schedule_proposal' || todo.shortcut === 'schedule') {
    return 'calendar-outline';
  }
  if (todo.type === 'vote_studio' || todo.shortcut === 'studio') {
    return 'location-outline';
  }
  return 'musical-notes-outline';
}

async function findFirstPendingPracticeId(bandId: string) {
  const assignments = await api.get<PracticeAssignmentDto[]>(`/bands/${bandId}/practice-assignments`);
  const pending = assignments
    .filter((assignment) => assignment.status === 'open' && !assignment.hasSubmitted)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return pending[0]?.id ?? null;
}

function buildFlowCards(detail: BandHomeDto) {
  const hasConfirmedSong = detail.songCards.some((card) => card.kind === 'song');
  const practiceStatus: VoteStepStatus = detail.openPracticeCount > 0 ? 'needed' : hasConfirmedSong ? 'done' : 'none';

  return [
    {
      key: 'song' as const,
      label: '곡',
      status: detail.voteSummary.song,
      description: statusDescription(detail.voteSummary.song, '합주곡 확정', '곡 투표 필요', '곡 후보 준비'),
      icon: 'musical-notes-outline' as const,
    },
    {
      key: 'practice' as const,
      label: '연습',
      status: practiceStatus,
      description: practiceStatus === 'done' ? '제출 흐름 정리됨' : practiceStatus === 'needed' ? `${detail.openPracticeCount}개 제출 필요` : '곡 확정 후 시작',
      icon: 'mic-outline' as const,
    },
    {
      key: 'schedule' as const,
      label: '일정',
      status: detail.voteSummary.schedule,
      description: detail.voteSummary.schedule === 'done' ? '합주 시간 확정' : detail.openScheduleSlotCount > 0 ? '가능 시간 확인 중' : '가능 시간 입력 전',
      icon: 'calendar-outline' as const,
    },
    {
      key: 'studio' as const,
      label: '합주실',
      status: detail.voteSummary.studio,
      description: statusDescription(detail.voteSummary.studio, '합주실 확정', '후보 투표 필요', '후보 준비 중'),
      icon: 'location-outline' as const,
    },
  ];
}

function statusDescription(status: VoteStepStatus, done: string, needed: string, none: string) {
  if (status === 'done') {
    return done;
  }
  if (status === 'needed') {
    return needed;
  }
  return none;
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
  memberHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberHeaderButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  memberHeaderImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  memberHeaderBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  dashboardHero: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
  },
  bandImage: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.md,
    resizeMode: 'cover',
    backgroundColor: theme.colors.surfaceMuted,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  kicker: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  bandName: {
    color: theme.colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  memberMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  progressCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    padding: 15,
    gap: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 3,
  },
  progressPercent: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: '#fff',
  },
  section: {
    gap: 9,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  todoStack: {
    gap: 8,
  },
  primaryTodoCard: {
    minHeight: 162,
    borderRadius: theme.radius.md,
    padding: 15,
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
  },
  primaryTodoCardPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    transform: [{ scale: 0.985 }],
  },
  todoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  todoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoDeadline: {
    overflow: 'hidden',
    color: theme.colors.primaryDark,
    backgroundColor: theme.colors.primarySoft,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  todoTitle: {
    color: theme.colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  todoDescription: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  todoAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 2,
  },
  todoActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  compactTodoList: {
    gap: 7,
  },
  compactTodoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  compactTodoItemPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    transform: [{ scale: 0.99 }],
  },
  compactTodoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTodoText: {
    flex: 1,
    minWidth: 0,
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
  compactTodoGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactTodoDeadline: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 34,
    textAlign: 'right',
  },
  flowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flowCard: {
    width: '48.8%',
    minHeight: 104,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 7,
  },
  flowCardPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    transform: [{ scale: 0.985 }],
  },
  flowCardNeeded: {
    borderColor: theme.colors.primary,
  },
  flowCardDone: {
    borderColor: '#cfe9dc',
  },
  flowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowIconNeeded: {
    backgroundColor: theme.colors.primary,
  },
  flowIconDone: {
    backgroundColor: theme.colors.success,
  },
  flowTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  flowDescription: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
