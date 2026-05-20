import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { BandHomeDto, BandSongCardDto, SongCandidateDto, SongRoundDto } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, Field, HeroBanner, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'SongRound'>;
type SongHubTab = 'vote' | 'library';

export function SongRoundScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SongHubTab>(route.params.initialTab ?? 'vote');
  const [round, setRound] = useState<SongRoundDto | null>(null);
  const [detail, setDetail] = useState<BandHomeDto | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [endingRound, setEndingRound] = useState(false);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [startingVote, setStartingVote] = useState(false);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [deadlineOffsetDays, setDeadlineOffsetDays] = useState<1 | 3 | 7>(3);
  const [expandedSongCardId, setExpandedSongCardId] = useState<string | null>(null);
  const [editingSongCardId, setEditingSongCardId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const [editingSong, setEditingSong] = useState(false);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    const [nextRound, nextDetail] = await Promise.all([
      api.get<SongRoundDto | null>(`/bands/${bandId}/song-round`),
      api.get<BandHomeDto>(`/bands/${bandId}`),
    ]);
    setRound(nextRound);
    setDetail({
      ...nextDetail,
      thumbnailUrl: toApiAssetUrl(nextDetail.thumbnailUrl),
      songCards: Array.isArray(nextDetail.songCards)
        ? nextDetail.songCards.map((card) => ({
            ...card,
            thumbnailUrl: toApiAssetUrl(card.thumbnailUrl),
          }))
        : [],
    });
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void load();
    });
    return unsubscribe;
  }, [load, navigation]);

  useEffect(() => {
    setActiveTab(route.params.initialTab ?? 'vote');
  }, [route.params.initialTab]);

  const candidates = useMemo(() => (round ? [...round.candidates] : []), [round]);
  const songCards = useMemo(() => detail?.songCards.filter((card) => card.kind === 'song') ?? [], [detail]);
  const hasActiveSongVote = round?.status === 'voting';
  const isVoting = round?.status === 'voting';
  const isPosted = round?.status === 'posted';
  const isDone = round?.status === 'done';
  const isLeader = round?.myRole === 'leader';
  const canAddCandidate = Boolean(isVoting || isPosted);
  const myVoteCount = candidates.filter((candidate) => candidate.didVote).length;
  const hasMyVote = myVoteCount > 0;
  const deadlineLabel = useMemo(() => {
    if (deadlineOffsetDays === 1) {
      return '내일까지';
    }
    if (deadlineOffsetDays === 7) {
      return '일주일 뒤까지';
    }
    return '3일 뒤까지';
  }, [deadlineOffsetDays]);

  useEffect(() => {
    if (activeCandidateIndex >= candidates.length) {
      setActiveCandidateIndex(Math.max(0, candidates.length - 1));
    }
  }, [activeCandidateIndex, candidates.length]);

  const reloadAfterMutation = async () => {
    setExpandedSongCardId(null);
    setEditingSongCardId(null);
    await load();
  };

  const startSongVote = async () => {
    setStartingVote(true);
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + deadlineOffsetDays);
      deadline.setHours(23, 59, 0, 0);
      await api.post(`/bands/${bandId}/song-round/start`, {
        deadlineAt: deadline.toISOString(),
      });
      setDeadlineModalOpen(false);
      setActiveTab('vote');
      await load();
    } catch (error) {
      Alert.alert('투표 시작 실패', error instanceof Error ? error.message : '합주곡 투표를 시작하지 못했어요.');
    } finally {
      setStartingVote(false);
    }
  };

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
    setRound({
      ...round,
      candidates: round.candidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, didVote: !didVote, voteCount: Math.max(0, candidate.voteCount + (didVote ? -1 : 1)) }
          : candidate,
      ),
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
            Alert.alert('투표 완료', '현재 투표 결과로 합주곡을 확정했어요.');
            setActiveTab('library');
            await load();
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

  const deleteSongCard = (card: BandSongCardDto) => {
    Alert.alert('노래 삭제하기', `${card.title}을(를) 노래 목록에서 삭제할까요?${card.practiceAssignmentId ? '\n연습중인 곡 연결도 함께 목록에서 사라져요.' : ''}`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제하기',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/bands/${bandId}/song-candidates/${card.id}`);
            await reloadAfterMutation();
          } catch (error) {
            Alert.alert('삭제 실패', error instanceof Error ? error.message : '노래 항목을 삭제하지 못했어요.');
          }
        },
      },
    ]);
  };

  const openSongCard = (card: BandSongCardDto) => {
    if (card.practiceAssignmentId) {
      navigation.navigate('PracticeAssignmentDetail', {
        bandId,
        assignmentId: card.practiceAssignmentId,
      });
      return;
    }
    navigation.navigate('CreatePracticeAssignment', { bandId });
  };

  const beginEditSongCard = (card: BandSongCardDto) => {
    setExpandedSongCardId(card.id);
    setEditingSongCardId(card.id);
    setEditTitle(card.title);
    setEditArtist(card.artist);
    setEditYoutubeUrl(card.youtubeUrl ?? '');
  };

  const submitSongEdit = async (card: BandSongCardDto) => {
    if (!editTitle.trim() || !editArtist.trim() || !editYoutubeUrl.trim()) {
      Alert.alert('입력 필요', '곡 제목, 가수, 유튜브 링크를 모두 입력해 주세요.');
      return;
    }
    setEditingSong(true);
    try {
      await api.patch(`/bands/${bandId}/song-candidates/${card.id}`, {
        title: editTitle.trim(),
        artist: editArtist.trim(),
        youtubeUrl: editYoutubeUrl.trim(),
      });
      await reloadAfterMutation();
    } catch (error) {
      Alert.alert('수정 실패', error instanceof Error ? error.message : '노래 정보를 수정하지 못했어요.');
    } finally {
      setEditingSong(false);
    }
  };

  const submitVotes = async () => {
    await load();
    Alert.alert('투표 제출 완료', '제출되었습니다.');
  };

  const cardWidth = Math.min(360, Math.max(280, width - 72));
  const cardGap = 12;
  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active={activeTab === 'vote' ? 'vote' : 'song'} navigation={navigation} />}>
      <HeroBanner
        title="노래"
        subtitle={activeTab === 'vote' ? '합주곡 투표를 확인하고 후보를 고르세요.' : '확정곡과 연습 과제를 한곳에서 관리해요.'}
        badge={activeTab === 'vote' ? '투표' : `${songCards.length}곡`}
      />

      {activeTab === 'vote' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{isVoting ? '투표 단계' : isPosted ? '후보 모집' : '합주곡 투표'}</Text>
              <Text style={styles.sectionCaption}>
                {round?.votingDeadlineAt
                  ? `단계 종료까지 ${new Date(round.votingDeadlineAt).toLocaleString('ko-KR')}`
                  : isPosted ? '후보곡을 먼저 추가한 뒤 투표를 시작해요.' : '투표를 시작하면 후보곡을 고를 수 있어요.'}
              </Text>
            </View>
            {isVoting ? <StatusBadge label={`D-${daysLeft(round?.votingDeadlineAt)}`} tone="warning" /> : null}
          </View>

          <View style={styles.actionRow}>
            {hasActiveSongVote ? (
              <View style={styles.readonlyAction}>
                <Text style={styles.readonlyActionText}>투표 진행 중</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.secondaryAction, startingVote && styles.secondaryActionDisabled]}
                onPress={() => setDeadlineModalOpen(true)}
                disabled={startingVote}
              >
                <Text style={styles.secondaryActionText}>{startingVote ? '시작 중...' : '투표 시작'}</Text>
              </Pressable>
            )}
            {canAddCandidate ? (
              <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('AddSongCandidate', { bandId })}>
                <Text style={styles.secondaryActionText}>후보곡 추가</Text>
              </Pressable>
            ) : null}
          </View>

          {isDone ? (
            <EmptyState title="진행 중인 투표가 없어요" description="합주곡 투표가 완료되었어요. 곡과 연습 탭에서 확정곡을 확인할 수 있어요." />
          ) : candidates.length === 0 ? (
            <EmptyState title="아직 후보곡이 없어요" description="후보곡을 추가하거나 투표를 시작하면 여기에 카드가 나타나요." />
          ) : (
            <SongVoteCarousel
              candidates={candidates}
              activeIndex={activeCandidateIndex}
              cardWidth={cardWidth}
              cardGap={cardGap}
              canEditSelection={Boolean(isVoting)}
              isVoting={Boolean(isVoting)}
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
              <View style={styles.voteProgressRow}>
                <Text style={styles.voteProgressLabel}>선택한 곡</Text>
                <Text style={styles.voteProgressValue}>{myVoteCount} / 2</Text>
              </View>
              <PrimaryButton
                label={myVoteCount >= 2 ? '2곡 선택 완료' : '제출하기'}
                onPress={() => void submitVotes()}
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
      ) : (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>곡과 연습</Text>
              <Text style={styles.sectionCaption}>확정된 합주곡과 연결된 연습 과제를 확인해요.</Text>
            </View>
            <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('CreatePracticeAssignment', { bandId })}>
              <Text style={styles.secondaryActionText}>연습 만들기</Text>
            </Pressable>
          </View>
          {songCards.length === 0 ? (
            <EmptyState title="아직 곡이 없어요" description="합주곡 투표를 끝내면 확정곡과 연습 흐름이 여기에 정리돼요." />
          ) : (
            <View style={styles.listGroup}>
              {songCards.map((card) => (
                <SongLibraryCard
                  key={card.id}
                  card={card}
                  expanded={expandedSongCardId === card.id}
                  editing={editingSongCardId === card.id}
                  editTitle={editTitle}
                  editArtist={editArtist}
                  editYoutubeUrl={editYoutubeUrl}
                  editingSong={editingSong}
                  onPress={() => openSongCard(card)}
                  onToggleMore={() => {
                    setExpandedSongCardId((current) => (current === card.id ? null : card.id));
                    setEditingSongCardId(null);
                  }}
                  onEdit={() => beginEditSongCard(card)}
                  onDelete={() => deleteSongCard(card)}
                  onClose={() => {
                    setExpandedSongCardId(null);
                    setEditingSongCardId(null);
                  }}
                  onChangeTitle={setEditTitle}
                  onChangeArtist={setEditArtist}
                  onChangeYoutubeUrl={setEditYoutubeUrl}
                  onSubmitEdit={() => void submitSongEdit(card)}
                  onCancelEdit={() => setEditingSongCardId(null)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <Modal visible={deadlineModalOpen} transparent animationType="fade" onRequestClose={() => setDeadlineModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>합주곡 투표 시작</Text>
            <Text style={styles.modalBody}>투표 마감일을 먼저 정해 주세요. 시작하면 멤버들이 후보곡을 올리고 바로 투표할 수 있어요.</Text>
            <View style={styles.deadlineOptions}>
              {([
                { label: '내일', value: 1 },
                { label: '3일 뒤', value: 3 },
                { label: '7일 뒤', value: 7 },
              ] as const).map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.deadlineChip, deadlineOffsetDays === option.value && styles.deadlineChipActive]}
                  onPress={() => setDeadlineOffsetDays(option.value)}
                >
                  <Text style={[styles.deadlineChipText, deadlineOffsetDays === option.value && styles.deadlineChipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.deadlineSummary}>선택됨: {deadlineLabel}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setDeadlineModalOpen(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={() => void startSongVote()}>
                <Text style={styles.modalConfirmText}>시작하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SongLibraryCard({
  card,
  expanded,
  editing,
  editTitle,
  editArtist,
  editYoutubeUrl,
  editingSong,
  onPress,
  onToggleMore,
  onEdit,
  onDelete,
  onClose,
  onChangeTitle,
  onChangeArtist,
  onChangeYoutubeUrl,
  onSubmitEdit,
  onCancelEdit,
}: {
  card: BandSongCardDto;
  expanded: boolean;
  editing: boolean;
  editTitle: string;
  editArtist: string;
  editYoutubeUrl: string;
  editingSong: boolean;
  onPress: () => void;
  onToggleMore: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onChangeTitle: (value: string) => void;
  onChangeArtist: (value: string) => void;
  onChangeYoutubeUrl: (value: string) => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
}) {
  const practiceClosed = card.practiceStatus === 'closed';

  return (
    <View style={[styles.songCardShell, practiceClosed && styles.songCardShellClosed]}>
      <Pressable style={styles.songListItem} onPress={onPress}>
        <ImageBackground source={{ uri: card.thumbnailUrl ?? undefined }} imageStyle={styles.songCoverImage} style={styles.songCoverSmall}>
          <View style={styles.songCoverOverlay} />
          <Text style={styles.songCoverText}>{card.title.slice(0, 2)}</Text>
        </ImageBackground>
        <View style={styles.songListBody}>
          <View style={styles.songListTop}>
            <Text style={styles.songTitle} numberOfLines={1}>{card.title}</Text>
            <View style={styles.songActions}>
              <StatusBadge label={practiceClosed ? '완료' : card.practiceAssignmentId ? '연습' : '곡'} tone={practiceClosed ? 'default' : 'default'} />
              <Pressable
                style={[styles.songMenuButton, expanded && styles.songMenuButtonActive]}
                hitSlop={10}
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleMore();
                }}
              >
                <Ionicons name="ellipsis-vertical" size={17} color={expanded ? theme.colors.primaryDark : theme.colors.textMuted} />
              </Pressable>
              {expanded && !editing ? (
                <View style={styles.inlineMenu}>
                  <Pressable style={styles.inlineMenuItem} onPress={onEdit}>
                    <Text style={styles.inlineMenuText}>수정</Text>
                  </Pressable>
                  <Pressable style={styles.inlineMenuItem} onPress={onDelete}>
                    <Text style={[styles.inlineMenuText, styles.inlineMenuDanger]}>삭제</Text>
                  </Pressable>
                  <Pressable style={[styles.inlineMenuItem, styles.inlineMenuLastItem]} onPress={onClose}>
                    <Text style={styles.inlineMenuText}>닫기</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={styles.songArtist} numberOfLines={1}>{card.artist}</Text>
          <Text style={styles.songHint} numberOfLines={1}>
            {practiceClosed ? '연습 완료' : card.practiceDueAt ? formatDueLabel(card.practiceDueAt) : '눌러서 연습 과제 만들기'}
          </Text>
        </View>
      </Pressable>
      {editing ? (
        <View style={styles.songFoldout}>
          <View style={styles.songEditForm}>
            <Field value={editTitle} onChangeText={onChangeTitle} placeholder="곡 제목" />
            <Field value={editArtist} onChangeText={onChangeArtist} placeholder="가수" />
            <Field value={editYoutubeUrl} onChangeText={onChangeYoutubeUrl} placeholder="유튜브 링크" autoCapitalize="none" />
            <View style={styles.songEditActions}>
              <Pressable style={styles.foldoutButton} onPress={onCancelEdit} disabled={editingSong}>
                <Text style={styles.foldoutButtonText}>취소</Text>
              </Pressable>
              <Pressable style={[styles.foldoutButton, styles.foldoutPrimary]} onPress={onSubmitEdit} disabled={editingSong}>
                <Text style={[styles.foldoutButtonText, styles.foldoutPrimaryText]}>{editingSong ? '저장 중...' : '저장'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
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
                    <Text style={styles.songDeleteButtonText}>{deletingCandidateId === candidate.id ? '삭제 중...' : '삭제'}</Text>
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

function formatDueLabel(value: string) {
  return `마감 ${new Date(value).toLocaleDateString('ko-KR')}`;
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
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionCaption: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.surface,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: theme.colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryAction: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionDisabled: {
    opacity: 0.55,
  },
  secondaryActionText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  readonlyAction: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readonlyActionText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  carouselShell: {
    gap: 10,
  },
  carouselContent: {
    paddingRight: 18,
  },
  songVoteCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  songVoteCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
  },
  youtubePanel: {
    backgroundColor: '#111',
    minHeight: 150,
  },
  youtubeFallback: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20242c',
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
    padding: 13,
    gap: 8,
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
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  songCardVoteCountSelected: {
    color: theme.colors.primary,
  },
  songCardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
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
    backgroundColor: theme.colors.textMuted,
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
    backgroundColor: theme.colors.text,
  },
  carouselDotVoted: {
    backgroundColor: theme.colors.primary,
  },
  actionStack: {
    gap: 8,
  },
  voteProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voteProgressLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  voteProgressValue: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
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
  listGroup: {
    gap: 8,
  },
  songCardShell: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'visible',
    zIndex: 1,
  },
  songCardShellClosed: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    opacity: 0.82,
  },
  songListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 9,
  },
  songListBody: {
    flex: 1,
    gap: 4,
  },
  songListTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  songActions: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
    minHeight: 54,
    width: 54,
    position: 'relative',
  },
  songMenuButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  songMenuButtonActive: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  inlineMenu: {
    position: 'absolute',
    top: 34,
    right: 3,
    zIndex: 20,
    elevation: 8,
    width: 48,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  inlineMenuItem: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  inlineMenuLastItem: {
    borderBottomWidth: 0,
  },
  inlineMenuText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  inlineMenuDanger: {
    color: theme.colors.danger,
  },
  songFoldout: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 10,
    gap: 10,
  },
  foldoutButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  foldoutButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  foldoutPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  foldoutPrimaryText: {
    color: '#fff',
  },
  songEditForm: {
    gap: 8,
  },
  songEditActions: {
    flexDirection: 'row',
    gap: 8,
  },
  songCoverSmall: {
    width: 70,
    height: 70,
    borderRadius: theme.radius.sm,
    backgroundColor: '#20242c',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  songCoverImage: {
    borderRadius: theme.radius.sm,
  },
  songCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 10, 30, 0.45)',
  },
  songCoverText: {
    color: '#fff',
    fontWeight: '800',
  },
  songTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  songArtist: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  songHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 18, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalBody: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  deadlineOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  deadlineChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  deadlineChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  deadlineChipText: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  deadlineChipTextActive: {
    color: '#fff',
  },
  deadlineSummary: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  modalCancelText: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  modalConfirm: {
    flex: 1,
    borderRadius: theme.radius.md,
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
