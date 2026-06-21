import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { HeroBanner, Label, PrimaryButton, SectionCard } from '../../components/UI';
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
};

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DURATION_OPTIONS: DurationHour[] = [1, 2, 3, 4];

export function CreateScheduleSlotScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [summary, setSummary] = useState<ScheduleSummaryDto[]>([]);
  const [durationHours, setDurationHours] = useState<DurationHour>(2);
  const [selectedDate, setSelectedDate] = useState(() => toDateValue(new Date()));
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('21:00');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ScheduleSlotTab>('recommended');
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [iosPickerTarget, setIosPickerTarget] = useState<'date' | 'start' | 'end' | null>(null);
  const [bookmarkedKeys, setBookmarkedKeys] = useState<Set<string>>(new Set());
  const indicatorProgress = useRef(new Animated.Value(0)).current;
  const indicatorWidth = segmentWidth > 0 ? (segmentWidth - 8) / 2 : 0;
  const bookmarkStorageKey = `schedule-recommendation-bookmarks:${bandId}`;

  useEffect(() => {
    void (async () => {
      try {
        setSummary(await api.get<ScheduleSummaryDto[]>(`/bands/${bandId}/schedule-summary`));
      } catch {
        setSummary([]);
      }
    })();
  }, [bandId]);

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(bookmarkStorageKey).then((stored) => {
      if (!alive || !stored) {
        return;
      }
      try {
        const keys = JSON.parse(stored);
        if (Array.isArray(keys)) {
          setBookmarkedKeys(new Set(keys.filter((key): key is string => typeof key === 'string')));
        }
      } catch {
        setBookmarkedKeys(new Set());
      }
    });
    return () => {
      alive = false;
    };
  }, [bookmarkStorageKey]);

  const recommendedItems = useMemo(
    () => takeBestRecommendationPerDate(buildRecommendations(summary, durationHours)).slice(0, 3),
    [durationHours, summary],
  );
  const allAvailableRecommendedItems = useMemo(
    () => recommendedItems.filter((item) => item.allAvailable),
    [recommendedItems],
  );
  const recommended = recommendedItems[0] ?? null;

  useEffect(() => {
    if (activeTab === 'recommended' && recommended) {
      setSelectedDate(recommended.date);
      setStartTime(recommended.startTime);
      setEndTime(recommended.endTime);
    }
  }, [activeTab, recommended]);

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
    if (!selectedDate || !startTime || !endTime) {
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
      await api.post(`/bands/${bandId}/schedule-events`, { date: selectedDate, startTime, endTime });
      Alert.alert('등록 완료', '합주 일정이 바로 등록되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('등록 실패', error instanceof Error ? error.message : '합주 일정을 등록하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyPickedTime = (target: 'start' | 'end', pickedDate: Date) => {
    const value = formatTimeValue(pickedDate);
    if (target === 'start') {
      setStartTime(value);
      if (toMinute(endTime) <= toMinute(value)) {
        setEndTime(formatMinuteValue(Math.min(toMinute(value) + 120, 23 * 60 + 59)));
      }
      return;
    }
    setEndTime(value);
  };

  const openTimePicker = (target: 'start' | 'end') => {
    const currentValue = target === 'start' ? startTime : endTime;
    const current = timeValueToDate(currentValue);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'time',
        is24Hour: true,
        minuteInterval: 30,
        onChange: (event, pickedDate) => {
          if (event.type === 'set' && pickedDate) {
            applyPickedTime(target, pickedDate);
          }
        },
      });
      return;
    }

    setIosPickerTarget(target);
  };

  const openDatePicker = () => {
    const current = new Date(`${selectedDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: today,
        onChange: (event, pickedDate) => {
          if (event.type === 'set' && pickedDate) {
            setSelectedDate(toDateValue(pickedDate));
          }
        },
      });
      return;
    }

    setIosPickerTarget('date');
  };

  const toggleBookmark = (key: string) => {
    setBookmarkedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      void AsyncStorage.setItem(bookmarkStorageKey, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  return (
    <Screen>
      <HeroBanner title="합주 일정 등록" subtitle="가능한 시간을 추천받거나 직접 골라 바로 등록해요." />

      <View
        style={styles.segment}
        onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
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
        <SegmentLabel
          icon="sparkles-outline"
          label="추천 시간"
          active={activeTab === 'recommended'}
          onPress={() => setActiveTab('recommended')}
        />
        <SegmentLabel
          icon="create-outline"
          label="직접 등록"
          active={activeTab === 'manual'}
          onPress={() => setActiveTab('manual')}
        />
      </View>

      {activeTab === 'recommended' ? (
        <SectionCard title="추천 시간">
          <View style={styles.durationSection}>
            <Label>합주 길이</Label>
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
          </View>
          {allAvailableRecommendedItems.length > 0 ? (
            <View style={styles.recommendList}>
              {allAvailableRecommendedItems.map((item) => {
                const itemWeekdayIndex = dateToWeekdayIndex(item.date);
                const selected = selectedDate === item.date && startTime === item.startTime && endTime === item.endTime;
                const bookmarked = bookmarkedKeys.has(item.key);
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.recommendItem, selected && styles.recommendItemSelected]}
                    onPress={() => {
                      setSelectedDate(item.date);
                      setStartTime(item.startTime);
                      setEndTime(item.endTime);
                    }}
                  >
                    <View style={styles.recommendTopRow}>
                      <Text style={[styles.recommendDate, selected && styles.recommendDateSelected]}>
                        {formatDateLabel(item.date)} · {WEEK_LABELS[itemWeekdayIndex]}요일
                      </Text>
                      <View style={styles.recommendActions}>
                        {selected ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={bookmarked ? '북마크 해제' : '북마크 저장'}
                          hitSlop={8}
                          onPress={(event) => {
                            event.stopPropagation();
                            toggleBookmark(item.key);
                          }}
                        >
                          <Ionicons
                            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                            size={20}
                            color={bookmarked ? theme.colors.primaryDark : theme.colors.textMuted}
                          />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.recommendTitle}>{item.startTime} - {item.endTime}</Text>
                    <Text style={styles.recommendStatus}>모두 가능</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>모두가 {durationHours}시간 연속으로 가능한 시간이 아직 없어요. 직접 등록에서 시간을 골라 주세요.</Text>
          )}
          {allAvailableRecommendedItems.length > 0 ? (
            <RegistrationSummary date={selectedDate} startTime={startTime} endTime={endTime} />
          ) : null}
          <PrimaryButton label="이 시간으로 등록" onPress={submit} loading={submitting} disabled={allAvailableRecommendedItems.length === 0} />
        </SectionCard>
      ) : null}

      {activeTab === 'manual' ? (
        <SectionCard title="직접 등록">
          <Label>날짜</Label>
          <Pressable accessibilityRole="button" accessibilityLabel="합주 날짜 선택" style={styles.datePickerButton} onPress={openDatePicker}>
            <View style={styles.datePickerIcon}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primaryDark} />
            </View>
            <View style={styles.datePickerBody}>
              <Text style={styles.datePickerTitle}>{formatDateLabel(selectedDate)}</Text>
              <Text style={styles.datePickerWeekday}>{WEEK_LABELS[dateToWeekdayIndex(selectedDate)]}요일</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
          {iosPickerTarget === 'date' ? (
            <View style={styles.iosPickerBox}>
              <DateTimePicker
                value={new Date(`${selectedDate}T00:00:00`)}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={(_, pickedDate) => {
                  if (pickedDate) {
                    setSelectedDate(toDateValue(pickedDate));
                  }
                }}
              />
              <Pressable style={styles.iosPickerDone} onPress={() => setIosPickerTarget(null)}>
                <Text style={styles.iosPickerDoneText}>완료</Text>
              </Pressable>
            </View>
          ) : null}
          <Label>시간</Label>
          <View style={styles.timePickerRow}>
            <TimePickerButton label="시작" value={startTime} onPress={() => openTimePicker('start')} />
            <Ionicons name="arrow-forward" size={18} color={theme.colors.textMuted} />
            <TimePickerButton label="종료" value={endTime} onPress={() => openTimePicker('end')} />
          </View>
          {iosPickerTarget === 'start' || iosPickerTarget === 'end' ? (
            <View style={styles.iosPickerBox}>
              <DateTimePicker
                value={timeValueToDate(iosPickerTarget === 'start' ? startTime : endTime)}
                mode="time"
                display="spinner"
                minuteInterval={30}
                onChange={(_, pickedDate) => {
                  if (pickedDate) {
                    applyPickedTime(iosPickerTarget, pickedDate);
                  }
                }}
              />
              <Pressable style={styles.iosPickerDone} onPress={() => setIosPickerTarget(null)}>
                <Text style={styles.iosPickerDoneText}>완료</Text>
              </Pressable>
            </View>
          ) : null}
          <PrimaryButton label="일정 등록하기" onPress={submit} loading={submitting} />
        </SectionCard>
      ) : null}
    </Screen>
  );
}

function SegmentLabel({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.segmentButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color={active ? theme.colors.primaryDark : theme.colors.textMuted} />
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TimePickerButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} 시간 ${value}`} style={styles.timePickerButton} onPress={onPress}>
      <Ionicons name="time-outline" size={17} color={theme.colors.primaryDark} />
      <Text style={styles.timePickerLabel}>{label}</Text>
      <Text style={styles.timePickerValue}>{value}</Text>
    </Pressable>
  );
}

