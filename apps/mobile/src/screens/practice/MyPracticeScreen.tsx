import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PracticeAssignmentDto, SongRoundDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, HeroBanner, PrimaryButton, SectionCard, StatusBadge } from '../../components/UI';
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
        <HeroBanner title="노래" subtitle="먼저 밴드를 선택하면 투표와 개인 연습 흐름이 이어져요." badge="선택 필요" />
        <EmptyState title="선택된 밴드가 없어요" description="홈 탭에서 밴드를 누르면 이 탭에서 곡 투표와 연습을 바로 이어서 볼 수 있어요." />
        <PrimaryButton label="내 밴드로 이동" onPress={() => navigation.navigate('BandsTab', { screen: 'BandList' })} />
      </Screen>
    );
  }

  const openItems = items.filter((item) => !item.hasSubmitted);

  return (
    <Screen>
      <HeroBanner
        title={`${currentBand.name} 노래`}
        subtitle="합주곡 선택과 개인 연습 흐름을 한 탭에서 빠르게 오갈 수 있어요."
        imageUrl={currentBand.thumbnailUrl}
        badge={round?.status === 'voting' ? '투표 진행중' : '연습 허브'}
      />

      <SectionCard title="빠른 이동">
        <View style={styles.quickGrid}>
          <PrimaryButton label="합주곡" onPress={() => navigation.navigate('BandsTab', { screen: 'SongRound', params: { bandId: currentBand.id } })} />
          <PrimaryButton
            label="연습 과제"
            onPress={() => navigation.navigate('BandsTab', { screen: 'PracticeAssignments', params: { bandId: currentBand.id } })}
          />
        </View>
      </SectionCard>

      <SectionCard title="합주곡 정하기">
        <Text style={styles.bodyText}>
          {round
            ? round.status === 'voting'
              ? '지금은 후보곡을 보고 투표를 제출하는 단계예요.'
              : '이번 라운드는 이미 마감되어 결과를 볼 수 있어요.'
            : '아직 시작된 투표가 없어요.'}
        </Text>
        <PrimaryButton label="합주곡 페이지로" onPress={() => navigation.navigate('BandsTab', { screen: 'SongRound', params: { bandId: currentBand.id } })} />
        {round?.status === 'voting' ? (
          <PrimaryButton
            label="후보곡 추가하기"
            onPress={() => navigation.navigate('BandsTab', { screen: 'AddSongCandidate', params: { bandId: currentBand.id } })}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="제출 전 과제">
        {openItems.length === 0 ? (
          <EmptyState title="지금 제출할 과제가 없어요" description="새 과제가 생기면 여기서 바로 상세 화면으로 이동할 수 있어요." />
        ) : null}
        {openItems.slice(0, 3).map((item) => (
          <SectionCard key={item.id} title={item.title} accent="purple">
            <StatusBadge label="제출 필요" tone="danger" />
            <Text style={styles.bodyText}>마감 {new Date(item.dueAt).toLocaleString('ko-KR')}</Text>
            <PrimaryButton
              label="과제 상세 보기"
              onPress={() =>
                navigation.navigate('BandsTab', {
                  screen: 'PracticeAssignmentDetail',
                  params: { bandId: currentBand.id, assignmentId: item.id },
                })
              }
            />
          </SectionCard>
        ))}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quickGrid: {
    gap: 10,
  },
  bodyText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});
