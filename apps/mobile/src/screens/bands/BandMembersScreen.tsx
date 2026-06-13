import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BandHomeDto, BandMemberSummary } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { TextButton } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'BandMembers'>;

export function BandMembersScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<BandMemberSummary[]>([]);
  const [bandDetail, setBandDetail] = useState<BandHomeDto | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [profileImageLoading, setProfileImageLoading] = useState(false);
  const [bandActionLoading, setBandActionLoading] = useState(false);

  const load = useCallback(async () => {
    const [nextMembers, nextBandDetail] = await Promise.all([
      api.get<BandMemberSummary[]>(`/bands/${route.params.bandId}/members`),
      api.get<BandHomeDto>(`/bands/${route.params.bandId}`),
    ]);
    setMembers(nextMembers.map((member) => ({
      ...member,
      profileImageUrl: toApiAssetUrl(member.profileImageUrl),
    })));
    setBandDetail({
      ...nextBandDetail,
      thumbnailUrl: toApiAssetUrl(nextBandDetail.thumbnailUrl),
    });
  }, [route.params.bandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myMembership = members.find((member) => member.userId === user?.id);
  const otherMembers = members.filter((member) => member.userId !== user?.id);
  const isLeader = myMembership?.role === 'leader';

  const pickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '프로필 사진을 고르려면 사진 보관함 접근 권한이 필요해요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    const profileImage = {
      uri: asset.uri,
      name: asset.fileName ?? `profile-image.${asset.uri.split('.').pop() ?? 'jpg'}`,
      type: asset.mimeType ?? 'image/jpeg',
    };
    const form = new FormData();
    form.append('profileImage', profileImage as any);

    setProfileImageLoading(true);
    try {
      const updatedMember = await api.patch<BandMemberSummary>(`/bands/${route.params.bandId}/members/me/profile-image`, form);
      const normalizedMember = {
        ...updatedMember,
        profileImageUrl: toApiAssetUrl(updatedMember.profileImageUrl),
      };
      setMembers((current) => current.map((member) => (member.userId === normalizedMember.userId ? normalizedMember : member)));
    } catch (error) {
      Alert.alert('변경 실패', error instanceof Error ? error.message : '프로필 사진 변경에 실패했어요.');
    } finally {
      setProfileImageLoading(false);
    }
  };

  const transferLeader = async (targetUserId: string, memberName: string) => {
    Alert.alert('리더 권한 변경', `${memberName} 님에게 리더 권한을 넘길까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '변경하기',
        onPress: async () => {
          setLoadingUserId(targetUserId);
          try {
            await api.patch(`/bands/${route.params.bandId}/leader`, { targetUserId });
            Alert.alert('변경 완료', `${memberName} 님이 이제 리더예요.`);
            await load();
          } catch (error) {
            Alert.alert('변경 실패', error instanceof Error ? error.message : '리더 권한 변경에 실패했어요.');
          } finally {
            setLoadingUserId(null);
          }
        },
      },
    ]);
  };

  const leaveBand = async () => {
    setBandActionLoading(true);
    try {
      await api.delete(`/bands/${route.params.bandId}/membership`);
      Alert.alert('밴드 탈퇴 완료', '밴드에서 탈퇴했어요.');
      navigation.popToTop();
    } catch (error) {
      Alert.alert('탈퇴 실패', error instanceof Error ? error.message : '밴드 탈퇴에 실패했어요.');
    } finally {
      setBandActionLoading(false);
    }
  };

  const deleteBand = async () => {
    setBandActionLoading(true);
    try {
      await api.delete(`/bands/${route.params.bandId}`);
      Alert.alert('밴드 삭제 완료', '밴드를 삭제했어요.');
      navigation.popToTop();
    } catch (error) {
      Alert.alert('삭제 실패', error instanceof Error ? error.message : '밴드 삭제에 실패했어요.');
    } finally {
      setBandActionLoading(false);
    }
  };

  const confirmBandAction = () => {
    if (isLeader) {
      Alert.alert('밴드 삭제', '밴드 삭제하기는 리더에게만 보여요. 정말 삭제할까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '밴드 삭제하기',
          style: 'destructive',
          onPress: () => {
            void deleteBand();
          },
        },
      ]);
      return;
    }

    Alert.alert('밴드 탈퇴', '이 밴드에서 나가시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '밴드 탈퇴하기',
        style: 'destructive',
        onPress: () => {
          void leaveBand();
        },
      },
    ]);
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={route.params.bandId} active="home" navigation={navigation} />}>
      {bandDetail ? (
        <View style={styles.bandInfoCard}>
          <ImageBackground
            source={{ uri: bandDetail.thumbnailUrl || fallbackBandImage }}
            imageStyle={styles.bandThumbImage}
            style={styles.bandThumb}
          >
            <View style={styles.bandThumbOverlay} />
            <Ionicons name="musical-notes-outline" size={22} color="#fff" />
          </ImageBackground>
          <View style={styles.bandInfoBody}>
            <Text style={styles.bandInfoLabel}>밴드 정보</Text>
            <Text style={styles.bandInfoName} numberOfLines={1}>{bandDetail.name}</Text>
            <Text style={styles.bandInfoMeta} numberOfLines={1}>
              {(bandDetail.myMembership.positionLabel || '파트 미정')} · {bandDetail.myMembership.role === 'leader' ? '리더' : '멤버'}
            </Text>
          </View>
          <View style={styles.bandInfoStats}>
            <InfoPill label="멤버" value={`${bandDetail.memberCount}명`} />
            <InfoPill label="초대코드" value={bandDetail.inviteCode} />
          </View>
        </View>
      ) : null}

      {myMembership ? (
        <View style={styles.myCard}>
          <View style={styles.myTop}>
            <Pressable
              accessibilityLabel="프로필 사진 변경"
              accessibilityRole="button"
              onPress={pickProfileImage}
              disabled={profileImageLoading}
              style={({ pressed }) => [styles.memberAvatarButton, pressed && styles.memberAvatarButtonPressed]}
            >
              <MemberAvatar member={myMembership} size="large" />
              <View style={styles.profileEditBadge}>
                {profileImageLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="camera-outline" size={14} color="#fff" />
                )}
              </View>
            </Pressable>
            <View style={styles.myText}>
              <Text style={styles.myName} numberOfLines={1}>{myMembership.name}</Text>
              <Text style={styles.myMeta} numberOfLines={1}>
                {myMembership.positionLabel} · {myMembership.role === 'leader' ? '리더' : '멤버'}
              </Text>
            </View>
          </View>
          <View style={styles.myStats}>
            <MiniStat icon="calendar-outline" label="가입" value={formatJoinDate(myMembership.joinedAt)} />
          </View>
        </View>
      ) : null}

      <View style={styles.rosterSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>멤버 목록</Text>
          <Text style={styles.averageText}>{members.length}명</Text>
        </View>
        <View style={styles.rosterList}>
          {otherMembers.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              canTransfer={Boolean(isLeader && member.role !== 'leader')}
              loading={loadingUserId === member.userId}
              onTransfer={() => transferLeader(member.userId, member.name)}
            />
          ))}
          {otherMembers.length === 0 ? (
            <View style={styles.emptyRoster}>
              <Text style={styles.emptyTitle}>아직 다른 멤버가 없어요</Text>
              <Text style={styles.emptyText}>초대코드를 공유하면 가입한 멤버가 이 목록에 바로 나타나요.</Text>
            </View>
          ) : null}
        </View>
      </View>

      {myMembership ? (
        <TextButton
          label={isLeader ? '밴드 삭제' : '밴드 나가기'}
          tone="danger"
          onPress={confirmBandAction}
          disabled={bandActionLoading}
          style={styles.leaveButton}
        />
      ) : null}
    </Screen>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillLabel}>{label}</Text>
      <Text style={styles.infoPillValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={15} color={theme.colors.textMuted} />
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MemberAvatar({ member, size }: { member: BandMemberSummary; size: 'large' | 'small' }) {
  const large = size === 'large';
  const avatarStyle = large ? styles.memberAvatar : styles.memberAvatarSmall;
  const initialStyle = large ? styles.memberInitial : styles.memberInitialSmall;

  return (
    <View style={avatarStyle}>
      {member.profileImageUrl ? (
        <Image source={{ uri: member.profileImageUrl }} style={styles.memberAvatarImage} />
      ) : (
        <Text style={initialStyle}>{member.name.slice(0, 1)}</Text>
      )}
    </View>
  );
}

function MemberRow({
  member,
  canTransfer,
  loading,
  onTransfer,
}: {
  member: BandMemberSummary;
  canTransfer: boolean;
  loading: boolean;
  onTransfer: () => void;
}) {
  return (
    <View style={styles.memberRow}>
      <MemberAvatar member={member} size="small" />
      <View style={styles.memberBody}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
        </View>
        <Text style={styles.memberMeta} numberOfLines={1}>
          {member.positionLabel} · 가입 {formatJoinDate(member.joinedAt)}
        </Text>
      </View>
      {canTransfer ? (
        <Pressable onPress={onTransfer} disabled={loading} style={[styles.transferButton, loading && styles.transferButtonDisabled]}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.transferButtonText}>리더 권한 넘기기</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function formatJoinDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  bandInfoCard: {
    minHeight: 104,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  bandThumb: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandThumbImage: {
    borderRadius: theme.radius.sm,
  },
  bandThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  bandInfoBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  bandInfoLabel: {
    color: theme.colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  bandInfoName: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  bandInfoMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  bandInfoStats: {
    width: 88,
    gap: 7,
  },
  infoPill: {
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 2,
  },
  infoPillLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  infoPillValue: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  myCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 18,
    overflow: 'hidden',
  },
  myTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatarButton: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarButtonPressed: {
    opacity: 0.78,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  memberInitial: {
    color: theme.colors.primaryDark,
    fontSize: 20,
    fontWeight: '900',
  },
  profileEditBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myText: {
    flex: 1,
    gap: 3,
  },
  myName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  myMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  myStats: {
    flexDirection: 'row',
    gap: 10,
  },
  miniStat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 12,
    gap: 5,
  },
  miniStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  miniStatValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  rosterSection: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  averageText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  rosterList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  memberAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberInitialSmall: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memberName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  memberMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  transferButton: {
    alignSelf: 'center',
    minHeight: 34,
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
  },
  transferButtonDisabled: {
    opacity: 0.55,
  },
  transferButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyRoster: {
    alignItems: 'center',
    padding: 20,
    gap: 6,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '700',
  },
  leaveButton: {
    alignSelf: 'center',
  },
});
