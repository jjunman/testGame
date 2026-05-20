import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PracticeAssignmentDto, SongRoundDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, HeroBanner, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';

export function MyPracticeScreen() {
  const navigation = useNavigation<any>();
  const { currentBand } = useCurrentBand();
  const [items, setItems] = useState<PracticeAssignmentDto[]>([]);
  const [round, setRound] = useState<SongRoundDto | null>(null);

  const load = useCallback(async () => {
    if (!currentBand) {
      setItems([]);
      setRound(null);
      return;
    }

    const [assignments, currentRound] = await Promise.all([
      api.get<PracticeAssignmentDto[]>(`/bands/${currentBand.id}/practice-assignments`),
      api.get<SongRoundDto | null>(`/bands/${currentBand.id}/song-round`),
    ]);

    setItems(assignments);
    setRound(currentRound);
  }, [currentBand]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!currentBand) {
    return (
      <Screen>
        <HeroBanner title="노래" subtitle="밴드를 선택하면 합주곡과 연습 과제를 볼 수 있어요." badge="선택 필요" />
        <EmptyState title="선택된 밴드가 없어요" description="내 밴드에서 사용할 밴드를 먼저 선택해 주세요." />
        <PrimaryButton label="내 밴드로 이동" onPress={() => navigation.navigate('BandList')} />
      </Screen>
    );
  }

  const openItems = items.filter((item) => !item.hasSubmitted);

  return (
    <Screen>
      <HeroBanner
        title={`${currentBand.name} 노래`}
        subtitle="투표와 연습 과제를 한 곳에서 이어서 확인해요."
        imageUrl={currentBand.thumbnailUrl}
        badge={round?.status === 'voting' ? '투표 중' : '연습'}
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>바로가기</Text>
        <View style={styles.quickGrid}>
          <PrimaryButton label="합주곡" onPress={() => navigation.navigate('SongRound', { bandId: currentBand.id, initialTab: 'library' })} />
          <Pressable
            style={styles.secondaryRow}
            onPress={() => navigation.navigate('PracticeAssignments', { bandId: currentBand.id })}
          >
            <Text style={styles.secondaryTitle}>연습 과제 전체 보기</Text>
            <Text style={styles.secondaryMeta}>{items.length}개 과제</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>합주곡 정하기</Text>
          <StatusBadge label={round?.status === 'voting' ? '진행 중' : round ? '완료' : '대기'} tone={round?.status === 'voting' ? 'warning' : round ? 'success' : 'default'} />
        </View>
        <Text style={styles.bodyText}>
          {round?.status === 'voting' ? '후보곡을 보고 최대 2곡까지 투표할 수 있어요.' : round ? '완료된 투표는 노래 탭에서 확인할 수 있어요.' : '아직 시작된 합주곡 투표가 없어요.'}
        </Text>
        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('SongRound', { bandId: currentBand.id, initialTab: 'library' })}>
          <Text style={styles.linkText}>노래 탭 열기</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>제출 전 과제</Text>
        {openItems.length === 0 ? (
          <EmptyState title="지금 제출할 과제가 없어요" description="새 과제가 생기면 이곳에서 바로 연습 상세로 이동할 수 있어요." />
        ) : null}
        {openItems.slice(0, 3).map((item) => (
          <Pressable
            key={item.id}
            style={styles.assignmentRow}
            onPress={() =>
              navigation.navigate('PracticeAssignmentDetail', { bandId: currentBand.id, assignmentId: item.id })
            }
          >
            <View style={styles.assignmentBody}>
              <Text style={styles.assignmentTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.assignmentMeta}>마감 {new Date(item.dueAt).toLocaleString('ko-KR')}</Text>
            </View>
            <StatusBadge label="제출 필요" tone="danger" />
          </Pressable>
        ))}
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
  quickGrid: {
    gap: 8,
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
  bodyText: {
    color: theme.colors.textMuted,
    lineHeight: 19,
    fontSize: 13,
  },
  linkRow: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  assignmentBody: {
    flex: 1,
    gap: 3,
  },
  assignmentTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  assignmentMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
