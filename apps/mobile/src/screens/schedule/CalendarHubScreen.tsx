import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScheduleSlotDto, ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, HeroBanner, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';

export function CalendarHubScreen() {
  const navigation = useNavigation<any>();
  const { currentBand } = useCurrentBand();
  const [slots, setSlots] = useState<ScheduleSlotDto[]>([]);
  const [summary, setSummary] = useState<ScheduleSummaryDto[]>([]);

  const load = useCallback(async () => {
    if (!currentBand) {
      setSlots([]);
      setSummary([]);
      return;
    }

    const [slotResult, summaryResult] = await Promise.all([
      api.get<ScheduleSlotDto[]>(`/bands/${currentBand.id}/schedule-slots`),
      api.get<ScheduleSummaryDto[]>(`/bands/${currentBand.id}/schedule-summary`),
    ]);

    setSlots(slotResult);
    setSummary(summaryResult);
  }, [currentBand]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentBand) {
    return (
      <Screen>
        <HeroBanner title="달력" subtitle="밴드를 선택하면 합주 시간 흐름을 볼 수 있어요." badge="선택 필요" />
        <EmptyState title="선택된 밴드가 없어요" description="내 밴드에서 사용할 밴드를 먼저 선택해 주세요." />
        <PrimaryButton label="내 밴드로 이동" onPress={() => navigation.navigate('BandList')} />
      </Screen>
    );
  }

  const topSummary = summary[0];

  return (
    <Screen>
      <HeroBanner
        title={`${currentBand.name} 달력`}
        subtitle={topSummary?.message ?? '합주 가능한 시간과 최근 제안을 한 번에 확인해요.'}
        imageUrl={currentBand.thumbnailUrl}
        badge={`${slots.length}개 일정`}
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>바로가기</Text>
        <PrimaryButton label="합주 일정 보기" onPress={() => navigation.navigate('Schedule', { bandId: currentBand.id })} />
        <Pressable
          style={styles.secondaryRow}
          onPress={() => navigation.navigate('CreateScheduleSlot', { bandId: currentBand.id })}
        >
          <Text style={styles.secondaryTitle}>합주 시간 제안하기</Text>
          <Text style={styles.secondaryMeta}>가능한 시간을 골라 찬반 투표를 열어요</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>최근 일정</Text>
          <StatusBadge label={`${slots.length}개`} />
        </View>
        {slots.length === 0 ? (
          <EmptyState title="아직 제안된 시간이 없어요" description="합주 시간이 올라오면 여기에서 바로 확인할 수 있어요." />
        ) : null}
        {slots.slice(0, 3).map((slot) => {
          const slotSummary = summary.find((item) => item.slotId === slot.id);
          return (
            <Pressable
              key={slot.id}
              style={styles.slotRow}
              onPress={() => navigation.navigate('Schedule', { bandId: currentBand.id })}
            >
              <View style={styles.slotBody}>
                <Text style={styles.slotTitle}>{slot.date} {slot.startTime} - {slot.endTime}</Text>
                <Text style={styles.slotMeta} numberOfLines={2}>{slotSummary?.message ?? '멤버 응답을 기다리는 중이에요.'}</Text>
              </View>
              <StatusBadge
                label={slot.myAvailability === 'yes' ? '가능' : slot.myAvailability === 'no' ? '어려움' : '응답 전'}
                tone={slot.myAvailability === 'yes' ? 'success' : slot.myAvailability === 'no' ? 'danger' : 'warning'}
              />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryRow: {
    minHeight: 48,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
    justifyContent: 'center',
    gap: 2,
  },
  secondaryTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  slotBody: {
    flex: 1,
    gap: 3,
  },
  slotTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  slotMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
});
