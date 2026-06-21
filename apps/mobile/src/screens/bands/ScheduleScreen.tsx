import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScheduleProposalDto, ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { getCurrentWeekDates, isScheduleHour, toMinute } from '../../components/ScheduleAvailability';
import { Screen } from '../../components/Screen';
import { HeroBanner } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Schedule'>;

export function ScheduleScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [summary, setSummary] = useState<ScheduleSummaryDto[]>([]);
  const [schedules, setSchedules] = useState<ScheduleProposalDto[]>([]);

  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const load = useCallback(async () => {
    const [nextSummary, nextSchedules] = await Promise.all([
      api.get<ScheduleSummaryDto[]>(`/bands/${bandId}/schedule-summary`),
      api.get<ScheduleProposalDto[]>(`/bands/${bandId}/schedule-events`),
    ]);
    setSummary(nextSummary);
    setSchedules(nextSchedules);
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const allAvailableSlotKeys = useMemo(() => {
    return new Set(
      summary
        .filter((item) => item.allAvailable && isVisibleSummary(item, weekDates))
        .map((item) => `${item.date}-${Math.floor(toMinute(item.startTime) / 60)}`),
    );
  }, [summary, weekDates]);

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
          label="합주 등록하기"
          onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>다가오는 합주</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('CreateScheduleSlot', { bandId })}>
            <Ionicons name="add-circle" size={25} color={theme.colors.primary} />
          </Pressable>
        </View>
        {schedules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>등록된 합주 일정이 없어요</Text>
          </View>
        ) : null}
        {schedules.map((schedule) => {
          const dateParts = getScheduleDateParts(schedule.date);
          return (
            <View key={schedule.id} style={styles.registeredSchedule}>
              <View style={styles.registeredDateBlock}>
                <Text style={styles.registeredMonth}>{dateParts.month}</Text>
                <Text style={styles.registeredDateNumber}>{dateParts.day}</Text>
              </View>
              <View style={styles.registeredBody}>
                <Text style={styles.registeredWeekday}>{dateParts.weekday}요일 합주</Text>
                <Text style={styles.registeredTime}>{schedule.startTime} - {schedule.endTime}</Text>
              </View>
              <View style={styles.registeredStatusIcon}>
                <Ionicons name="calendar-clear" size={18} color={theme.colors.success} />
              </View>
            </View>
          );
        })}
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
                        style={[styles.scheduleCell, isAllAvailable && styles.scheduleCellAvailable]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
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

function getScheduleDateParts(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return {
    month: `${parsed.getMonth() + 1}월`,
    day: String(parsed.getDate()),
    weekday: weekdayLabel(date),
  };
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  registeredSchedule: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  registeredDateBlock: {
    width: 58,
    height: 62,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    gap: 1,
  },
  registeredMonth: {
    color: theme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  registeredDateNumber: {
    color: theme.colors.primaryDark,
    fontSize: 25,
    fontWeight: '900',
  },
  registeredBody: {
    flex: 1,
    gap: 3,
  },
  registeredWeekday: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  registeredTime: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  registeredStatusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
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
});
