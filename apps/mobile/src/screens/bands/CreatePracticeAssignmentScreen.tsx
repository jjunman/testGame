import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BandHomeDto, BandSongCardDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, Field, HeroBanner, Label, PrimaryButton, SectionCard } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'CreatePracticeAssignment'>;

function getDefaultDueDate() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toDueDateOnly(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function CreatePracticeAssignmentScreen({ route, navigation }: Props) {
  const { bandId, songCandidateId } = route.params;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [startSec, setStartSec] = useState('');
  const [endSec, setEndSec] = useState('');
  const [songCards, setSongCards] = useState<BandSongCardDto[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const detail = await api.get<BandHomeDto>(`/bands/${bandId}`);
        if (!alive) {
          return;
        }
        const songs = detail.songCards.filter((card) => card.kind === 'song');
        setSongCards(songs);
        setSelectedSongId((current) => current ?? songCandidateId ?? songs[0]?.id ?? null);
      } catch {
        if (alive) {
          setSongCards([]);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [bandId, songCandidateId]);

  const selectedSong = useMemo(
    () => songCards.find((song) => song.id === selectedSongId) ?? null,
    [selectedSongId, songCards],
  );

  const selectedDue = useMemo(() => {
    if (!dueAt) {
      return null;
    }
    const parsed = new Date(dueAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [dueAt]);

  useEffect(() => {
    if (songCandidateId && selectedSong && !title.trim()) {
      setTitle(`${selectedSong.title} 개인 연습`);
    }
  }, [selectedSong, songCandidateId, title]);

  const duePreview = useMemo(() => {
    if (!dueAt) {
      return '아직 마감일을 정하지 않았어요.';
    }
    const parsed = new Date(dueAt);
    if (Number.isNaN(parsed.getTime())) {
      return '마감 날짜를 다시 선택해 주세요.';
    }
    return `설정된 마감일: ${parsed.toLocaleDateString('ko-KR')}`;
  }, [dueAt]);

  const setQuickDueDate = (days: number) => {
    const next = new Date();
    next.setDate(next.getDate() + days);
    setDueAt(toDueDateOnly(next).toISOString());
  };

  const openDueDatePicker = () => {
    const current = selectedDue ?? getDefaultDueDate();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (dateEvent, pickedDate) => {
          if (dateEvent.type !== 'set' || !pickedDate) {
            return;
          }
          setDueAt(toDueDateOnly(pickedDate).toISOString());
        },
      });
      return;
    }

    setShowIosDatePicker(true);
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('입력 필요', '과제 제목을 입력해 주세요.');
      return;
    }
    if (!dueAt.trim()) {
      Alert.alert('입력 필요', '마감일을 정해 주세요.');
      return;
    }
    if (Number.isNaN(new Date(dueAt).getTime())) {
      Alert.alert('마감일 확인', '마감 날짜를 다시 선택해 주세요.');
      return;
    }
    if ((startSec && Number.isNaN(Number(startSec))) || (endSec && Number.isNaN(Number(endSec)))) {
      Alert.alert('구간 확인', '연습 구간은 숫자로 입력해 주세요.');
      return;
    }
    if (startSec && endSec && Number(endSec) <= Number(startSec)) {
      Alert.alert('구간 확인', '종료 초는 시작 초보다 커야 해요.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/bands/${bandId}/practice-assignments`, {
        songCandidateId: selectedSongId ?? undefined,
        title: title.trim(),
        description: description.trim(),
        dueAt,
        startSec: startSec ? Number(startSec) : undefined,
        endSec: endSec ? Number(endSec) : undefined,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('생성 실패', error instanceof Error ? error.message : '연습 과제를 만들지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <HeroBanner
        title="연습 과제 만들기"
        subtitle="연습 구간과 마감일을 정하고 바로 연습을 시작해요."
      />

      <SectionCard title="과제 정보">
        {songCandidateId && selectedSong ? (
          <View style={styles.linkedSongBox}>
            <Text style={styles.linkedSongLabel}>연습 곡</Text>
            <Text style={styles.linkedSongTitle} numberOfLines={1}>{selectedSong.title}</Text>
            <Text style={styles.linkedSongArtist} numberOfLines={1}>{selectedSong.artist}</Text>
          </View>
        ) : (
          <>
        <Label>합주곡 연결</Label>
        {songCards.length === 0 ? (
          <EmptyState
            title="확정된 합주곡이 없어요"
            description="먼저 합주곡 투표를 끝내면 과제를 곡 카드와 연결할 수 있어요."
          />
        ) : (
          <View style={styles.songList}>
            {songCards.map((song) => {
              const selected = song.id === selectedSongId;
              return (
                <Pressable
                  key={song.id}
                  style={[styles.songOption, selected && styles.songOptionSelected]}
                  onPress={() => {
                    setSelectedSongId(song.id);
                    if (!title.trim()) {
                      setTitle(`${song.title} 개인 연습`);
                    }
                  }}
                >
                  <View style={styles.songOptionBody}>
                    <Text style={[styles.songTitle, selected && styles.songTitleSelected]} numberOfLines={1}>
                      {song.title}
                    </Text>
                    <Text style={[styles.songArtist, selected && styles.songArtistSelected]} numberOfLines={1}>
                      {song.artist}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {selectedSong ? <Text style={styles.helpText}>홈의 {selectedSong.title} 카드에서 이 연습 과제로 바로 이동하게 돼요.</Text> : null}
          </>
        )}

        <Label>제목</Label>
        <Field value={title} onChangeText={setTitle} placeholder="예: 후렴 리듬 정리" />

        <Label>설명</Label>
        <Field
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="추가로 설명할 부분을 적어주세요"
        />

        <Label>마감일 빠른 선택</Label>
        <View style={styles.quickRow}>
          <QuickChip label="내일" onPress={() => setQuickDueDate(1)} />
          <QuickChip label="3일 뒤" onPress={() => setQuickDueDate(3)} />
          <QuickChip label="일주일 뒤" onPress={() => setQuickDueDate(7)} />
        </View>

        <Label>직접 정하기</Label>
        <Pressable style={styles.datePickerButton} onPress={openDueDatePicker}>
          <View style={styles.datePickerIcon}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.primaryDark} />
          </View>
          <View style={styles.datePickerTextBox}>
            <Text style={styles.datePickerTitle}>{selectedDue ? selectedDue.toLocaleDateString('ko-KR') : '날짜 선택'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>
        {showIosDatePicker ? (
          <View style={styles.iosPickerBox}>
            <DateTimePicker
              value={selectedDue ?? getDefaultDueDate()}
              mode="date"
              display="inline"
              onChange={(_, pickedDate) => {
                if (pickedDate) {
                  setDueAt(toDueDateOnly(pickedDate).toISOString());
                }
              }}
            />
            <Pressable style={styles.iosPickerDoneButton} onPress={() => setShowIosDatePicker(false)}>
              <Text style={styles.iosPickerDoneText}>완료</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.helpText}>{duePreview}</Text>

        <Label>연습 시작 초</Label>
        <Field value={startSec} onChangeText={setStartSec} keyboardType="numeric" placeholder="예: 30" />

        <Label>연습 종료 초</Label>
        <Field value={endSec} onChangeText={setEndSec} keyboardType="numeric" placeholder="예: 60" />
        <Text style={styles.helpText}>예: 30초부터 60초까지 연습시키고 싶다면 30 / 60으로 입력하면 돼요.</Text>

        <PrimaryButton label="과제 생성하기" onPress={() => void submit()} loading={submitting} />
      </SectionCard>
    </Screen>
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickChip} onPress={onPress}>
      <Text style={styles.quickChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  songList: {
    gap: 8,
  },
  linkedSongBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    padding: 12,
    gap: 4,
  },
  linkedSongLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  linkedSongTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  linkedSongArtist: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  songOption: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  songOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  songOptionBody: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  songTitleSelected: {
    color: '#fff',
  },
  songArtist: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  songArtistSelected: {
    color: 'rgba(255,255,255,0.82)',
  },
  quickChip: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: theme.colors.primarySoft,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickChipText: {
    color: theme.colors.primaryDark,
    fontWeight: '800',
  },
  datePickerButton: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePickerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerTextBox: {
    flex: 1,
  },
  datePickerTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  iosPickerBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  iosPickerDoneButton: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  iosPickerDoneText: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  helpText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
