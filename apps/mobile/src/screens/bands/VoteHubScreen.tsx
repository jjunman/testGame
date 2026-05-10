import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScheduleProposalDto, SongRoundDto, StudioCandidateDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { HeroBanner, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'VoteHub'>;
type VoteTone = 'need' | 'done' | 'none';

export function VoteHubScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [round, setRound] = useState<SongRoundDto | null>(null);
  const [proposal, setProposal] = useState<ScheduleProposalDto | null>(null);
  const [studios, setStudios] = useState<StudioCandidateDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRound, nextProposal, nextStudios] = await Promise.all([
        api.get<SongRoundDto | null>(`/bands/${bandId}/song-round`),
        api.get<ScheduleProposalDto | null>(`/bands/${bandId}/schedule-proposal`),
        api.get<StudioCandidateDto[]>(`/bands/${bandId}/studio-candidates`),
      ]);
      setRound(nextRound);
      setProposal(nextProposal);
      setStudios(nextStudios);
    } catch (error) {
      Alert.alert('투표 불러오기 실패', error instanceof Error ? error.message : '투표 현황을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const cards = useMemo(() => {
    const songVoting = round?.status === 'voting';
    const songVoted = round?.candidates.some((candidate) => candidate.didVote) ?? false;
    const activeProposal = proposal?.active ? proposal : null;
    const activeStudioCandidates = studios.filter((candidate) => candidate.status === 'open');
    const hasStudioCandidates = activeStudioCandidates.length > 0;
    const studioVoted = activeStudioCandidates.some((candidate) => candidate.didVote);
    const studioConfirmed = studios.some((candidate) => candidate.status === 'confirmed');

    return [
      {
        title: '합주곡 투표',
        description: songVoting
          ? songVoted
            ? '내 선택이 반영되어 있어요.'
            : '후보곡 중 최대 2곡을 골라 주세요.'
          : '진행 중인 합주곡 투표가 없어요.',
        status: songVoting ? (songVoted ? '완료' : '투표 필요') : '진행 없음',
        tone: songVoting ? (songVoted ? 'done' : 'need') : 'none',
        onPress: () => navigation.navigate('SongRound', { bandId }),
      },
      {
        title: '합주 시간 투표',
        description: activeProposal
          ? activeProposal.myAvailability
            ? '찬반 응답이 저장되어 있어요.'
            : '제안된 합주 시간이 괜찮은지 응답해 주세요.'
          : proposal?.confirmed
            ? '합주 시간이 확정되었어요.'
            : '진행 중인 합주 시간 투표가 없어요.',
        status: activeProposal ? (activeProposal.myAvailability ? '완료' : '투표 필요') : proposal?.confirmed ? '완료' : '진행 없음',
        tone: activeProposal ? (activeProposal.myAvailability ? 'done' : 'need') : proposal?.confirmed ? 'done' : 'none',
        onPress: () => navigation.navigate('Schedule', { bandId }),
      },
      {
        title: '합주실 투표',
        description: studioConfirmed
          ? '합주실이 확정되었어요.'
          : hasStudioCandidates
            ? studioVoted
              ? '내 합주실 선택이 반영되어 있어요.'
              : '후보 합주실 중 하나를 선택해 주세요.'
            : '아직 합주실 후보가 없어요.',
        status: studioConfirmed ? '완료' : hasStudioCandidates ? (studioVoted ? '완료' : '투표 필요') : '진행 없음',
        tone: studioConfirmed ? 'done' : hasStudioCandidates ? (studioVoted ? 'done' : 'need') : 'none',
        onPress: () => navigation.navigate('Studios', { bandId }),
      },
    ] satisfies Array<{
      title: string;
      description: string;
      status: string;
      tone: VoteTone;
      onPress: () => void;
    }>;
  }, [bandId, navigation, proposal, round, studios]);

  const needCount = cards.filter((card) => card.tone === 'need').length;

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="home" navigation={navigation} />}>
      <HeroBanner
        title="투표 모아보기"
        subtitle={loading ? '투표 현황을 불러오는 중이에요.' : needCount > 0 ? `${needCount}개 투표가 기다리고 있어요.` : '지금 필요한 투표를 모두 확인했어요.'}
        badge="vote"
        align="center"
      />

      <View style={styles.list}>
        {cards.map((card) => (
          <Pressable key={card.title} style={[styles.card, card.tone === 'need' && styles.cardNeed]} onPress={card.onPress}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <StatusBadge label={card.status} tone={toBadgeTone(card.tone)} />
            </View>
            <Text style={styles.cardDescription}>{card.description}</Text>
            <Text style={styles.cardAction}>바로가기</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function toBadgeTone(tone: VoteTone) {
  if (tone === 'need') {
    return 'danger';
  }
  if (tone === 'done') {
    return 'success';
  }
  return 'default';
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 10,
  },
  cardNeed: {
    borderColor: theme.colors.primary,
    backgroundColor: '#f7f1ff',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.primaryDark,
    fontSize: 18,
    fontWeight: '900',
  },
  cardDescription: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  cardAction: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
});
