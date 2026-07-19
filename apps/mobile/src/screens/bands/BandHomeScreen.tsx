import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BandHomeDto, PracticeAssignmentDto, ScheduleProposalDto, ScheduleSummaryDto, SettlementOverviewDto, TodoItemDto } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { getCurrentWeekDates, isScheduleHour, toMinute } from '../../components/ScheduleAvailability';
import { Screen } from '../../components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'BandHome'>;

export function BandHomeScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const { user } = useAuth();
  const { setCurrentBand } = useCurrentBand();
  const [detail, setDetail] = useState<BandHomeDto | null>(null);
  const [settlement, setSettlement] = useState<SettlementOverviewDto | null>(null);
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummaryDto[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduleProposalDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllTodos, setShowAllTodos] = useState(false);
  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [result, settlementResult, summaryResult, schedulesResult] = await Promise.all([
        api.get<BandHomeDto>(`/bands/${bandId}`),
        api.get<SettlementOverviewDto>(`/bands/${bandId}/settlement`).catch(() => null),
        api.get<ScheduleSummaryDto[]>(`/bands/${bandId}/schedule-summary`).catch(() => []),
        api.get<ScheduleProposalDto[]>(`/bands/${bandId}/schedule-events`).catch(() => []),
      ]);
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
      setSettlement(settlementResult);
      setScheduleSummary(summaryResult);
      setUpcomingSchedules(schedulesResult);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '밴드 정보를 불러오지 못했어요.');
    }
  }, [bandId, setCurrentBand]);

  const allAvailableSlotKeys = useMemo(() => {
    return new Set(
      scheduleSummary
        .filter((item) => item.allAvailable && weekDates.includes(item.date) && isScheduleHour(Math.floor(toMinute(item.startTime) / 60)))
        .map((item) => `${item.date}-${Math.floor(toMinute(item.startTime) / 60)}`),
    );
  }, [scheduleSummary, weekDates]);

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
          <ErrorState description={loadError} onRetry={() => void load()} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const todos = Array.isArray(detail.todos) ? detail.todos.filter((todo) => !isStudioTodo(todo)) : [];
  const primaryTodo = todos[0];
  const moreTodos = showAllTodos ? todos.slice(1) : todos.slice(1, 3);
  const hiddenTodoCount = Math.max(0, todos.length - 3);

  const openTodo = async (todo: TodoItemDto) => {
    if (todo.type === 'submit_practice') {
      const assignmentId = todo.targetId ?? await findFirstPendingPracticeId(bandId);
      if (assignmentId) {
        navigation.navigate('PracticeAssignmentDetail', { bandId, assignmentId });
      }
      return;
    }
    if (todo.type === 'submit_schedule' || todo.shortcut === 'schedule') {
      navigation.navigate('ScheduleEdit', { bandId });
      return;
    }
    if (todo.shortcut === 'song_round' || todo.type === 'vote_song' || todo.type === 'start_song_round') {
      navigation.navigate('SongVote', { bandId });
      return;
    }
    navigation.navigate('BandHome', { bandId });
  };

  return (
    <Screen
      contentContainerStyle={styles.homeContent}
      fixedFooter={<BandInnerNav bandId={bandId} active="home" navigation={navigation} />}
    >
      <View style={styles.dashboardHero}>
        <Image source={{ uri: detail.thumbnailUrl || fallbackBandImage }} style={styles.bandImage} />
        <View style={styles.heroText}>
          <Text style={styles.bandName} numberOfLines={2}>{detail.name}</Text>
          <Text style={styles.memberMeta} numberOfLines={1}>
            {detail.myMembership.role === 'leader' ? '리더' : '멤버'} · {detail.myMembership.positionLabel || '파트 미정'} · 멤버 {detail.memberCount}명
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>내 할 일</Text>
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
                {hiddenTodoCount > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAllTodos((current) => !current)}
                    style={({ pressed }) => [styles.moreTodoButton, pressed && styles.moreTodoButtonPressed]}
                  >
                    <Text style={styles.moreTodoText}>{showAllTodos ? '접기' : `할 일 ${hiddenTodoCount}개 더 보기`}</Text>
                    <Ionicons name={showAllTodos ? 'chevron-up' : 'chevron-down'} size={15} color={theme.colors.primaryDark} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState title="지금 할 일이 없어요" description="할 일이 생기면 여기에서 바로 확인할 수 있어요." />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>다음 합주</Text>
          <HeaderIconAction
            icon="add"
            label="다음 합주 등록"
            onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })}
          />
        </View>
        <NextRehearsalCard
          rehearsal={detail.nextRehearsal}
          studioName={detail.confirmedStudioName}
        />
        {getAdditionalSchedules(upcomingSchedules, detail.nextRehearsal).map((schedule) => (
          <View key={schedule.id} style={styles.additionalScheduleRow}>
            <Text style={styles.additionalScheduleDate}>{formatScheduleDate(schedule.date)}</Text>
            <Text style={styles.additionalScheduleTime}>{formatRehearsalTime(schedule.startTime)}~{formatRehearsalTime(schedule.endTime)}</Text>
          </View>
        ))}
        <View style={styles.scheduleSubHeader}>
          <Text style={styles.scheduleSubTitle}>우리의 가능 시간</Text>
          <HeaderIconAction
            icon="create-outline"
            label="수정"
            onPress={() => navigation.navigate('ScheduleEdit', { bandId })}
          />
        </View>
        <View style={styles.scheduleLegend}>
          <View style={styles.scheduleLegendItem}>
            <View style={[styles.scheduleLegendSwatch, styles.scheduleLegendAvailable]} />
            <Text style={styles.scheduleLegendText}>모든 멤버 가능</Text>
          </View>
        </View>
        <AvailabilityTable weekDates={weekDates} allAvailableSlotKeys={allAvailableSlotKeys} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 정산</Text>
        <MySettlementCard
          settlement={settlement}
          userId={user?.id ?? null}
          onPress={() => navigation.navigate('Settlement', { bandId })}
        />
      </View>
    </Screen>
  );
}

