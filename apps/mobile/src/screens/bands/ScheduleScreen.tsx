import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleProposalDto, ScheduleSlotDto, ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { HeroBanner, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Schedule'>;

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const AFTERNOON_HOURS = Array.from({ length: 12 }, (_, index) => index + 12);
const MORNING_HOURS = Array.from({ length: 12 }, (_, index) => index);

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

  const slotsByKey = useMemo(() => {
    return new Map(slots.map((slot) => [slotKey(slot.date, Number(slot.startTime.slice(0, 2))), slot]));
  }, [slots]);

  const summaryBySlotId = useMemo(() => {
    return new Map(summary.map((item) => [item.slotId, item]));
  }, [summary]);

  const activeProposal = proposal?.active ? proposal : null;
  const confirmedProposal = proposal && !proposal.active && proposal.confirmed ? proposal : null;
  const mySelectedCount = slots.filter((slot) => slot.myAvailability === 'yes').length;
  const isLeader = currentBand?.myRole === 'leader';
  const voteLocked = Boolean(activeProposal?.myAvailability) || !activeProposal;
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
      Alert.alert('응답 완료', '찬반 응답이 저장되었습니다.');
      await load();
    } catch (error) {
      Alert.alert('응답 실패', error instanceof Error ? error.message : '찬반 응답을 저장하지 못했어요.');
    } finally {
      setVoting(false);
    }
  };

  const finishProposalNow = () => {
    Alert.alert('찬반투표를 지금 끝낼까요?', '현재까지의 찬반 결과로 합주 시간을 확정하거나 종료합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지금 끝내기',
        style: 'destructive',
        onPress: async () => {
          setEndingProposal(true);
          try {
            const result = await api.post<ScheduleProposalDto>(`/bands/${bandId}/schedule-proposal/finalize`);
            Alert.alert('찬반투표 종료', result.confirmed ? '합주 시간이 확정되었어요.' : '모두 찬성하지 않아 확정되지 않았어요.');
            await load();
          } catch (error) {
            Alert.alert('종료 실패', error instanceof Error ? error.message : '찬반투표를 끝내지 못했어요.');
          } finally {
            setEndingProposal(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="calendar" navigation={navigation} />}>
      <HeroBanner title="우리 일정" subtitle="합주 일정을 맞춰봐요" align="center" />

      <PrimaryButton label="합주 시간 제안" onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>찬반투표</Text>
        {confirmedProposal ? (
          <View style={styles.confirmedCard}>
            <StatusBadge label="합주 시간 확정" tone="success" />
            <Text style={styles.voteTitle}>
              {formatScheduleLabel(confirmedProposal.date, confirmedProposal.startTime, confirmedProposal.endTime)}
            </Text>
            <Text style={styles.voteMessage}>모두가 찬성해서 이 시간으로 합주가 확정됐어요.</Text>
          </View>
        ) : null}
        {!activeProposal && !confirmedProposal ? (
          <Text style={styles.disabledHint}>찬반투표가 시작되지 않았어요</Text>
        ) : null}
        {activeProposal ? (
          <View style={styles.voteCard}>
            <Text style={styles.voteTitle}>
              {formatScheduleLabel(activeProposal.date, activeProposal.startTime, activeProposal.endTime)}
            </Text>
            <Text style={styles.voteMessage}>{activeProposal.message}</Text>
            <Text style={styles.voteMeta}>찬성 {activeProposal.yesCount}명 · 반대 {activeProposal.noCount}명</Text>
            <Text style={styles.voteMeta}>
              내 응답: {activeProposal.myAvailability === 'yes' ? '찬성' : activeProposal.myAvailability === 'no' ? '반대' : '미응답'}
            </Text>
            <View style={styles.voteActions}>
              <PrimaryButton label="찬성" onPress={() => void submitVote('yes')} loading={voting} disabled={voteLocked || endingProposal} />
              <PrimaryButton label="반대" onPress={() => void submitVote('no')} loading={voting} disabled={voteLocked || endingProposal} style={styles.noButton} />
            </View>
            {isLeader ? (
              <Pressable
                onPress={finishProposalNow}
                disabled={endingProposal || voting}
                style={[styles.subtleEndButton, (endingProposal || voting) && styles.subtleEndButtonDisabled]}
              >
                <Text style={styles.subtleEndButtonText}>{endingProposal ? '끝내는 중...' : '지금 끝내기'}</Text>
              </Pressable>
            ) : null}
            {voteLocked ? <Text style={styles.lockedHint}>찬반 응답은 한 번 제출하면 변경할 수 없어요.</Text> : null}
            {activeProposal.confirmed ? <StatusBadge label="합주 시간 확정" tone="success" /> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>시간표 미리보기</Text>
        </View>
        <Text style={styles.caption}>오전, 오후 시간표를 각각 눌러 편집 화면에서 가능한 시간을 등록할 수 있어요.</Text>

        <View style={styles.previewTables}>
          <Pressable onPress={() => navigation.navigate('ScheduleEdit', { bandId, period: 'morning' })} style={styles.previewPane}>
            <MiniTimeTable title="새벽/오전" dates={weekDates} hours={MORNING_HOURS} slotsByKey={slotsByKey} summaryBySlotId={summaryBySlotId} />
            <Text style={styles.previewHint}>오전 크게 보기</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('ScheduleEdit', { bandId, period: 'afternoon' })} style={styles.previewPane}>
            <MiniTimeTable title="오후 가능 시간" dates={weekDates} hours={AFTERNOON_HOURS} slotsByKey={slotsByKey} summaryBySlotId={summaryBySlotId} />
            <Text style={styles.previewHint}>오후 크게 보기</Text>
          </Pressable>
        </View>
      </View>

    </Screen>
  );
}

function MiniTimeTable({
  title,
  dates,
  hours,
  slotsByKey,
  summaryBySlotId,
}: {
  title: string;
  dates: string[];
  hours: number[];
  slotsByKey: Map<string, ScheduleSlotDto>;
  summaryBySlotId: Map<string, ScheduleSummaryDto>;
}) {
  return (
    <View style={styles.tableCard}>
      <Text style={styles.tableTitle}>{title}</Text>
      <View style={styles.legendItems}>
        <LegendDot color={theme.colors.primary} label="모두 가능" />
        <LegendDot color={theme.colors.primarySoft} label="내 선택" />
        <LegendDot color="#fff" label="미선택" bordered />
      </View>
      <View style={styles.gridHeader}>
        <Text style={styles.timeLabel} />
        {WEEK_LABELS.map((label) => (
          <Text key={label} style={styles.dayLabel}>
            {label}
          </Text>
        ))}
      </View>
      {hours.map((hour) => (
        <View key={hour} style={styles.gridRow}>
          <Text style={styles.timeLabel}>{`${String(hour).padStart(2, '0')}시`}</Text>
          {dates.map((date) => {
            const slot = slotsByKey.get(slotKey(date, hour));
            const selected = slot?.myAvailability === 'yes';
            const matched = slot ? summaryBySlotId.get(slot.id)?.allAvailable : false;

            return <View key={`${date}-${hour}`} style={[styles.gridCell, selected && styles.gridCellSelected, matched && styles.gridCellMatched]} />;
          })}
        </View>
      ))}
    </View>
  );
}

function LegendDot({ color, label, bordered }: { color: string; label: string; bordered?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }, bordered && styles.legendDotBordered]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function getCurrentWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return toDateValue(date);
  });
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatScheduleLabel(date: string, startTime: string, endTime: string) {
  const day = new Date(`${date}T00:00:00`).getDay();
  const weekdayIndex = day === 0 ? 6 : day - 1;
  return `${WEEK_LABELS[weekdayIndex]}요일 ${startTime} - ${endTime}`;
}

function slotKey(date: string, hour: number) {
  return `${date}T${String(hour).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  previewTables: {
    flexDirection: 'row',
    gap: 10,
  },
  previewPane: {
    flex: 1,
    gap: 8,
  },
  previewHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  tableCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  tableTitle: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
  },
  legendDotBordered: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  legendText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  gridHeader: {
    flexDirection: 'row',
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  timeLabel: {
    width: 32,
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  dayLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  gridCell: {
    flex: 1,
    height: 15,
    borderWidth: 1,
    borderColor: theme.colors.primarySoft,
    backgroundColor: '#fff',
  },
  gridCellSelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  gridCellMatched: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
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
