import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { BandHomeDto, BandSongCardDto, SongCandidateDto, SongRoundDto } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, Field, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'SongRound'>;
type VoteProps = NativeStackScreenProps<BandsStackParamList, 'SongVote'>;

export function SongRoundScreen({ route, navigation }: Props) {
  return <SongFlowScreen bandId={route.params.bandId} navigation={navigation} voteOnly={false} />;
}

export function SongVoteScreen({ route, navigation }: VoteProps) {
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="투표 방식 안내"
          hitSlop={10}
          style={({ pressed }) => [styles.headerInfoButton, pressed && styles.headerInfoButtonPressed]}
          onPress={() => Alert.alert(
            '합주곡 투표 방식',
            '1. 모든 멤버가 후보곡을 여러 곡 등록할 수 있어요.\n\n2. 마음에 드는 곡을 여러 곡 선택할 수 있어요.\n\n3. 가장 많은 표를 받은 한 곡이 합주곡으로 결정돼요.\n\n4. 득표수가 같다면 먼저 등록된 곡이 선정돼요.',
            [{ text: '확인' }],
          )}
        >
          <Ionicons name="information-circle-outline" size={25} color={theme.colors.primaryDark} />
        </Pressable>
      ),
    });
  }, [navigation]);

  return <SongFlowScreen bandId={route.params.bandId} navigation={navigation} voteOnly />;
}

