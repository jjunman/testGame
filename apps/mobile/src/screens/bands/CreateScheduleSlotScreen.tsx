import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { Field, HeroBanner, Label, PrimaryButton, SectionCard } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'CreateScheduleSlot'>;
type DurationHour = 1 | 2 | 3 | 4;
type ScheduleSlotTab = 'recommended' | 'manual';
type Recommendation = {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
  allAvailable: boolean;
  availableCount: number;
  message: string;
};

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DURATION_OPTIONS: DurationHour[] = [1, 2, 3, 4];

export function CreateScheduleSlotScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [summary, setSummary] = useState<ScheduleSummaryDto[]>([]);
  const [durationHours, setDurationHours] = useState<DurationHour>(2);
  const [weekdayIndex, setWeekdayIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ScheduleSlotTab>('recommended');
  const [segmentWidth, setSegmentWidth] = useState(0);
  const indicatorProgress = useRef(new Animated.Value(0)).current;
  const indicatorWidth = segmentWidth > 0 ? (segmentWidth - 8) / 2 : 0;

  useEffect(() => {
    void (async () => {
      try {
        setSummary(await api.get<ScheduleSummaryDto[]>(`/bands/${bandId}/schedule-summary`));
      } catch {
        setSummary([]);
      }
    })();
  }, [bandId]);

  const recommendedItems = useMemo(
    () => buildRecommendations(summary, durationHours).slice(0, 3),
    [durationHours, summary],
  );
  const allAvailableRecommendedItems = useMemo(
    () => recommendedItems.filter((item) => item.allAvailable),
    [recommendedItems],
  );
  const recommended = recommendedItems[0] ?? null;

  useEffect(() => {
    if (recommended) {
      setWeekdayIndex(dateToWeekdayIndex(recommended.date));
      setStartTime(recommended.startTime);
      setEndTime(recommended.endTime);
    }
  }, [recommended]);

  useEffect(() => {
    Animated.spring(indicatorProgress, {
      toValue: activeTab === 'recommended' ? 0 : 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.65,
    }).start();
  }, [activeTab, indicatorProgress]);

  const submit = async () => {
    if (weekdayIndex === null || !startTime || !endTime) {
      Alert.alert('입력 필요', '요일과 시간을 모두 입력해 주세요.');
      return;
    }
    if (!isTimeValue(startTime) || !isTimeValue(endTime)) {
      Alert.alert('형식 확인', '시간은 19:00 형식으로 입력해 주세요.');
      return;
    }
    if (toMinute(endTime) <= toMinute(startTime)) {
      Alert.alert('시간 확인', '종료 시간은 시작 시간보다 늦어야 해요.');
      return;
    }

    setSubmitting(true);
    try {
      const date = getCurrentWeekDates()[weekdayIndex];
      await api.post(`/bands/${bandId}/schedule-proposal`, { date, startTime, endTime });
      Alert.alert('제안 완료', '합주 요일과 시간 찬반투표가 시작되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('제안 실패', error instanceof Error ? error.message : '합주 시간 제안을 시작하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scrollEnabled={false}>
      <HeroBanner title="합주 시간 제안하기" subtitle="몇 시간 합주할지 고르면, 가능한 연속 시간대를 추천해요." badge="일정" />

      <SectionCard title="합주 길이">
        <Label>몇 시간 합주할까요?</Label>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((hours) => {
            const selected = durationHours === hours;
            return (
              <Pressable
                key={hours}
                style={[styles.durationChip, selected && styles.durationChipSelected]}
                onPress={() => setDurationHours(hours)}
              >
                <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{hours}시간</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeTab === 'recommended' ? '직접 정하기로 전환' : '추천 시간으로 전환'}
        style={styles.segment}
        onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
        onPress={() => setActiveTab((current) => (current === 'recommended' ? 'manual' : 'recommended'))}
      >
        {indicatorWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentIndicator,
              {
                width: indicatorWidth,
                transform: [
                  {
                    translateX: indicatorProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, indicatorWidth],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
        <SegmentLabel label="추천 시간" active={activeTab === 'recommended'} />
        <SegmentLabel label="직접 정하기" active={activeTab === 'manual'} />
      </Pressable>

      {activeTab === 'recommended' ? (
        <SectionCard title="추천 시간">
          {allAvailableRecommendedItems.length > 0 ? (
            <View style={styles.recommendList}>
              {allAvailableRecommendedItems.map((item) => {
                const itemWeekdayIndex = dateToWeekdayIndex(item.date);
                const selected = weekdayIndex === itemWeekdayIndex && startTime === item.startTime && endTime === item.endTime;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.recommendItem, selected && styles.recommendItemSelected]}
                    onPress={() => {
                      setWeekdayIndex(itemWeekdayIndex);
                      setStartTime(item.startTime);
                      setEndTime(item.endTime);
                    }}
                  >
                    <Text style={[styles.recommendTitle, selected && styles.recommendTitleSelected]}>
                      {WEEK_LABELS[itemWeekdayIndex]}요일 {item.startTime} - {item.endTime}
                    </Text>
                    <Text style={[styles.recommendMessage, selected && styles.recommendMessageSelected]}>{item.message}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>모두가 {durationHours}시간 연속으로 가능한 시간이 아직 없어요. 직접 정하기 탭에서 시간을 제안해 주세요.</Text>
          )}
          <PrimaryButton label="제안하기" onPress={submit} loading={submitting} disabled={allAvailableRecommendedItems.length === 0} />
        </SectionCard>
      ) : null}

      {activeTab === 'manual' ? (
        <SectionCard title="직접 정하기">
          <Label>요일</Label>
          <View style={styles.weekdayGrid}>
            {WEEK_LABELS.map((label, index) => {
              const selected = weekdayIndex === index;
              return (
                <Pressable key={label} style={[styles.weekdayButton, selected && styles.weekdayButtonSelected]} onPress={() => setWeekdayIndex(index)}>
                  <Text style={[styles.weekdayText, selected && styles.weekdayTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Label>시작 시간</Label>
          <Field value={startTime} onChangeText={setStartTime} placeholder="예: 19:00" />
          <Label>종료 시간</Label>
          <Field value={endTime} onChangeText={setEndTime} placeholder="예: 21:00" />
          <PrimaryButton label="제안하기" onPress={submit} loading={submitting} />
        </SectionCard>
      ) : null}
    </Screen>
  );
}

function SegmentLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.segmentButton}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </View>
  );
}

function buildRecommendations(summary: ScheduleSummaryDto[], durationHours: DurationHour): Recommendation[] {
  const durationMinutes = durationHours * 60;
  const byDate = new Map<string, ScheduleSummaryDto[]>();
  for (const item of summary) {
    const items = byDate.get(item.date) ?? [];
    items.push(item);
    byDate.set(item.date, items);
  }

  const recommendations: Recommendation[] = [];
  for (const [date, items] of byDate) {
    const sorted = [...items].sort((a, b) => toMinute(a.startTime) - toMinute(b.startTime));
    for (let index = 0; index < sorted.length; index += 1) {
      const start = sorted[index];
      let endTime = start.endTime;
      let cursor = toMinute(start.endTime);
      let availableCount = start.availableCount;
      let allAvailable = start.allAvailable;

      for (let nextIndex = index + 1; cursor - toMinute(start.startTime) < durationMinutes && nextIndex < sorted.length; nextIndex += 1) {
        const next = sorted[nextIndex];
        if (toMinute(next.startTime) !== cursor) {
          break;
        }
        endTime = next.endTime;
        cursor = toMinute(next.endTime);
        availableCount = Math.min(availableCount, next.availableCount);
        allAvailable = allAvailable && next.allAvailable;
      }

      if (cursor - toMinute(start.startTime) >= durationMinutes) {
        recommendations.push({
          key: `${date}-${start.startTime}-${endTime}`,
          date,
          startTime: start.startTime,
          endTime,
          allAvailable,
          availableCount,
          message: allAvailable
            ? `${durationHours}시간 내내 모두 가능한 시간이에요.`
            : `${durationHours}시간 중 최소 ${availableCount}명이 가능한 시간이에요.`,
        });
      }
    }
  }

  return recommendations.sort((a, b) => {
    if (Number(b.allAvailable) !== Number(a.allAvailable)) {
      return Number(b.allAvailable) - Number(a.allAvailable);
    }
    if (b.availableCount !== a.availableCount) {
      return b.availableCount - a.availableCount;
    }
    return `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);
  });
}

function isTimeValue(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function toMinute(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function dateToWeekdayIndex(value: string) {
  const day = new Date(`${value}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
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

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: theme.colors.text,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  durationChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  durationText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  durationTextSelected: {
    color: '#fff',
  },
  recommendList: {
    gap: 8,
  },
  recommendItem: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 12,
    gap: 4,
  },
  recommendItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  recommendTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  recommendTitleSelected: {
    color: '#fff',
  },
  recommendMessage: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  recommendMessageSelected: {
    color: 'rgba(255,255,255,0.82)',
  },
  emptyText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  weekdayGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 8,
  },
  weekdayButton: {
    flex: 1,
    height: 44,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  weekdayText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  weekdayTextSelected: {
    color: '#fff',
  },
});
