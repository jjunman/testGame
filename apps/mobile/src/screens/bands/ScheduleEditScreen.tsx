import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleSlotDto, ScheduleSummaryDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { HeroBanner, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'ScheduleEdit'>;
type TimeCell = {
  date: string;
  hour: number;
  key: string;
  slot?: ScheduleSlotDto;
};

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const AFTERNOON_HOURS = Array.from({ length: 12 }, (_, index) => index + 12);
const MORNING_HOURS = Array.from({ length: 12 }, (_, index) => index);

export function ScheduleEditScreen({ route, navigation }: Props) {
  const { bandId, period } = route.params;
  const [slots, setSlots] = useState<ScheduleSlotDto[]>([]);
  const [summary, setSummary] = useState<ScheduleSummaryDto[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const load = useCallback(async () => {
    const [nextSlots, nextSummary] = await Promise.all([
      api.get<ScheduleSlotDto[]>(`/bands/${bandId}/schedule-slots`),
      api.get<ScheduleSummaryDto[]>(`/bands/${bandId}/schedule-summary`),
    ]);
    setSlots(nextSlots);
    setSummary(nextSummary);
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  useEffect(() => {
    setSelectedKeys(new Set(slots.filter((slot) => slot.myAvailability === 'yes').map((slot) => slotKey(slot.date, Number(slot.startTime.slice(0, 2))))));
  }, [slots]);

  const slotsByKey = useMemo(() => {
    return new Map(slots.map((slot) => [slotKey(slot.date, Number(slot.startTime.slice(0, 2))), slot]));
  }, [slots]);

  const summaryBySlotId = useMemo(() => {
    return new Map(summary.map((item) => [item.slotId, item]));
  }, [summary]);

  const editorTitle = period === 'morning' ? '오전 시간 맞추기' : '오후 시간 맞추기';
  const editorHours = period === 'morning' ? MORNING_HOURS : AFTERNOON_HOURS;
  const editorTableTitle = period === 'morning' ? '새벽/오전' : '오후 가능 시간';
  const selectedCount = selectedKeys.size;

  const toggleCell = (cell: TimeCell) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(cell.key)) {
        next.delete(cell.key);
      } else {
        next.add(cell.key);
      }
      return next;
    });
  };

  const submitMyTimes = async () => {
    setSubmitting(true);
    try {
      const selectedCells = Array.from(selectedKeys).map(parseSlotKey);
      const selectedKeySet = new Set(selectedKeys);
      const currentWeekMySlots = slots.filter((slot) => weekDates.includes(slot.date) && slot.myAvailability === 'yes');
      const removedSlots = currentWeekMySlots.filter((slot) => !selectedKeySet.has(slotKey(slot.date, Number(slot.startTime.slice(0, 2)))));

      await Promise.all([
        ...selectedCells.map((cell) =>
          api.post(`/bands/${bandId}/schedule-slots`, {
            date: cell.date,
            startTime: formatHour(cell.hour),
            endTime: formatHour(cell.hour + 1),
          }),
        ),
        ...removedSlots.map((slot) => api.post(`/bands/${bandId}/schedule-availabilities`, { slotId: slot.id, availability: 'no' })),
      ]);
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="calendar" navigation={navigation} />}>
      <HeroBanner title={editorTitle} subtitle="가능한 시간을 크게 눌러서 저장해요." badge="edit" align="center" />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>내 가능 시간</Text>
          <StatusBadge label={`${selectedCount}칸 선택`} tone={selectedCount > 0 ? 'success' : 'warning'} />
        </View>
        <Text style={styles.caption}>가능한 시간을 표에서 눌러 선택해 주세요. 저장하면 DB에 시간 셀로 쌓이고 모두 가능한 시간이 자동으로 계산돼요.</Text>

        <View style={styles.legendItems}>
          <LegendDot color={theme.colors.primary} label="모두 가능" />
          <LegendDot color={theme.colors.primarySoft} label="내 선택" />
          <LegendDot color="#fff" label="미선택" bordered />
        </View>

        <TimeTable
          title={editorTableTitle}
          dates={weekDates}
          hours={editorHours}
          selectedKeys={selectedKeys}
          slotsByKey={slotsByKey}
          summaryBySlotId={summaryBySlotId}
          onToggle={toggleCell}
        />

        <PrimaryButton label="확인" onPress={submitMyTimes} loading={submitting} />
      </View>
    </Screen>
  );
}

function TimeTable({
  title,
  dates,
  hours,
  selectedKeys,
  slotsByKey,
  summaryBySlotId,
  onToggle,
}: {
  title: string;
  dates: string[];
  hours: number[];
  selectedKeys: Set<string>;
  slotsByKey: Map<string, ScheduleSlotDto>;
  summaryBySlotId: Map<string, ScheduleSummaryDto>;
  onToggle: (cell: TimeCell) => void;
}) {
  return (
    <View style={styles.tableCard}>
      <Text style={styles.tableTitle}>{title}</Text>
      <View>
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
              const key = slotKey(date, hour);
              const slot = slotsByKey.get(key);
              const summary = slot ? summaryBySlotId.get(slot.id) : undefined;
              const selected = selectedKeys.has(key);
              const allAvailable = summary?.allAvailable;
              const showMatched = Boolean(allAvailable && selected);

              return (
                <Pressable
                  key={key}
                  onPress={() => onToggle({ date, hour, key, slot })}
                  style={[styles.gridCell, selected && styles.gridCellSelected, showMatched && styles.gridCellMatched]}
                />
              );
            })}
          </View>
        ))}
      </View>
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

function slotKey(date: string, hour: number) {
  return `${date}T${String(hour).padStart(2, '0')}`;
}

function parseSlotKey(key: string) {
  const [date, hourValue] = key.split('T');
  return { date, hour: Number(hourValue) };
}

function formatHour(hour: number) {
  return `${String(hour % 24).padStart(2, '0')}:00`;
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: theme.colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
  },
  caption: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    borderColor: theme.colors.primarySoft,
  },
  legendText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tableCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 12,
    gap: 8,
  },
  tableTitle: {
    color: theme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  gridHeader: {
    flexDirection: 'row',
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  timeLabel: {
    width: 40,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  dayLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  gridCell: {
    flex: 1,
    height: 34,
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
});
