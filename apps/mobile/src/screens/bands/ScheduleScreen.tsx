import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScheduleProposalDto, ScheduleSlotDto, ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import {
  formatDateTimeLabel,
  getCurrentWeekDates,
  isScheduleHour,
  toMinute,
} from '../../components/ScheduleAvailability';
import { Screen } from '../../components/Screen';
import { ActionCardButton, HeroBanner, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Schedule'>;

export function ScheduleScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const { currentBand } = useCurrentBand();
  const [slots, setSlots] = useState<ScheduleSlotDto[]>([]);
  const [summary, setSummary] = useState<ScheduleSummaryDto[]>([]);
  const [proposal, setProposal] = useState<ScheduleProposalDto | null>(null);
  const [voting, setVoting] = useState(false);
  const [endingProposal, setEndingProposal] = useState(false);

  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const load = useCallback(async () => {
    const [nextSlots, nextSummary, nextProposal] = await Promise.all([
      api.get<ScheduleSlotDto[]>(`/bands/${bandId}/schedule-slots`),
      api.get<ScheduleSummaryDto[]>(`/bands/${bandId}/schedule-summary`),
      api.get<ScheduleProposalDto | null>(`/bands/${bandId}/schedule-proposal`),
    ]);
    setSlots(nextSlots);
    setSummary(nextSummary);
    setProposal(nextProposal);
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const visibleSlots = useMemo(() => {
    return slots.filter((slot) => weekDates.includes(slot.date) && isScheduleHour(Number(slot.startTime.slice(0, 2))));
  }, [slots, weekDates]);

  const allAvailableItems = useMemo(() => buildAllAvailableItems(summary, weekDates), [summary, weekDates]);

  const activeProposal = proposal?.active ? proposal : null;
  const confirmedProposal = proposal && !proposal.active && proposal.confirmed ? proposal : null;
  const isLeader = currentBand?.myRole === 'leader';
  const voteLocked = !activeProposal;

  const submitVote = async (availability: 'yes' | 'no') => {
    if (!activeProposal) {
      return;
    }

    setVoting(true);
    try {
      await api.post(`/bands/${bandId}/schedule-proposal-vote`, {
        proposalId: activeProposal.id,
        availability,
      });
      Alert.alert('응답 완료', '찬반 응답을 저장했어요.');
      await load();
    } catch (error) {
      Alert.alert('응답 실패', error instanceof Error ? error.message : '찬반 응답을 저장하지 못했어요.');
    } finally {
      setVoting(false);
    }
  };

  const finishProposalNow = () => {
    Alert.alert('찬반 투표를 지금 마감할까요?', '현재까지의 응답으로 합주 시간을 확정하거나 투표를 종료합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지금 마감',
        style: 'destructive',
        onPress: async () => {
          setEndingProposal(true);
          try {
            const result = await api.post<ScheduleProposalDto>(`/bands/${bandId}/schedule-proposal/finalize`);
            Alert.alert('찬반 투표 종료', result.confirmed ? '합주 시간이 확정되었어요.' : '모두 찬성하지 않아 확정되지 않았어요.');
            await load();
          } catch (error) {
            Alert.alert('종료 실패', error instanceof Error ? error.message : '찬반 투표를 마감하지 못했어요.');
          } finally {
            setEndingProposal(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="calendar" navigation={navigation} />}>
      <HeroBanner title="우리 일정" align="center" />

      <View style={styles.quickActions}>
        <View style={styles.quickActionItem}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="합주 시간 제안하기"
            onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })}
            style={styles.emptyAddButton}
          >
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.emptyAddLabel}>일정 제안하기</Text>
        </View>
        <View style={styles.quickActionItem}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="내 가능 시간 등록하기"
            onPress={() => navigation.navigate('ScheduleEdit', { bandId })}
            style={styles.emptyAddButton}
          >
            <Ionicons name="create-outline" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.emptyAddLabel}>내 일정 입력하기</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>찬반 투표</Text>
        {confirmedProposal ? (
          <View style={styles.confirmedCard}>
            <StatusBadge label="합주 시간 확정" tone="success" />
            <Text style={styles.voteTitle}>
              {formatDateTimeLabel(confirmedProposal.date, confirmedProposal.startTime, confirmedProposal.endTime)}
            </Text>
            <Text style={styles.voteSubmitter}>올린 사람: {confirmedProposal.createdByName}</Text>
            <Text style={styles.voteMessage}>모두가 찬성해서 이 시간으로 합주가 확정되었어요.</Text>
            <ActionCardButton
              title="일정 변경"
              subtitle="새로운 합주 시간을 다시 제안해요"
              icon="create-outline"
              onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })}
            />
          </View>
        ) : null}
        {!activeProposal && !confirmedProposal ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 진행 중인 찬반 투표가 없어요</Text>
          </View>
        ) : null}
        {activeProposal ? (
          <View style={styles.voteCard}>
            <Text style={styles.voteTitle}>
              {formatDateTimeLabel(activeProposal.date, activeProposal.startTime, activeProposal.endTime)}
            </Text>
            <Text style={styles.voteSubmitter}>올린 사람: {activeProposal.createdByName}</Text>
            <Text style={styles.voteMessage}>{activeProposal.message}</Text>
            <Text style={styles.voteMeta}>찬성 {activeProposal.yesCount}명 · 반대 {activeProposal.noCount}명</Text>
            <Text style={styles.voteMeta}>
              내 응답: {activeProposal.myAvailability === 'yes' ? '찬성' : activeProposal.myAvailability === 'no' ? '반대' : '미응답'}
            </Text>
            <View style={styles.voteActions}>
              <PrimaryButton
                label={activeProposal.myAvailability === 'yes' ? '찬성 선택됨' : '찬성'}
                onPress={() => void submitVote('yes')}
                loading={voting}
                disabled={voteLocked || endingProposal}
                style={[
                  activeProposal.myAvailability === 'yes' && styles.yesButtonSelected,
                  activeProposal.myAvailability === 'no' && styles.unselectedVoteButton,
                ]}
              />
              <PrimaryButton
                label={activeProposal.myAvailability === 'no' ? '반대 선택됨' : '반대'}
                onPress={() => void submitVote('no')}
                loading={voting}
                disabled={voteLocked || endingProposal}
                style={[
                  styles.noButton,
                  activeProposal.myAvailability === 'yes' && styles.unselectedVoteButton,
                  activeProposal.myAvailability === 'no' && styles.noButtonSelected,
                ]}
              />
            </View>
            {isLeader ? (
              <Pressable
                onPress={finishProposalNow}
                disabled={endingProposal || voting}
                style={[styles.subtleEndButton, (endingProposal || voting) && styles.subtleEndButtonDisabled]}
              >
                <Text style={styles.subtleEndButtonText}>{endingProposal ? '마감 중...' : '지금 마감하기'}</Text>
              </Pressable>
            ) : null}
            {activeProposal.myAvailability ? <Text style={styles.lockedHint}>응답은 투표가 끝나기 전까지 다시 바꿀 수 있어요.</Text> : null}
            {activeProposal.confirmed ? <StatusBadge label="합주 시간 확정" tone="success" /> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>모두가 가능한 시간</Text>
        {allAvailableItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 모두 가능한 시간이 없어요</Text>
          </View>
        ) : null}
        {allAvailableItems.map((item) => (
          <Pressable key={item.id} style={styles.availableRow} onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })}>
            <View style={styles.availableDateBox}>
              <Text style={styles.availableWeekday}>{item.weekday}</Text>
            </View>
            <View style={styles.availableBody}>
              <Text style={styles.availableMeta}>전원 가능 시간</Text>
              <Text style={styles.availableTime}>{item.timeLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.accent} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

type AllAvailableItem = {
  id: string;
  weekday: string;
  timeLabel: string;
  date: string;
};

function buildAllAvailableItems(summary: ScheduleSummaryDto[], weekDates: string[]): AllAvailableItem[] {
  const grouped = new Map<string, number[]>();

  summary
    .filter((item) => item.allAvailable && isVisibleSummary(item, weekDates))
    .forEach((item) => {
      const hour = Math.floor(toMinute(item.startTime) / 60);
      grouped.set(item.date, [...(grouped.get(item.date) ?? []), hour]);
    });

  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .flatMap(([date, hours]) =>
      buildHourRanges(hours).map((range) => ({
        id: `${date}-${range.startHour}-${range.endHour}`,
        weekday: weekdayLabel(date),
        timeLabel: range.label,
        date,
      })),
    );
}

function isVisibleSummary(item: ScheduleSummaryDto, weekDates: string[]) {
  return weekDates.includes(item.date) && isScheduleHour(Math.floor(toMinute(item.startTime) / 60));
}

function weekdayLabel(date: string) {
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  return labels[new Date(`${date}T00:00:00`).getDay()];
}

function buildHourRanges(hours: number[]) {
  const sortedHours = Array.from(new Set(hours)).sort((a, b) => a - b);
  const ranges: Array<{ startHour: number; endHour: number; label: string }> = [];
  let rangeStart = sortedHours[0];
  let rangeEnd = sortedHours[0];

  for (let index = 1; index < sortedHours.length; index += 1) {
    const hour = sortedHours[index];
    if (hour === rangeEnd + 1) {
      rangeEnd = hour;
      continue;
    }

    ranges.push({
      startHour: rangeStart,
      endHour: rangeEnd,
      label: formatHourRange(rangeStart, rangeEnd),
    });
    rangeStart = hour;
    rangeEnd = hour;
  }

  if (rangeStart !== undefined && rangeEnd !== undefined) {
    ranges.push({
      startHour: rangeStart,
      endHour: rangeEnd,
      label: formatHourRange(rangeStart, rangeEnd),
    });
  }

  return ranges;
}

function formatHourRange(startHour: number, endHour: number) {
  const start = formatHourValue(startHour);
  const end = formatHourValue(endHour + 1);
  return `${start}시~${end}시`;
}

function formatHourValue(hour: number) {
  return String(hour).padStart(2, '0');
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 34,
    paddingVertical: 2,
  },
  quickActionItem: {
    minWidth: 104,
    alignItems: 'center',
    gap: 5,
  },
  emptyCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
    alignItems: 'center',
    gap: 5,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyAddButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAddLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  availableRow: {
    minHeight: 78,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#8ddfd3',
    backgroundColor: '#f0fdfa',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    shadowColor: '#0f766e',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  availableDateBox: {
    width: 50,
    height: 54,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#99e3d7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  availableWeekday: {
    color: theme.colors.accent,
    fontSize: 18,
    fontWeight: '900',
  },
  availableBody: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  availableMeta: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  availableTime: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  disabledHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'left',
    paddingVertical: 10,
  },
  voteCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  voteTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  voteMessage: {
    color: theme.colors.text,
    fontWeight: '700',
    lineHeight: 20,
  },
  voteSubmitter: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  voteMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  voteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
    gap: 10,
  },
  noButton: {
    backgroundColor: theme.colors.textMuted,
  },
  yesButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.primaryDark,
  },
  unselectedVoteButton: {
    backgroundColor: '#94a3b8',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  noButtonSelected: {
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#b91c1c',
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
  lockedHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
