import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleSlotDto } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import {
  formatHour,
  getCurrentWeekDates,
  isScheduleHour,
  parseSlotKey,
  SCHEDULE_HOURS,
  slotKey,
  WEEK_LABELS,
} from '../../components/ScheduleAvailability';
import { Screen } from '../../components/Screen';
import { HeroBanner, PrimaryButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'ScheduleEdit'>;

type TimeChip = {
  date: string;
  hour: number;
  key: string;
  slot?: ScheduleSlotDto;
};

type DayTransition = {
  from: number;
  to: number;
  direction: 1 | -1;
};

export function ScheduleEditScreen({ route, navigation }: Props) {
  const { bandId, initialDayIndex = 0 } = route.params;
  const [slots, setSlots] = useState<ScheduleSlotDto[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedDayIndex, setSelectedDayIndex] = useState(Math.min(Math.max(initialDayIndex, 0), 6));
  const [submitting, setSubmitting] = useState(false);
  const [renderedDayIndex, setRenderedDayIndex] = useState(Math.min(Math.max(initialDayIndex, 0), 6));
  const [dayTransition, setDayTransition] = useState<DayTransition | null>(null);
  const chipProgress = useRef(new Animated.Value(1)).current;

  const weekDates = useMemo(() => getCurrentWeekDates(), []);

  const load = useCallback(async () => {
    const nextSlots = await api.get<ScheduleSlotDto[]>(`/bands/${bandId}/schedule-slots`);
    setSlots(nextSlots.map((slot) => ({
      ...slot,
      availableMembers: (slot.availableMembers ?? []).map((member) => ({
        ...member,
        profileImageUrl: toApiAssetUrl(member.profileImageUrl),
      })),
    })));
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const visibleSlots = useMemo(() => {
    return slots.filter((slot) => weekDates.includes(slot.date) && isScheduleHour(Number(slot.startTime.slice(0, 2))));
  }, [slots, weekDates]);

  useEffect(() => {
    setSelectedKeys(
      new Set(
        visibleSlots
          .filter((slot) => slot.myAvailability === 'yes')
          .map((slot) => slotKey(slot.date, Number(slot.startTime.slice(0, 2)))),
      ),
    );
  }, [visibleSlots]);

  const slotsByKey = useMemo(() => {
    return new Map(visibleSlots.map((slot) => [slotKey(slot.date, Number(slot.startTime.slice(0, 2))), slot]));
  }, [visibleSlots]);

  const dayCounts = useMemo(() => {
    return weekDates.map((date) => {
      return SCHEDULE_HOURS.filter((hour) => selectedKeys.has(slotKey(date, hour))).length;
    });
  }, [selectedKeys, weekDates]);

  const buildDayChips = useCallback((dayIndex: number) => {
    const selectedDate = weekDates[dayIndex];
    return SCHEDULE_HOURS.map((hour) => {
      const key = slotKey(selectedDate, hour);
      const slot = slotsByKey.get(key);
      return { date: selectedDate, hour, key, slot };
    });
  }, [slotsByKey, weekDates]);

  const selectedDayChips = useMemo(() => {
    return buildDayChips(renderedDayIndex);
  }, [buildDayChips, renderedDayIndex]);

  const outgoingDayChips = useMemo(() => {
    return dayTransition ? buildDayChips(dayTransition.from) : [];
  }, [buildDayChips, dayTransition]);

  const incomingDayChips = useMemo(() => {
    return dayTransition ? buildDayChips(dayTransition.to) : selectedDayChips;
  }, [buildDayChips, dayTransition, selectedDayChips]);

  const toggleChip = (chip: TimeChip) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(chip.key)) {
        next.delete(chip.key);
      } else {
        next.add(chip.key);
      }
      return next;
    });
  };

  const selectDay = (index: number) => {
    if (index === selectedDayIndex) {
      return;
    }

    const direction: 1 | -1 = index > selectedDayIndex ? 1 : -1;
    chipProgress.stopAnimation();
    setDayTransition({ from: renderedDayIndex, to: index, direction });
    setSelectedDayIndex(index);
    chipProgress.setValue(0);

    Animated.timing(chipProgress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRenderedDayIndex(index);
      setDayTransition(null);
      chipProgress.setValue(1);
    });
  };

  const submitMyTimes = async () => {
    setSubmitting(true);
    try {
      const selectedCells = Array.from(selectedKeys).map(parseSlotKey);
      const selectedKeySet = new Set(selectedKeys);
      const removedSlots = visibleSlots.filter((slot) => {
        const key = slotKey(slot.date, Number(slot.startTime.slice(0, 2)));
        return slot.myAvailability === 'yes' && !selectedKeySet.has(key);
      });

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
      <HeroBanner title="가능한 시간 등록" align="center" />

      <View style={styles.section}>
        <View style={styles.dayTabs}>
          {weekDates.map((date, index) => {
            const selected = selectedDayIndex === index;
            return (
              <Pressable
                key={date}
                onPress={() => selectDay(index)}
                style={[styles.dayTab, selected && styles.dayTabSelected]}
              >
                <Text style={[styles.dayTabLabel, selected && styles.dayTabLabelSelected]}>{WEEK_LABELS[index]}</Text>
                {dayCounts[index] > 0 ? (
                  <View style={[styles.dayTabCount, selected && styles.dayTabCountSelected]}>
                    <Text style={[styles.dayTabCountText, selected && styles.dayTabCountTextSelected]}>{dayCounts[index]}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {dayTransition ? (
          <View style={styles.chipStage} pointerEvents="none">
            <Animated.View
              style={[
                styles.chipLayer,
                {
                  opacity: chipProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                  transform: [
                    {
                      translateX: chipProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -dayTransition.direction * 140],
                      }),
                    },
                  ],
                },
              ]}
            >
              {renderChipGrid(outgoingDayChips, selectedKeys, toggleChip)}
            </Animated.View>
            <Animated.View
              style={[
                styles.chipLayer,
                {
                  opacity: chipProgress,
                  transform: [
                    {
                      translateX: chipProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [dayTransition.direction * 140, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {renderChipGrid(incomingDayChips, selectedKeys, toggleChip)}
            </Animated.View>
          </View>
        ) : (
          renderChipGrid(selectedDayChips, selectedKeys, toggleChip)
        )}

        <PrimaryButton label="저장하기" onPress={submitMyTimes} loading={submitting} />
      </View>
    </Screen>
  );
}

function renderChipGrid(chips: TimeChip[], selectedKeys: Set<string>, onToggle: (chip: TimeChip) => void) {
  return (
    <View style={styles.chipGrid}>
      {chips.map((chip) => {
        const selected = selectedKeys.has(chip.key);
        return (
          <Pressable
            key={chip.key}
            onPress={() => onToggle(chip)}
            style={[
              styles.timeChip,
              selected && styles.timeChipSelected,
            ]}
          >
            <View style={styles.timeChipTextBlock}>
              <Text style={[styles.timeChipText, selected && styles.timeChipTextStrong]}>
                {formatHour(chip.hour)}
              </Text>
            <Text style={styles.timeChipSubtext}>{`~${formatHour(chip.hour + 1)}`}</Text>
            </View>
            <AvailableMemberAvatars members={chip.slot?.availableMembers ?? []} />
          </Pressable>
        );
      })}
    </View>
  );
}

function AvailableMemberAvatars({ members }: { members: ScheduleSlotDto['availableMembers'] }) {
  const visibleMembers = members.slice(0, 3);
  const hiddenCount = Math.max(0, members.length - visibleMembers.length);

  if (members.length === 0) {
    return null;
  }

  return (
    <View style={styles.availableAvatarStack}>
      {visibleMembers.map((member, index) => (
        <View key={member.userId} style={[styles.availableAvatar, index > 0 && styles.availableAvatarOverlap]}>
          {member.profileImageUrl ? (
            <Image source={{ uri: member.profileImageUrl }} style={styles.availableAvatarImage} />
          ) : (
            <Text style={styles.availableAvatarInitial}>{member.name.slice(0, 1)}</Text>
          )}
        </View>
      ))}
      {hiddenCount > 0 ? (
        <View style={[styles.availableAvatar, styles.availableAvatarOverlap, styles.availableAvatarMore]}>
          <Text style={styles.availableAvatarMoreText}>+{hiddenCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  dayTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  dayTab: {
    flex: 1,
    minHeight: 62,
    minWidth: 0,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 7,
  },
  dayTabSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  dayTabLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  dayTabLabelSelected: {
    color: '#fff',
  },
  dayTabCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  dayTabCountSelected: {
    backgroundColor: '#fff',
  },
  dayTabCountText: {
    color: theme.colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
  },
  dayTabCountTextSelected: {
    color: theme.colors.primaryDark,
  },
  chipStage: {
    minHeight: 352,
    overflow: 'hidden',
  },
  chipLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    width: '31.8%',
    minHeight: 64,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  timeChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  timeChipTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  timeChipText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  timeChipTextStrong: {
    color: theme.colors.text,
  },
  timeChipSubtext: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  availableAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 22,
  },
  availableAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  availableAvatarOverlap: {
    marginLeft: -7,
  },
  availableAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  availableAvatarInitial: {
    color: theme.colors.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },
  availableAvatarMore: {
    backgroundColor: theme.colors.primary,
  },
  availableAvatarMoreText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
});
