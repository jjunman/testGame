import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SongRoundDto, StudioCandidateDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'VoteHub'>;
type VoteTone = 'need' | 'done' | 'none' | 'changeable';

export function VoteHubScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [round, setRound] = useState<SongRoundDto | null>(null);
  const [studios, setStudios] = useState<StudioCandidateDto[]>([]);

  const load = useCallback(async () => {
    try {
      const [nextRound, nextStudios] = await Promise.all([
        api.get<SongRoundDto | null>(`/bands/${bandId}/song-round`),
        api.get<StudioCandidateDto[]>(`/bands/${bandId}/studio-candidates`),
      ]);
      setRound(nextRound);
      setStudios(nextStudios);
    } catch (error) {
      Alert.alert('투표 불러오기 실패', error instanceof Error ? error.message : '투표 현황을 불러오지 못했어요.');
    }
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const cards = useMemo(() => {
    const songVoting = round?.status === 'voting';
    const songVoted = round?.candidates.some((candidate) => candidate.didVote) ?? false;
    const studioConfirmed = studios.some((candidate) => candidate.status === 'confirmed');

    return [
      {
        title: '합주곡 투표',
        description: songVoting
          ? songVoted
            ? '내 선택이 반영되어 있어요. 투표가 끝나기 전까지 바꿀 수 있어요.'
            : '마음에 드는 후보곡에 투표해 주세요.'
          : round?.status === 'done'
            ? '투표가 끝났어요. 새 후보곡을 추가해 다음 투표를 시작할 수 있어요.'
            : '진행 중인 합주곡 투표가 없어요.',
        status: songVoting ? (songVoted ? '변경 가능' : '투표 필요') : round?.status === 'done' ? '후보 추가' : '진행 없음',
        tone: songVoting ? (songVoted ? 'changeable' : 'need') : round?.status === 'done' ? 'changeable' : 'none',
        onPress: () => navigation.navigate('SongVote', { bandId }),
      },
      {
        title: '합주실 등록',
        description: studioConfirmed
          ? '합주실이 등록되었어요. 필요하면 다른 합주실로 변경할 수 있어요.'
          : '아직 등록된 합주실이 없어요. 사용할 합주실을 등록해 주세요.',
        status: studioConfirmed ? '등록됨' : '등록 필요',
        tone: studioConfirmed ? 'done' : 'need',
        onPress: () => navigation.navigate('Studios', { bandId }),
      },
    ] satisfies Array<{
      title: string;
      description: string;
      status: string;
      tone: VoteTone;
      onPress: () => void;
    }>;
  }, [bandId, navigation, round, studios]);

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="vote" navigation={navigation} />}>
      <View style={styles.list}>
        {cards.map((card) => (
          <Pressable
            key={card.title}
            style={({ pressed }) => [styles.card, card.tone === 'need' && styles.cardNeed, pressed && styles.cardPressed]}
            onPress={card.onPress}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <StatusBadge label={card.status} tone={toBadgeTone(card.tone)} />
            </View>
            <Text style={styles.cardDescription}>{card.description}</Text>
            <View style={styles.cardAction}>
              <Text style={styles.cardActionText}>바로가기</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.primaryDark} />
            </View>
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
  if (tone === 'changeable') {
    return 'warning';
  }
  return 'default';
}

const styles = StyleSheet.create({
  list: {
    gap: 14,
  },
  card: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 12,
    ...theme.shadow.card,
  },
  cardNeed: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.82,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardDescription: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 2,
  },
  cardActionText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
});
