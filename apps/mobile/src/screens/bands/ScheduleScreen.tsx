import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

  const allAvailableSlotKeys = useMemo(() => {
    return new Set(
      summary
        .filter((item) => item.allAvailable && isVisibleSummary(item, weekDates))
        .map((item) => `${item.date}-${Math.floor(toMinute(item.startTime) / 60)}`),
    );
  }, [summary, weekDates]);

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
        <QuickAction
          icon="create-outline"
          label="내 일정 입력하기"
          onPress={() => navigation.navigate('ScheduleEdit', { bandId })}
        />
        <QuickAction
          icon="add"
          label="일정 제안하기"
          onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>모두가 가능한 시간</Text>
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
                    <Text style={styles.hourText}>{formatHourValue(hour)}시</Text>
                  </View>
                ))}
              </View>
              {weekDates.map((date) => (
                <View key={date} style={styles.tableRow}>
                  {SCHEDULE_HOURS.map((hour) => {
                    const isAllAvailable = allAvailableSlotKeys.has(`${date}-${hour}`);
                    return (
                      <View
                        key={`${date}-${hour}`}
                        accessibilityLabel={`${weekdayLabel(date)}요일 ${formatHourValue(hour)}시부터 ${formatHourValue(hour + 1)}시${isAllAvailable ? ', 모두 가능' : ''}`}
                        style={[
                          styles.scheduleCell,
                          isAllAvailable && styles.scheduleCellAvailable,
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
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

    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.quickActionItem}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.emptyAddButton}>
        <Ionicons name={icon} size={icon === 'add' ? 26 : 24} color="#fff" />
      </Pressable>
      <Text style={styles.emptyAddLabel}>{label}</Text>
    </View>
  );
}

const SCHEDULE_HOURS = Array.from({ length: 15 }, (_, index) => index + 7);

function isVisibleSummary(item: ScheduleSummaryDto, weekDates: string[]) {
  return weekDates.includes(item.date) && isScheduleHour(Math.floor(toMinute(item.startTime) / 60));
}

function weekdayLabel(date: string) {
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  return labels[new Date(`${date}T00:00:00`).getDay()];
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
    gap: 42,
    paddingVertical: 4,
    marginBottom: 4,
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
  scheduleTable: {
    flexDirection: 'row',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#f1f3f6',
    padding: 10,
  },
  scheduleScroll: {
    flex: 1,
  },
  weekdayColumn: {
    width: 34,
    gap: 5,
    marginRight: 8,
    zIndex: 1,
  },
  tableCorner: {
    height: 24,
  },
  weekdayCell: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  tableGrid: {
    gap: 5,
  },
  tableRow: {
    flexDirection: 'row',
    gap: 5,
  },
  hourCell: {
    width: 36,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  scheduleCell: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#e3e7ec',
  },
  scheduleCellAvailable: {
    backgroundColor: '#159a78',
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