function RegistrationSummary({ date, startTime, endTime }: { date: string; startTime: string; endTime: string }) {
  return (
    <View style={styles.registrationSummary}>
      <Ionicons name="calendar-outline" size={19} color={theme.colors.primaryDark} />
      <View style={styles.registrationSummaryBody}>
        <Text style={styles.registrationSummaryDate}>{formatDateLabel(date)} · {WEEK_LABELS[dateToWeekdayIndex(date)]}요일</Text>
        <Text style={styles.registrationSummaryTime}>{startTime} - {endTime}</Text>
      </View>
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

function takeBestRecommendationPerDate(items: Recommendation[]) {
  const seenDates = new Set<string>();
  return items.filter((item) => {
    if (seenDates.has(item.date)) {
      return false;
    }
    seenDates.add(item.date);
    return true;
  });
}

function isTimeValue(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function toMinute(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function timeValueToDate(value: string) {
  const date = new Date();
  const [hour, minute] = value.split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function formatTimeValue(date: Date) {
  return formatMinuteValue(date.getHours() * 60 + date.getMinutes());
}

function formatMinuteValue(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function dateToWeekdayIndex(value: string) {
  const day = new Date(`${value}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
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
    overflow: 'hidden',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    gap: 6,
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
    color: theme.colors.primaryDark,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationSection: {
    gap: 8,
    paddingBottom: 14,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  durationChip: {
    flex: 1,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  durationChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  durationText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  durationTextSelected: {
    color: theme.colors.primaryDark,
  },
  recommendList: {
    gap: 8,
  },
  recommendItem: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 6,
  },
  recommendItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  recommendTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recommendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendDate: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  recommendDateSelected: {
    color: theme.colors.primaryDark,
  },
  recommendTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  recommendStatus: {
    alignSelf: 'flex-start',
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 64,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
  },
  datePickerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  datePickerBody: {
    flex: 1,
    gap: 2,
  },
  datePickerTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  datePickerWeekday: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerButton: {
    flex: 1,
    minHeight: 78,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  timePickerLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  timePickerValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  registrationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  registrationSummaryBody: {
    flex: 1,
    gap: 2,
  },
  registrationSummaryDate: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  registrationSummaryTime: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  iosPickerBox: {
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 8,
  },
  iosPickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  iosPickerDoneText: {
    color: theme.colors.primaryDark,
    fontWeight: '900',
  },
});
