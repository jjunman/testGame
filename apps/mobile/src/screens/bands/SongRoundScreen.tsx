import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import YoutubePlayer from 'react-native-youtube-iframe';
import { SongCandidateDto, SongRoundDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, HeroBanner, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'SongRound'>;

export function SongRoundScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const { user } = useAuth();
  const { currentBand } = useCurrentBand();
  const [round, setRound] = useState<SongRoundDto | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [endingRound, setEndingRound] = useState(false);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    setRound(await api.get<SongRoundDto | null>(`/bands/${bandId}/song-round`));
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  const candidates = useMemo(() => {
    if (!round) {
      return [];
    }

    return [...round.candidates];
  }, [round]);

  useEffect(() => {
    if (activeCandidateIndex >= candidates.length) {
      setActiveCandidateIndex(Math.max(0, candidates.length - 1));
    }
  }, [activeCandidateIndex, candidates.length]);

  const toggleVote = async (candidateId: string, didVote: boolean) => {
    if (!round) {
      return;
    }

    const currentVoteCount = round.candidates.filter((candidate) => candidate.didVote).length;
    if (!didVote && currentVoteCount >= 2) {
      Alert.alert('투표 제한', '최대 2곡까지 선택할 수 있어요.');
      return;
    }

    const previousRound = round;
    const nextCandidates = round.candidates.map((candidate) => {
      if (candidate.id !== candidateId) {
        return candidate;
      }

      return {
        ...candidate,
        didVote: !didVote,
        voteCount: Math.max(0, candidate.voteCount + (didVote ? -1 : 1)),
      };
    });

    setRound({
      ...round,
      candidates: nextCandidates,
    });
    setSubmittingId(candidateId);

    try {
      if (didVote) {
        await api.delete(`/bands/${bandId}/song-votes/${candidateId}`);
      } else {
        await api.post(`/bands/${bandId}/song-votes`, { candidateId });
      }
      await load();
    } catch (error) {
      setRound(previousRound);
      Alert.alert('투표 반영 실패', error instanceof Error ? error.message : '투표를 반영하지 못했어요.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (!round) {
    return (
      <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
        <HeroBanner title="합주곡 정하기" subtitle="아직 투표가 시작되지 않았어요." badge="대기" />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>합주곡 게시 단계</Text>
          <EmptyState title="진행 중인 투표가 없어요" description="리더가 투표를 시작하면 후보곡과 투표 카드가 여기에 표시돼요." />
        </View>
      </Screen>
    );
  }

  const isVoting = round.status === 'voting';
  const isPosted = round.status === 'posted';
  const isLeader = round.myRole === 'leader' || currentBand?.myRole === 'leader';
  const finalCandidate = candidates.find((candidate) => candidate.id === round.finalCandidateId) ?? candidates[0] ?? null;
  const hasMyVote = candidates.some((candidate) => candidate.didVote);
  const myVoteCount = candidates.filter((candidate) => candidate.didVote).length;
  const canEditSelection = isVoting;

  const finishRoundNow = () => {
    Alert.alert('투표를 지금 끝낼까요?', '현재까지의 투표 결과로 합주곡을 바로 확정합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '지금 끝내기',
        style: 'destructive',
        onPress: async () => {
          setEndingRound(true);
          try {
            await api.post(`/bands/${bandId}/song-round/finalize`);
            Alert.alert('투표 완료', '현재 투표 결과로 합주곡을 확정했어요.', [
              {
                text: '확인',
                onPress: () => navigation.navigate('BandHome', { bandId }),
              },
            ]);
          } catch (error) {
            Alert.alert('마감 실패', error instanceof Error ? error.message : '투표를 끝내지 못했어요.');
          } finally {
            setEndingRound(false);
          }
        },
      },
    ]);
  };

  const deleteCandidate = (candidate: SongCandidateDto) => {
    if (!isVoting || candidate.createdByUserId !== user?.id) {
      return;
    }

    Alert.alert('노래 삭제하기', `${candidate.title}을(를) 후보곡에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          setDeletingCandidateId(candidate.id);
          try {
            await api.delete(`/bands/${bandId}/song-candidates/${candidate.id}`);
            await load();
          } catch (error) {
            Alert.alert('삭제 실패', error instanceof Error ? error.message : '노래를 삭제하지 못했어요.');
          } finally {
            setDeletingCandidateId(null);
          }
        },
      },
    ]);
  };

  const submitVotes = () => {
    Alert.alert('투표 제출 완료', '제출되었습니다.', [
      {
        text: '확인',
        onPress: () => {
          navigation.navigate('BandHome', { bandId });
        },
      },
    ]);
  };

  const cardWidth = Math.min(360, Math.max(280, width - 72));
  const cardGap = 12;

  if (!isVoting) {
    return (
      <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
        <HeroBanner title="합주곡 정하기" subtitle="진행 중인 곡 투표가 없어요." badge="대기" />
        <View style={styles.section}>
          <EmptyState title="진행 중인 투표가 없어요" description="투표가 시작되면 후보곡 카드가 여기에 나타나요." />
        </View>
      </Screen>
    );
  }

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
      <HeroBanner
        title="합주곡 정하기"
        subtitle={isVoting ? '이 노래를 골라볼까요?' : isPosted ? '후보곡을 모으는 단계예요' : '우리의 합주곡이 정해졌어요'}
        badge={isVoting ? '투표 단계' : isPosted ? '후보 모집' : '투표 완료'}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{isVoting ? '투표 단계' : isPosted ? '후보 모집' : '투표 완료!'}</Text>
            <Text style={styles.sectionCaption}>
              {round.votingDeadlineAt
                ? `단계 종료까지 ${new Date(round.votingDeadlineAt).toLocaleString('ko-KR')}`
                : isPosted ? '후보곡을 먼저 추가한 뒤 투표를 시작해요.' : '후보곡을 확인해요.'}
            </Text>
          </View>
          {isVoting ? <StatusBadge label={`D-${daysLeft(round.votingDeadlineAt)}`} tone="warning" /> : null}
        </View>

        {candidates.length === 0 ? (
          <EmptyState title="아직 후보곡이 없어요" description="후보곡이 올라오면 체크 리스트 형태로 표시돼요." />
        ) : (
          <SongVoteCarousel
            candidates={candidates}
            activeIndex={activeCandidateIndex}
            cardWidth={cardWidth}
            cardGap={cardGap}
            canEditSelection={canEditSelection}
            isVoting={isVoting}
            submittingId={submittingId}
            deletingCandidateId={deletingCandidateId}
            currentUserId={user?.id ?? null}
            onIndexChange={setActiveCandidateIndex}
            onVote={(candidate) => void toggleVote(candidate.id, candidate.didVote)}
            onDelete={deleteCandidate}
          />
        )}

        {isVoting ? (
          <View style={styles.actionStack}>
            <PrimaryButton
              label={myVoteCount >= 2 ? '2곡 선택 완료' : '제출하기'}
              onPress={submitVotes}
              loading={submittingId !== null}
              disabled={!hasMyVote || endingRound}
            />
            {isLeader ? (
              <Pressable
                onPress={finishRoundNow}
                disabled={endingRound || submittingId !== null || candidates.length === 0}
                style={[styles.subtleEndButton, (endingRound || submittingId !== null || candidates.length === 0) && styles.subtleEndButtonDisabled]}
              >
                <Text style={styles.subtleEndButtonText}>{endingRound ? '끝내는 중...' : '지금 끝내기'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {!isVoting && finalCandidate ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>우리의 합주곡</Text>
          <View style={styles.doneCard}>
            <ImageBackground source={{ uri: finalCandidate.thumbnailUrl ?? undefined }} imageStyle={styles.songCoverImage} style={styles.songCover}>
              <View style={styles.songCoverOverlay} />
              <Text style={styles.songCoverText}>{finalCandidate.title.slice(0, 2)}</Text>
            </ImageBackground>
            <View style={styles.doneSongRow}>
              <Text style={styles.playIcon}>▶</Text>
              <View style={styles.doneSongBody}>
                <Text style={styles.doneTitle}>{finalCandidate.title}</Text>
                <Text style={styles.doneArtist}>{finalCandidate.artist}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {isVoting || isPosted ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>후보곡</Text>
          <PrimaryButton label="후보곡 추가하기" onPress={() => navigation.navigate('AddSongCandidate', { bandId })} />
        </View>
      ) : null}
    </Screen>
  );
}

function SongVoteCarousel({
  candidates,
  activeIndex,
  cardWidth,
  cardGap,
  canEditSelection,
  isVoting,
  submittingId,
  deletingCandidateId,
  currentUserId,
  onIndexChange,
  onVote,
  onDelete,
}: {
  candidates: SongCandidateDto[];
  activeIndex: number;
  cardWidth: number;
  cardGap: number;
  canEditSelection: boolean;
  isVoting: boolean;
  submittingId: string | null;
  deletingCandidateId: string | null;
  currentUserId: string | null;
  onIndexChange: (index: number) => void;
  onVote: (candidate: SongCandidateDto) => void;
  onDelete: (candidate: SongCandidateDto) => void;
}) {
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + cardGap));
    onIndexChange(Math.max(0, Math.min(candidates.length - 1, nextIndex)));
  };

  return (
    <View style={styles.carouselShell}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + cardGap}
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {candidates.map((candidate, index) => {
          const active = index === activeIndex;
          const voteDisabled = !isVoting || !canEditSelection || submittingId !== null || deletingCandidateId !== null;
          const canDelete = isVoting && currentUserId === candidate.createdByUserId;
          return (
            <Pressable
              key={candidate.id}
              style={[
                styles.songVoteCard,
                { width: cardWidth, marginRight: index === candidates.length - 1 ? 0 : cardGap },
                candidate.didVote && styles.songVoteCardSelected,
              ]}
            >
              <View style={styles.youtubePanel}>
                {active && candidate.youtubeVideoId ? (
                  <YoutubePlayer height={Math.round((cardWidth - 28) * 9 / 16)} videoId={candidate.youtubeVideoId} />
                ) : (
                  <ImageBackground source={{ uri: candidate.thumbnailUrl ?? undefined }} imageStyle={styles.youtubeFallbackImage} style={styles.youtubeFallback}>
                    <View style={styles.youtubeFallbackOverlay} />
                    <Text style={styles.youtubePlayIcon}>▶</Text>
                  </ImageBackground>
                )}
              </View>
              <View style={styles.songCardBody}>
                <View style={styles.songCardTopRow}>
                  <Text style={styles.songCardIndex}>{index + 1} / {candidates.length}</Text>
                  <Text style={[styles.songCardVoteCount, candidate.didVote && styles.songCardVoteCountSelected]}>{candidate.voteCount}표</Text>
                </View>
                <Text style={styles.songCardTitle} numberOfLines={2}>{candidate.title}</Text>
                <Text style={styles.songCardArtist} numberOfLines={1}>{candidate.artist}</Text>
                {candidate.warningMessage ? <Text style={styles.songCardWarning}>{candidate.warningMessage}</Text> : null}
                {canDelete ? (
                  <Pressable
                    onPress={() => onDelete(candidate)}
                    disabled={deletingCandidateId === candidate.id || submittingId !== null}
                    style={[
                      styles.songDeleteButton,
                      (deletingCandidateId === candidate.id || submittingId !== null) && styles.songDeleteButtonDisabled,
                    ]}
                  >
                    <Text style={styles.songDeleteButtonText}>
                      {deletingCandidateId === candidate.id ? '삭제 중...' : '삭제'}
                    </Text>
                  </Pressable>
                ) : null}
                <PrimaryButton
                  label={candidate.didVote ? '이 곡 투표 취소' : '이 곡 투표하기'}
                  onPress={() => onVote(candidate)}
                  loading={submittingId === candidate.id}
                  disabled={voteDisabled}
                  style={candidate.didVote ? styles.songVoteCancelButton : undefined}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.carouselDots}>
        {candidates.map((candidate, index) => (
          <View key={candidate.id} style={[styles.carouselDot, index === activeIndex && styles.carouselDotActive, candidate.didVote && styles.carouselDotVoted]} />
        ))}
      </View>
    </View>
  );
}

function daysLeft(value?: string | null) {
  if (!value) {
    return '?';
  }

  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  sectionTitle: {
    color: theme.colors.primaryDark,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCaption: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  carouselShell: {
    gap: 10,
  },
  carouselContent: {
    paddingRight: 18,
  },
  songVoteCard: {
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  songVoteCardSelected: {
    borderColor: theme.colors.primary,
  },
  youtubePanel: {
    backgroundColor: '#111',
    minHeight: 160,
  },
  youtubeFallback: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryDark,
  },
  youtubeFallbackImage: {
    resizeMode: 'cover',
  },
  youtubeFallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 8, 22, 0.42)',
  },
  youtubePlayIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
  },
  songCardBody: {
    padding: 14,
    gap: 9,
  },
  songCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  songCardIndex: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  songCardVoteCount: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  songCardVoteCountSelected: {
    color: theme.colors.primary,
  },
  songCardTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  songCardArtist: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  songCardWarning: {
    color: '#d1475d',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  songDeleteButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  songDeleteButtonDisabled: {
    opacity: 0.45,
  },
  songDeleteButtonText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  songVoteCancelButton: {
    backgroundColor: theme.colors.primaryDark,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
  },
  carouselDotActive: {
    width: 18,
    backgroundColor: theme.colors.primaryDark,
  },
  carouselDotVoted: {
    backgroundColor: theme.colors.primary,
  },
  voteList: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: '#eee8ff',
  },
  actionStack: {
    gap: 8,
  },
  subtleEndButton: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subtleEndButtonDisabled: {
    opacity: 0.45,
  },
  subtleEndButtonText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#d7cbff',
  },
  voteRowSelected: {
    backgroundColor: theme.colors.primary,
  },
  voteRowLocked: {
    opacity: 0.92,
  },
  previewButton: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    color: theme.colors.primaryDark,
    fontWeight: '900',
    fontSize: 16,
  },
  voteMainPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderWidth: 1.4,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkBoxSelected: {
    backgroundColor: '#fff',
  },
  checkMark: {
    color: theme.colors.primary,
    fontWeight: '900',
  },
  voteBody: {
    flex: 1,
  },
  voteTitle: {
    color: theme.colors.primaryDark,
    fontWeight: '800',
    fontSize: 14,
  },
  voteTitleSelected: {
    color: '#fff',
  },
  voteMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  voteMetaSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  voteCount: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  voteCountSelected: {
    color: '#fff',
  },
  warningText: {
    color: '#d1475d',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  warningTextSelected: {
    color: '#ffe6eb',
  },
  doneCard: {
    alignItems: 'center',
    gap: 16,
  },
  songCover: {
    width: 116,
    height: 116,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  songCoverImage: {
    borderRadius: 0,
  },
  songCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 10, 30, 0.34)',
  },
  songCoverText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  doneSongRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    padding: 14,
  },
  playIcon: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  doneSongBody: {
    flex: 1,
  },
  doneTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  doneArtist: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 18, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: theme.colors.primaryDark,
    fontWeight: '700',
  },
  modalBody: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  modalCancelText: {
    color: theme.colors.primaryDark,
    fontWeight: '800',
  },
  modalConfirm: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '800',
  },
});
