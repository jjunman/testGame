import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BandHomeDto, PracticeAssignmentDto } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, LoadingState, StatusBadge } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'SongPracticeDetail'>;

export function SongPracticeDetailScreen({ route, navigation }: Props) {
  const { bandId, songCandidateId } = route.params;
  const [band, setBand] = useState<BandHomeDto | null>(null);
  const [assignments, setAssignments] = useState<PracticeAssignmentDto[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    const [nextBand, nextAssignments] = await Promise.all([
      api.get<BandHomeDto>(`/bands/${bandId}`),
      api.get<PracticeAssignmentDto[]>(`/bands/${bandId}/practice-assignments`),
    ]);
    setBand(nextBand);
    setAssignments(nextAssignments.filter((assignment) => assignment.songCandidateId === songCandidateId));
  }, [bandId, songCandidateId]);

  useEffect(() => navigation.addListener('focus', () => void load()), [load, navigation]);

  const song = useMemo(
    () => band?.songCards.find((card) => card.id === songCandidateId && card.kind === 'song') ?? null,
    [band?.songCards, songCandidateId],
  );
  const pendingAssignments = useMemo(
    () => assignments
      .filter((assignment) => assignment.status === 'open' && !assignment.hasSubmitted)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [assignments],
  );
  const historyAssignments = useMemo(
    () => assignments
      .filter((assignment) => assignment.status === 'closed' || assignment.hasSubmitted)
      .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime()),
    [assignments],
  );

  if (!band || !song) {
    return <Screen><LoadingState /></Screen>;
  }

  const imageUrl = toApiAssetUrl(song.thumbnailUrl) || fallbackBandImage;

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
      <ImageBackground source={{ uri: imageUrl }} imageStyle={styles.heroImage} style={styles.hero}>
        <View style={styles.heroOverlay} />
        <View style={styles.heroText}>
          <Text style={styles.heroKicker}>곡별 연습 메인</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{song.title}</Text>
          <Text style={styles.heroArtist} numberOfLines={1}>{song.artist}</Text>
        </View>
      </ImageBackground>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>해야 할 연습</Text>
            <Text style={styles.sectionSubtitle}>{pendingAssignments.length}개의 연습</Text>
          </View>
          <Pressable
            accessibilityLabel="새 연습 만들기"
            hitSlop={8}
            style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
            onPress={() => navigation.navigate('CreatePracticeAssignment', { bandId, songCandidateId })}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>
        {pendingAssignments.length > 0 ? (
          <AssignmentList
            assignments={pendingAssignments}
            onOpen={(assignmentId) => navigation.navigate('PracticeAssignmentDetail', { bandId, assignmentId })}
          />
        ) : (
          <EmptyState title="지금 해야 할 연습이 없어요" description="새 연습을 만들거나 지난 연습을 확인할 수 있어요." />
        )}
      </View>

      {historyAssignments.length > 0 ? (
        <View style={styles.section}>
          <Pressable style={styles.historyToggle} onPress={() => setShowHistory((current) => !current)}>
            <View>
              <Text style={styles.sectionTitle}>지난 연습</Text>
              <Text style={styles.historyMeta}>{historyAssignments.length}개의 완료·마감 연습</Text>
            </View>
            <Ionicons name={showHistory ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textMuted} />
          </Pressable>
          {showHistory ? (
            <AssignmentList
              assignments={historyAssignments}
              onOpen={(assignmentId) => navigation.navigate('PracticeAssignmentDetail', { bandId, assignmentId })}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function AssignmentList({
  assignments,
  onOpen,
}: {
  assignments: PracticeAssignmentDto[];
  onOpen: (assignmentId: string) => void;
}) {
  return (
    <View style={styles.assignmentList}>
      {assignments.map((assignment) => {
        const closed = assignment.status === 'closed';
        const statusLabel = closed ? '마감' : assignment.hasSubmitted ? '제출 완료' : '제출 필요';
        const statusTone = closed ? 'default' : assignment.hasSubmitted ? 'success' : 'danger';
        return (
          <Pressable
            key={assignment.id}
            style={({ pressed }) => [styles.assignmentItem, pressed && styles.assignmentItemPressed]}
            onPress={() => onOpen(assignment.id)}
          >
            <View style={[styles.assignmentIcon, assignment.hasSubmitted && styles.assignmentIconDone, closed && styles.assignmentIconClosed]}>
              <Ionicons
                name={closed ? 'time-outline' : assignment.hasSubmitted ? 'checkmark' : 'musical-notes-outline'}
                size={19}
                color={closed ? theme.colors.textMuted : assignment.hasSubmitted ? theme.colors.success : theme.colors.primaryDark}
              />
            </View>
            <View style={styles.assignmentBody}>
              <View style={styles.assignmentTitleRow}>
                <Text style={styles.assignmentTitle} numberOfLines={1}>{assignment.title}</Text>
                <StatusBadge label={statusLabel} tone={statusTone} />
              </View>
              <Text style={styles.assignmentMeta} numberOfLines={1}>
                {formatDueDate(assignment.dueAt)} · {formatRange(assignment.startSec, assignment.endSec)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

function formatDueDate(value: string) {
  return `마감 ${new Date(value).toLocaleDateString('ko-KR')}`;
}

function formatRange(startSec: number | null, endSec: number | null) {
  if (startSec === null && endSec === null) {
    return '전체 구간';
  }
  return `${startSec ?? 0}초 - ${endSec ?? '끝'}초`;
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 176,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#24262d',
  },
  heroImage: {
    borderRadius: 8,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 18, 24, 0.58)',
  },
  heroText: {
    padding: 16,
    gap: 3,
  },
  heroKicker: {
    color: '#d8d2ff',
    fontSize: 11,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '900',
  },
  heroArtist: {
    color: '#e3e5e9',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  createButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonPressed: {
    backgroundColor: theme.colors.primaryDark,
  },
  assignmentList: {
    gap: 9,
  },
  assignmentItem: {
    minHeight: 86,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  assignmentItemPressed: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  assignmentIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentIconDone: {
    backgroundColor: theme.colors.accentSoft,
  },
  assignmentIconClosed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  assignmentBody: {
    flex: 1,
    gap: 4,
  },
  assignmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignmentTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  assignmentMeta: {
    color: theme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  historyToggle: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  historyMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
});
