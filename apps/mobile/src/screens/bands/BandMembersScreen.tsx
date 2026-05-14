import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BandMemberSummary } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { PrimaryButton, StatusBadge, TextButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'BandMembers'>;

export function BandMembersScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<BandMemberSummary[]>([]);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [bandActionLoading, setBandActionLoading] = useState(false);

  const load = useCallback(async () => {
    const result = await api.get<BandMemberSummary[]>(`/bands/${route.params.bandId}/members`);
    setMembers(result);
  }, [route.params.bandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myMembership = members.find((member) => member.userId === user?.id);
  const otherMembers = members.filter((member) => member.userId !== user?.id);
  const isLeader = myMembership?.role === 'leader';
  const averagePoints = useMemo(() => {
    if (members.length === 0) {
      return 0;
    }
    return Math.round(members.reduce((sum, member) => sum + member.volumePoints, 0) / members.length);
  }, [members]);

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
      Alert.alert('밴드 삭제', '리더에게는 밴드 삭제하기만 보여요. 정말 삭제할까요?', [
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
    <Screen fixedFooter={<BandInnerNav bandId={route.params.bandId} active="user" navigation={navigation} />}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>멤버</Text>
          <Text style={styles.headerSubtitle}>새 멤버도 기존 기록과 현재 할 일을 함께 확인해요.</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="people-outline" size={15} color={theme.colors.primaryDark} />
          <Text style={styles.headerBadgeText}>{members.length}명</Text>
        </View>
      </View>

      {myMembership ? (
        <View style={styles.myCard}>
          <View style={styles.myCardAccent} />
          <View style={styles.myTop}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberInitial}>{myMembership.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.myText}>
              <Text style={styles.myName} numberOfLines={1}>{myMembership.name}</Text>
              <Text style={styles.myMeta} numberOfLines={1}>
                {myMembership.positionLabel} · {myMembership.role === 'leader' ? '리더' : '멤버'}
              </Text>
            </View>
            <StatusBadge label={getVolumeTier(myMembership.volumePoints).badge} tone={getVolumeTier(myMembership.volumePoints).tone} />
          </View>
          <View style={styles.myStats}>
            <MiniStat icon="musical-notes-outline" label="내 포인트" value={`${myMembership.volumePoints}점`} />
            <MiniStat icon="stats-chart-outline" label="밴드 평균" value={`${averagePoints}점`} />
            <MiniStat icon="calendar-outline" label="가입" value={formatJoinDate(myMembership.joinedAt)} />
          </View>
          <PointsBar value={myMembership.volumePoints} />
        </View>
      ) : null}

      <View style={styles.syncCard}>
        <View style={styles.syncHeader}>
          <View style={styles.syncIcon}>
            <Ionicons name="checkmark-done-outline" size={18} color={theme.colors.accent} />
          </View>
          <View style={styles.syncHeaderText}>
            <Text style={styles.sectionTitle}>밴드 동기화</Text>
            <Text style={styles.syncHeaderSubtitle}>가입 즉시 현재 밴드 흐름에 맞춰져요.</Text>
          </View>
        </View>
        <View style={styles.syncRows}>
          <SyncRow icon="archive-outline" title="과거 활동" description="지난 투표, 확정곡, 연습 기록을 볼 수 있어요." />
          <SyncRow icon="flag-outline" title="현재 할 일" description="가입 후 마감되는 활동만 내 할 일로 잡혀요." />
          <SyncRow icon="shield-checkmark-outline" title="포인트" description="가입 전에 끝난 연습으로 감점되지 않아요." />
        </View>
      </View>

      <View style={styles.rosterSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>멤버 목록</Text>
          <Text style={styles.averageText}>평균 {averagePoints}점</Text>
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

function SyncRow({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.syncRow}>
      <View style={styles.syncRowIcon}>
        <Ionicons name={icon} size={17} color={theme.colors.primaryDark} />
      </View>
      <View style={styles.syncText}>
        <Text style={styles.syncTitle}>{title}</Text>
        <Text style={styles.syncDescription}>{description}</Text>
      </View>
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
      <View style={styles.memberAvatarSmall}>
        <Text style={styles.memberInitialSmall}>{member.name.slice(0, 1)}</Text>
      </View>
      <View style={styles.memberBody}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
          <View style={styles.memberBadges}>
            <Text style={styles.memberPointPill}>{member.volumePoints}점</Text>
            <StatusBadge label={member.role === 'leader' ? '리더' : '멤버'} tone={member.role === 'leader' ? 'warning' : 'default'} />
          </View>
        </View>
        <Text style={styles.memberMeta} numberOfLines={1}>
          {member.positionLabel} · 가입 {formatJoinDate(member.joinedAt)}
        </Text>
        {canTransfer ? (
          <PrimaryButton label="리더 권한 넘기기" onPress={onTransfer} loading={loading} style={styles.transferButton} />
        ) : null}
      </View>
    </View>
  );
}

function PointsBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const tier = getVolumeTier(value);

  return (
    <View style={styles.pointsWrap}>
      <View style={styles.pointsHeader}>
        <Text style={styles.pointsLabel}>볼륨 포인트</Text>
        <Text style={styles.pointsValue}>{safeValue}점</Text>
      </View>
      <View style={styles.pointsTrack}>
        <View style={[styles.pointsFill, { width: `${safeValue}%` }]} />
      </View>
      <Text style={styles.pointsDescription}>{tier.description}</Text>
    </View>
  );
}

function getVolumeTier(value: number): {
  badge: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  description: string;
} {
  if (value >= 35) {
    return {
      badge: '최상',
      tone: 'success',
      description: '연습 제출이 꾸준해서 투표 영향력이 가장 강한 상태예요.',
    };
  }
  if (value >= 25) {
    return {
      badge: '좋음',
      tone: 'success',
      description: '연습 흐름이 안정적이에요.',
    };
  }
  if (value >= 15) {
    return {
      badge: '보통',
      tone: 'warning',
      description: '마감 전 제출을 챙기면 금방 회복할 수 있어요.',
    };
  }
  return {
    badge: '주의',
    tone: 'danger',
    description: '다음 연습 제출부터 포인트를 회복해봐요.',
  };
}

function formatJoinDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerBadgeText: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  myCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 14,
    overflow: 'hidden',
  },
  myCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.primary,
  },
  myTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    color: theme.colors.primaryDark,
    fontSize: 20,
    fontWeight: '900',
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
    gap: 8,
  },
  miniStat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 9,
    gap: 4,
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
  pointsWrap: {
    gap: 8,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  pointsLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  pointsValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  pointsTrack: {
    height: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  pointsFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  pointsDescription: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  syncCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  syncHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  syncIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncHeaderText: {
    flex: 1,
    gap: 2,
  },
  syncHeaderSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  syncRows: {
    gap: 8,
  },
  syncRow: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 10,
  },
  syncRowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncText: {
    flex: 1,
    gap: 2,
  },
  syncTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  syncDescription: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  rosterSection: {
    gap: 10,
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
    gap: 11,
    padding: 13,
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
  },
  memberInitialSmall: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  memberBody: {
    flex: 1,
    gap: 6,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memberBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberPointPill: {
    overflow: 'hidden',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.text,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
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
    alignSelf: 'flex-start',
    minHeight: 34,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
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