function SongFlowScreen({
  bandId,
  navigation,
  voteOnly,
}: {
  bandId: string;
  navigation: NativeStackNavigationProp<BandsStackParamList>;
  voteOnly: boolean;
}) {
  const { user } = useAuth();
  const [round, setRound] = useState<SongRoundDto | null>(null);
  const [detail, setDetail] = useState<BandHomeDto | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [endingRound, setEndingRound] = useState(false);
  const [expandedSongCardId, setExpandedSongCardId] = useState<string | null>(null);
  const [editingSongCardId, setEditingSongCardId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const [editingSong, setEditingSong] = useState(false);

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

  const candidates = useMemo(() => (round ? [...round.candidates] : []), [round]);
  const songCards = useMemo(() => detail?.songCards.filter((card) => card.kind === 'song') ?? [], [detail]);
  const isVoting = round?.status === 'voting';
  const isDone = round?.status === 'done';
  const isLeader = round?.myRole === 'leader';
  const canAddCandidate = true;
  const visibleCandidates = isDone ? [] : candidates;
  const myVoteCount = isVoting ? candidates.filter((candidate) => candidate.didVote).length : 0;

  const reloadAfterMutation = async () => {
    setExpandedSongCardId(null);
    setEditingSongCardId(null);
    await load();
  };

  const addCandidate = () => {
    navigation.navigate('AddSongCandidate', { bandId });
  };


  const toggleVote = async (candidateId: string, didVote: boolean) => {
    if (!round) {
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
            await load();
            navigation.replace('SongRound', { bandId });
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
    navigation.navigate('SongPracticeDetail', { bandId, songCandidateId: card.id });
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
    Alert.alert('투표 완료', '선택한 투표가 저장되었습니다.', [
      { text: '확인', onPress: () => navigation.goBack() },
    ]);
  };

  const voteEntryTitle = isVoting ? '진행 중인 곡 투표' : isDone ? '새 합주곡 정하기' : '합주곡 정하기';
  const voteEntryMeta = !isDone && candidates.length > 0
    ? `후보 ${candidates.length}곡${isVoting ? ` · ${myVoteCount}곡 선택` : ''}`
    : '후보곡 추가';

  if (voteOnly) {
    return (
      <Screen fixedFooter={<BandInnerNav bandId={bandId} active="vote" navigation={navigation} />}>
        <View style={[styles.section, styles.voteSection]}>
          <View style={styles.voteHeader}>
            <Text style={styles.voteHeaderTitle}>합주곡 투표</Text>
            <View style={styles.voteHeaderBadge}>
              <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.primaryDark} />
              <Text style={styles.voteHeaderBadgeText}>{myVoteCount}곡 선택됨</Text>
            </View>
          </View>
          <SongVoteCarousel
            candidates={visibleCandidates}
            canEditSelection={Boolean(isVoting)}
            isVoting={Boolean(isVoting)}
            submittingId={submittingId}
            deletingCandidateId={deletingCandidateId}
            currentUserId={user?.id ?? null}
            onVote={(candidate) => void toggleVote(candidate.id, candidate.didVote)}
            onDelete={deleteCandidate}
            canAddCandidate={canAddCandidate}
            onAddCandidate={addCandidate}
          />

          {isVoting ? (
            <View style={styles.actionStack}>
              <Pressable
                style={[styles.voteCompleteButton, (endingRound || submittingId !== null) && styles.voteCompleteButtonDisabled]}
                onPress={() => void submitVotes()}
                disabled={endingRound || submittingId !== null}
              >
                <Text style={styles.voteCompleteButtonText}>투표 완료</Text>
              </Pressable>
              {isLeader ? (
                <Pressable
                  onPress={finishRoundNow}
                  disabled={endingRound || submittingId !== null || candidates.length === 0}
                  style={[styles.voteEndButton, (endingRound || submittingId !== null || candidates.length === 0) && styles.voteEndButtonDisabled]}
                >
                  <Text style={styles.voteEndButtonText}>{endingRound ? '끝내는 중...' : '지금 끝내기'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="song" navigation={navigation} />}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.voteEntry, pressed && styles.voteEntryPressed]}
        onPress={() => navigation.navigate('SongVote', { bandId })}
      >
        <View style={styles.voteEntryIcon}>
          <Ionicons name="musical-notes" size={22} color={theme.colors.primaryDark} />
        </View>
        <View style={styles.voteEntryBody}>
          <Text style={styles.voteEntryTitle}>{voteEntryTitle}</Text>
          <Text style={styles.voteEntryMeta}>{voteEntryMeta}</Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={theme.colors.textMuted} />
      </Pressable>

      <View style={[styles.section, styles.flowSection]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>확정곡·연습</Text>
          {songCards.length > 0 ? <Text style={styles.sectionMeta}>{songCards.length}곡</Text> : null}
        </View>
        {songCards.length === 0 ? (
          <EmptyState title="아직 확정곡이 없어요" description="투표가 끝나면 여기에 추가돼요." />
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
      <Pressable style={({ pressed }) => [styles.songListItem, pressed && styles.songListItemPressed]} onPress={onPress}>
        <ImageBackground source={{ uri: card.thumbnailUrl ?? undefined }} imageStyle={styles.songCoverImage} style={styles.songCoverSmall}>
          <View style={styles.songCoverOverlay} />
          <Text style={styles.songCoverText}>{card.title.slice(0, 2)}</Text>
        </ImageBackground>
        <View style={styles.songListBody}>
          <View style={styles.songListTop}>
            <Text style={styles.songTitle} numberOfLines={2}>{card.title}</Text>
            <View style={styles.songActions}>
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
                  <Pressable style={[styles.inlineMenuItem, styles.inlineMenuLastItem]} onPress={onDelete}>
                    <Text style={[styles.inlineMenuText, styles.inlineMenuDanger]}>삭제</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={styles.songArtist} numberOfLines={2}>{card.artist}</Text>
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
  canEditSelection,
  isVoting,
  submittingId,
  deletingCandidateId,
  currentUserId,
  onVote,
  onDelete,
  canAddCandidate,
  onAddCandidate,
}: {
  candidates: SongCandidateDto[];
  canEditSelection: boolean;
  isVoting: boolean;
  submittingId: string | null;
  deletingCandidateId: string | null;
  currentUserId: string | null;
  onVote: (candidate: SongCandidateDto) => void;
  onDelete: (candidate: SongCandidateDto) => void;
  canAddCandidate: boolean;
  onAddCandidate: () => void;
}) {
  const [previewCandidate, setPreviewCandidate] = useState<SongCandidateDto | null>(null);

  return (
    <View style={styles.candidateList}>
      {candidates.map((candidate) => {
        const voteDisabled = !isVoting || !canEditSelection || submittingId !== null || deletingCandidateId !== null;
        const canDelete = isVoting && currentUserId === candidate.createdByUserId;
        return (
          <Pressable
            key={candidate.id}
            accessibilityRole="checkbox"
            accessibilityLabel={`${candidate.title} ${candidate.didVote ? '투표 취소' : '투표'}`}
            accessibilityState={{ checked: candidate.didVote, disabled: voteDisabled }}
            onPress={() => {
              if (!voteDisabled) onVote(candidate);
            }}
            style={({ pressed }) => [
              styles.trackRow,
              candidate.didVote && styles.trackRowSelected,
              pressed && !voteDisabled && styles.trackRowPressed,
              voteDisabled && styles.trackRowDisabled,
            ]}
          >
            <View style={styles.trackRowInner}>
              <ImageBackground
                source={{ uri: candidate.thumbnailUrl ?? undefined }}
                imageStyle={styles.trackArtworkImage}
                style={styles.trackArtwork}
              >
                <View style={styles.youtubeFallbackOverlay} />
                <Pressable
                  accessibilityLabel={`${candidate.title} 영상 미리보기`}
                  style={styles.trackPlayButton}
                  disabled={!candidate.youtubeVideoId}
                  onPress={(event) => {
                    event.stopPropagation();
                    setPreviewCandidate(candidate);
                  }}
                >
                  <Ionicons name="play" size={15} color="#fff" />
                </Pressable>
              </ImageBackground>

              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={2}>{candidate.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={2}>{candidate.artist}</Text>
                {candidate.warningMessage ? <Text style={styles.trackWarning} numberOfLines={2}>{candidate.warningMessage}</Text> : null}
              </View>

              <View style={styles.trackRightActions}>
                <View style={styles.trackVoteCountWrap}>
                  <Text style={[styles.trackVoteCount, candidate.didVote && styles.trackVoteCountSelected]}>{candidate.voteCount}표</Text>
                </View>
                <View style={[styles.trackSelectBadge, candidate.didVote && styles.trackSelectBadgeOn]}>
                  <Text style={[styles.trackSelectBadgeText, candidate.didVote && styles.trackSelectBadgeTextOn]}>
                    {candidate.didVote ? '선택됨' : '선택'}
                  </Text>
                </View>
                {canDelete ? (
                  <Pressable
                    accessibilityLabel={`${candidate.title} 삭제`}
                    onPress={(event) => {
                      event.stopPropagation();
                      onDelete(candidate);
                    }}
                    disabled={deletingCandidateId === candidate.id || submittingId !== null}
                    style={[
                      styles.trackActionButton,
                      (deletingCandidateId === candidate.id || submittingId !== null) && styles.trackActionButtonDisabled,
                    ]}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>

          </Pressable>
        );
      })}
      {canAddCandidate ? (
        <Pressable
          style={({ pressed }) => [
            styles.addTrackRow,
            pressed && styles.addTrackRowPressed,
          ]}
          onPress={onAddCandidate}
        >
          <View style={styles.addTrackArtwork}>
            <Ionicons name="add" size={25} color={theme.colors.primaryDark} />
          </View>
          <View style={styles.addTrackBody}>
            <Text style={styles.addTrackText}>후보곡 추가</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
      <SongPreviewModal candidate={previewCandidate} onClose={() => setPreviewCandidate(null)} />
    </View>
  );
}

function SongPreviewModal({ candidate, onClose }: { candidate: SongCandidateDto | null; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const playerWidth = Math.min(width - 32, 560);

  useEffect(() => {
    setReady(false);
  }, [candidate?.id]);

  return (
    <Modal visible={Boolean(candidate)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.previewModalBackdrop} onPress={onClose}>
        <Pressable style={[styles.previewModalCard, { width: playerWidth }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.previewModalHeader}>
            <View style={styles.previewModalText}>
              <Text style={styles.previewModalTitle} numberOfLines={1}>{candidate?.title}</Text>
              <Text style={styles.previewModalArtist} numberOfLines={1}>{candidate?.artist}</Text>
            </View>
            <Pressable accessibilityLabel="영상 닫기" style={styles.previewModalClose} onPress={onClose}>
              <Ionicons name="close" size={21} color={theme.colors.text} />
            </Pressable>
          </View>
          {candidate?.youtubeVideoId ? (
            <View style={styles.previewModalPlayer}>
              <YoutubePlayer
                width={playerWidth}
                height={playerWidth * 9 / 16}
                videoId={candidate.youtubeVideoId}
                play={ready}
                forceAndroidAutoplay
                mute={false}
                volume={100}
                initialPlayerParams={{ controls: true, rel: false, playsinline: true }}
                onReady={() => setReady(true)}
                webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
              />
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerInfoButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  headerInfoButtonPressed: {
    backgroundColor: theme.colors.primarySoft,
  },
  section: {
    gap: 8,
  },
  flowSection: {
    gap: 12,
    marginBottom: 8,
  },
  voteSection: {
    gap: 14,
  },
  voteHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  voteHeaderTitle: {
    color: theme.colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  voteHeaderBadge: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd8ff',
    backgroundColor: '#f7f5ff',
  },
  voteHeaderBadgeText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  voteSelectionStatus: {
    minWidth: 58,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 8,
  },
  voteSelectionStatusText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  voteEntry: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 13,
  },
  voteEntryPressed: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  voteEntryIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteEntryBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  voteEntryTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  voteEntryMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
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
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '900',
  },
  candidateList: {
    gap: 10,
  },
  trackRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e7eb',
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  trackRowInner: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  trackRowMain: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
  },
  trackRowSelected: {
    borderColor: '#b9b0f5',
    backgroundColor: '#f8f7ff',
  },
  trackRowPressed: {
    transform: [{ scale: 0.996 }],
    opacity: 0.96,
  },
  trackRowDisabled: {
    borderColor: theme.colors.border,
  },
  trackArtwork: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20242c',
  },
  trackArtworkImage: {
    borderRadius: 12,
    resizeMode: 'cover',
  },
  trackPlayButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(18, 20, 24, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  trackTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  trackTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  trackTitle: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  trackArtist: {
    flexShrink: 1,
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  trackRightActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  trackVoteCountWrap: {
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackSelectBadge: {
    minHeight: 28,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
  },
  trackSelectBadgeOn: {
    backgroundColor: '#e9e6ff',
  },
  trackSelectBadgeText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  trackSelectBadgeTextOn: {
    color: theme.colors.primaryDark,
  },
  trackMeta: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackVoteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackWarning: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  trackActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  trackVoteCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  trackVoteCountSelected: {
    color: theme.colors.primaryDark,
  },
  trackActionButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceMuted,
  },
  trackActionButtonDisabled: {
    opacity: 0.45,
  },
  addTrackRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e7eb',
    backgroundColor: theme.colors.surface,
  },
  addTrackRowPressed: {
    transform: [{ scale: 0.996 }],
    opacity: 0.95,
  },
  addTrackArtwork: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTrackBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  addTrackText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  previewModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 12, 18, 0.68)',
    padding: 16,
  },
  previewModalCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  previewModalHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  previewModalText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  previewModalTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  previewModalArtist: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  previewModalClose: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewModalPlayer: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  candidateCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  candidateRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  candidatePreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: '#20242c',
  },
  candidatePreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20242c',
  },
  candidatePreviewImage: {
    resizeMode: 'cover',
  },
  previewPlayButton: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 22, 28, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateBody: {
    minWidth: 0,
    padding: 12,
    gap: 6,
  },
  candidateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  candidateTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  candidateArtist: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  candidateWarning: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  candidateBottomRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  candidateVoteCount: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  candidateVoteCountSelected: {
    color: theme.colors.primaryDark,
  },
  candidateVoteButton: {
    minWidth: 70,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
  },
  candidateVoteButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  candidateVoteButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  addCandidateRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
  },
  addCandidateIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCandidateText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  carouselShell: {
    gap: 8,
  },
  carouselContent: {
    alignItems: 'center',
    paddingRight: 16,
  },
  songVoteCard: {
    minHeight: 310,
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
  addSongCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surfaceMuted,
  },
  addSongCardDisabled: {
    backgroundColor: '#f1f3f5',
    borderColor: '#cfd5dd',
    opacity: 0.72,
  },
  addSongIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  addSongIconDisabled: {
    backgroundColor: '#e2e6eb',
  },
  addSongTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  addSongTitleDisabled: {
    color: theme.colors.textMuted,
  },
  youtubeFallback: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20242c',
    overflow: 'hidden',
  },
  youtubeFallbackImage: {
    resizeMode: 'cover',
  },
  youtubeFallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 8, 22, 0.42)',
  },
  previewButton: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 22, 28, 0.82)',
    paddingHorizontal: 11,
  },
  previewButtonDisabled: {
    opacity: 0.55,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  songCardBody: {
    flex: 1,
    padding: 12,
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
    fontSize: 13,
    fontWeight: '800',
  },
  songCardVoteCount: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  songCardVoteCountSelected: {
    color: theme.colors.primary,
  },
  songCardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
  songTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
  },
  songCardArtist: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  songCardWarning: {
    color: '#d1475d',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  songDeleteButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  songDeleteButtonDisabled: {
    opacity: 0.45,
  },
  songDeleteIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  songDeleteButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  compactVoteButton: {
    minHeight: 40,
    marginTop: 'auto',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  compactVoteButtonSelected: {
    backgroundColor: theme.colors.primary,
  },
  compactVoteButtonDisabled: {
    opacity: 0.5,
  },
  compactVoteButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  compactVoteButtonTextSelected: {
    color: '#fff',
  },
  actionStack: {
    gap: 8,
  },
  voteCompleteButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
  },
  voteCompleteButtonDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  voteCompleteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  voteEndButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e7eb',
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteEndButtonDisabled: {
    opacity: 0.45,
  },
  voteEndButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  listGroup: {
    gap: 10,
  },
  songCardShell: {
    borderRadius: theme.radius.md,
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
    padding: 12,
  },
  songListItemPressed: {
    backgroundColor: theme.colors.surfaceMuted,
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
    width: 36,
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
    right: 0,
    zIndex: 20,
    elevation: 8,
    width: 58,
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
    fontSize: 13,
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
    width: 96,
    height: 96,
    borderRadius: theme.radius.md,
    backgroundColor: '#20242c',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  songCoverImage: {
    borderRadius: theme.radius.md,
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
    fontSize: 13,
    fontWeight: '700',
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
