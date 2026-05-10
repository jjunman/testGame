import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScheduleSlotDto, ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, HeroBanner, PrimaryButton, SectionCard, StatusBadge } from '../../components/UI';
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
        <HeroBanner title="달력" subtitle="먼저 밴드를 선택하면 합주 시간 흐름이 이어져요." badge="선택 필요" />
        <EmptyState title="선택된 밴드가 없어요" description="홈 탭에서 밴드를 고르면 이 탭이 그 밴드 기준 일정 허브가 됩니다." />
        <PrimaryButton label="내 밴드로 이동" onPress={() => navigation.navigate('BandsTab', { screen: 'BandList' })} />
      </Screen>
    );
  }

  const topSummary = summary[0];

  return (
    <Screen>
      <HeroBanner
        title={`${currentBand.name} 달력`}
        subtitle={topSummary?.message ?? '합주 가능 시간과 최근 제안을 한 번에 볼 수 있어요.'}
        imageUrl={currentBand.thumbnailUrl}
        badge={`${slots.length}개 제안`}
      />

      <SectionCard title="빠른 이동">
        <PrimaryButton label="합주 일정 보기" onPress={() => navigation.navigate('BandsTab', { screen: 'Schedule', params: { bandId: currentBand.id } })} />
        <PrimaryButton
          label="합주 시간 제안하기"
          onPress={() => navigation.navigate('BandsTab', { screen: 'CreateScheduleSlot', params: { bandId: currentBand.id } })}
        />
      </SectionCard>

      <SectionCard title="최근 제안">
        {slots.length === 0 ? (
          <EmptyState title="아직 제안된 시간이 없어요" description="리더가 시간대를 올리면 여기서 바로 확인할 수 있어요." />
        ) : null}
        {slots.slice(0, 3).map((slot) => {
          const slotSummary = summary.find((item) => item.slotId === slot.id);
          return (
            <SectionCard key={slot.id} title={`${slot.date} ${slot.startTime} - ${slot.endTime}`} accent="purple">
              <StatusBadge
                label={slot.myAvailability === 'yes' ? '참여 가능' : slot.myAvailability === 'no' ? '참여 어려움' : '응답 전'}
                tone={slot.myAvailability === 'yes' ? 'success' : slot.myAvailability === 'no' ? 'danger' : 'warning'}
              />
              <Text style={styles.bodyText}>{slotSummary?.message ?? '멤버 응답을 기다리는 중이에요.'}</Text>
            </SectionCard>
          );
        })}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});