function MySettlementCard({
  settlement,
  userId,
  onPress,
}: {
  settlement: SettlementOverviewDto | null;
  userId: string | null;
  onPress: () => void;
}) {
  const amounts = getMySettlementAmounts(settlement, userId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="정산 바로가기"
      style={({ pressed }) => [styles.mySettlementCard, pressed && styles.mySettlementCardPressed]}
      onPress={onPress}
    >
      <View style={styles.mySettlementText}>
        <Text style={styles.mySettlementLabel}>내가 낼 금액</Text>
      </View>
      <View style={styles.mySettlementAction}>
        <View style={styles.mySettlementAmountGroup}>
          <Text style={styles.mySettlementAmount} numberOfLines={1}>{formatPrice(amounts.total)}</Text>
          <Text style={styles.mySettlementAmountGuide} numberOfLines={1}>{formatKoreanAmount(amounts.total)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

function getMySettlementAmounts(settlement: SettlementOverviewDto | null, userId: string | null) {
  if (!settlement || !userId) {
    return { current: 0, outstanding: 0, total: 0 };
  }
  const openRounds = [...settlement.activeRounds, ...settlement.outstandingRounds];
  const unpaidAmounts = openRounds.flatMap((round) => round.participants)
    .filter((participant) => participant.userId === userId && !participant.paid)
    .map((participant) => participant.amount);
  const total = unpaidAmounts.reduce((sum, amount) => sum + amount, 0);
  return { current: total, outstanding: 0, total };
}

function formatPrice(value: number) {
  return `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`;
}

function formatKoreanAmount(value: number) {
  const amount = Math.max(0, Math.floor(value));
  const man = Math.floor(amount / 10_000);
  const cheon = Math.floor((amount % 10_000) / 1_000);
  const won = amount % 1_000;
  const parts: string[] = [];

  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (cheon > 0) parts.push(`${cheon}천`);
  if (won > 0 || parts.length === 0) parts.push(won.toLocaleString('ko-KR'));

  return `${parts.join(' ')}원`;
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
        <Text style={styles.compactTodoTitle} numberOfLines={2}>{todo.title}</Text>
        <Text style={styles.compactTodoDescription} numberOfLines={2}>{todo.description}</Text>
      </View>
      <View style={styles.compactTodoGo}>
        <Text style={styles.compactTodoDeadline}>{todoDeadlineLabel(todo)}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

function NextRehearsalCard({
  rehearsal,
  studioName,
}: {
  rehearsal: BandHomeDto['nextRehearsal'];
  studioName: string | null;
}) {
  const display = getNextRehearsalDisplay(rehearsal);

  return (
    <View style={styles.nextRehearsalCard}>
      <View style={styles.nextRehearsalTop}>
        <View style={styles.nextRehearsalWhen}>
          <Text style={styles.nextRehearsalDate}>{display.date}</Text>
          <Text style={styles.nextRehearsalTime}>{display.time}</Text>
        </View>
        <Text style={styles.nextRehearsalDday}>{display.dDay}</Text>
      </View>
      <View style={styles.nextRehearsalDivider} />
      <View style={styles.nextRehearsalLocation}>
        <Text style={styles.nextRehearsalLocationLabel}>장소</Text>
        <Text style={styles.nextRehearsalLocationValue} numberOfLines={2}>{studioName ?? '아직 정해지지 않았어요'}</Text>
      </View>
    </View>
  );
}

function HeaderIconAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.headerIconAction} onPress={onPress}>
      <Ionicons name={icon} size={icon === 'add' ? 18 : 16} color={theme.colors.primaryDark} />
      <Text style={styles.headerIconActionText}>{label}</Text>
    </Pressable>
  );
}

function AvailabilityTable({ weekDates, allAvailableSlotKeys }: { weekDates: string[]; allAvailableSlotKeys: Set<string> }) {
  return (
    <View style={styles.scheduleTable}>
      <View style={styles.weekdayColumn}>
        <View style={styles.tableCorner} />
        {weekDates.map((date) => (
          <View key={date} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{weekdayLabel(date)}</Text>
          </View>
        ))}
      </View>
      <ScrollView style={styles.scheduleScroll} horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View style={styles.tableGrid}>
          <View style={styles.tableRow}>
            {SCHEDULE_HOURS.map((hour) => (
              <View key={hour} style={styles.hourCell}>
                <Text style={styles.hourText}>{String(hour).padStart(2, '0')}시</Text>
              </View>
            ))}
          </View>
          {weekDates.map((date) => (
            <View key={date} style={styles.tableRow}>
              {SCHEDULE_HOURS.map((hour) => (
                <View
                  key={`${date}-${hour}`}
                  style={[styles.scheduleCell, allAvailableSlotKeys.has(`${date}-${hour}`) && styles.scheduleCellAvailable]}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const SCHEDULE_HOURS = Array.from({ length: 15 }, (_, index) => index + 7);

function weekdayLabel(date: string) {
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  return labels[new Date(`${date.slice(0, 10)}T00:00:00`).getDay()];
}

function getAdditionalSchedules(schedules: ScheduleProposalDto[], rehearsal: BandHomeDto['nextRehearsal']) {
  return schedules.filter((schedule) => {
    if (!rehearsal) {
      return true;
    }
    return !(
      schedule.date.slice(0, 10) === rehearsal.date.slice(0, 10) &&
      schedule.startTime.slice(0, 5) === rehearsal.startTime.slice(0, 5) &&
      schedule.endTime.slice(0, 5) === rehearsal.endTime.slice(0, 5)
    );
  });
}

function formatScheduleDate(date: string) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${weekdayLabel(date)}`;
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
  return 'musical-notes-outline';
}

function isStudioTodo(todo: TodoItemDto) {
  const rawTodo = todo as unknown as { shortcut?: string; type: string };
  return rawTodo.shortcut === 'studio' || rawTodo.type === 'vote_studio' || rawTodo.type === 'start_studio';
}

async function findFirstPendingPracticeId(bandId: string) {
  const assignments = await api.get<PracticeAssignmentDto[]>(`/bands/${bandId}/practice-assignments`);
  const pending = assignments
    .filter((assignment) => assignment.status === 'open' && !assignment.hasSubmitted)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return pending[0]?.id ?? null;
}

function getNextRehearsalDisplay(rehearsal: BandHomeDto['nextRehearsal']) {
  if (!rehearsal) {
    return { date: '--/--', dDay: '미정', time: '시간 미정' };
  }

  const [year, month, day] = rehearsal.date.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    date: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
    dDay: daysLeft === 0 ? 'D-DAY' : daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`,
    time: `${formatRehearsalTime(rehearsal.startTime)}~${formatRehearsalTime(rehearsal.endTime)}`,
  };
}

function formatRehearsalTime(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':');
  return minute === '00' ? `${hour}시` : `${hour}:${minute}`;
}

const styles = StyleSheet.create({
  homeContent: {
    gap: 28,
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
  dashboardHero: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 2,
  },
  bandImage: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    resizeMode: 'cover',
    backgroundColor: theme.colors.surfaceMuted,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  bandName: {
    color: theme.colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  memberMeta: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  sectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  todoStack: {
    gap: 8,
  },
  primaryTodoCard: {
    minHeight: 150,
    borderRadius: theme.radius.md,
    padding: 15,
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
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
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  todoTitle: {
    color: theme.colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  todoDescription: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
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
    fontSize: 13,
    fontWeight: '900',
  },
  compactTodoList: {
    gap: 7,
  },
  moreTodoButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  moreTodoButtonPressed: {
    opacity: 0.68,
  },
  moreTodoText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
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
    paddingVertical: 12,
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  compactTodoDescription: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  compactTodoGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactTodoDeadline: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
    minWidth: 34,
    textAlign: 'right',
  },
  nextRehearsalCard: {
    width: '100%',
    minHeight: 132,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    padding: 12,
    gap: 10,
  },
  nextRehearsalTop: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  nextRehearsalWhen: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  nextRehearsalDday: {
    color: theme.colors.primaryDark,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
    textAlignVertical: 'center',
  },
  nextRehearsalDate: {
    color: theme.colors.text,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
  },
  nextRehearsalTime: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  nextRehearsalDivider: {
    height: 1,
    backgroundColor: '#d8d2ff',
    marginVertical: 2,
  },
  nextRehearsalLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nextRehearsalLocationLabel: {
    width: 32,
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  nextRehearsalLocationValue: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  additionalScheduleRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 4,
  },
  additionalScheduleDate: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  additionalScheduleTime: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  headerIconAction: {
    minHeight: 32,
    flexDirection: 'row',
    gap: 4,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 9,
  },
  headerIconActionText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  scheduleSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  scheduleSubTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  scheduleLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  scheduleLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scheduleLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  scheduleLegendAvailable: {
    backgroundColor: '#159a78',
  },
  scheduleLegendText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
  scheduleTable: {
    flexDirection: 'row',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#f1f3f6',
    padding: 9,
  },
  scheduleScroll: {
    flex: 1,
  },
  weekdayColumn: {
    width: 30,
    gap: 4,
    marginRight: 7,
    zIndex: 1,
  },
  tableCorner: {
    height: 20,
  },
  weekdayCell: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  tableGrid: {
    gap: 4,
  },
  tableRow: {
    flexDirection: 'row',
    gap: 4,
  },
  hourCell: {
    width: 32,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },
  scheduleCell: {
    width: 32,
    height: 30,
    borderRadius: 5,
    backgroundColor: '#e3e7ec',
  },
  scheduleCellAvailable: {
    backgroundColor: '#159a78',
  },
  mySettlementCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mySettlementText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  mySettlementCardPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    transform: [{ scale: 0.99 }],
  },
  mySettlementLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  mySettlementDetail: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
  mySettlementAmount: {
    color: theme.colors.primaryDark,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },
  mySettlementAmountGroup: {
    alignItems: 'flex-end',
    minWidth: 0,
    flexShrink: 1,
  },
  mySettlementAmountGuide: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'right',
  },
  mySettlementAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
