import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BandMemberSummary } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { HeroBanner, MetricPill, PrimaryButton, SectionCard, StatusBadge } from '../../components/UI';
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
      <HeroBanner title="내 정보" subtitle="포지션과 볼륨 포인트를 확인해요." badge={`${members.length}명`} />

      {myMembership ? (
        <SectionCard title={myMembership.name}>
          <View style={styles.myInfoRow}>
            <StatusBadge label={myMembership.role === 'leader' ? '리더' : '멤버'} tone={myMembership.role === 'leader' ? 'warning' : 'default'} />
            <StatusBadge label={myMembership.positionLabel} />
          </View>
          <VolumeKnob value={myMembership.volumePoints} />
          <VolumeBenefitCard value={myMembership.volumePoints} />
        </SectionCard>
      ) : null}

      {otherMembers.length > 0 ? (
        <SectionCard title="멤버">
          {otherMembers.map((member) => {
            const canTransfer = isLeader && member.role !== 'leader';

            return (
              <View key={member.userId} style={styles.memberCard}>
                <View style={styles.memberHeader}>
                  <View style={styles.memberMeta}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <View style={styles.badgeRow}>
                      <StatusBadge label={member.role === 'leader' ? '리더' : '멤버'} tone={member.role === 'leader' ? 'warning' : 'default'} />
                      <StatusBadge label={member.positionLabel} />
                    </View>
                  </View>
                  <MetricPill label="포인트" value={member.volumePoints} />
                </View>
                {canTransfer ? (
                  <PrimaryButton
                    label="리더 권한 넘기기"
                    onPress={() => transferLeader(member.userId, member.name)}
                    loading={loadingUserId === member.userId}
                  />
                ) : null}
              </View>
            );
          })}
        </SectionCard>
      ) : null}

      {myMembership ? (
        <PrimaryButton
          label={isLeader ? '밴드 삭제' : '밴드 나가기'}
          onPress={confirmBandAction}
          loading={bandActionLoading}
          style={styles.dangerButton}
        />
      ) : null}
    </Screen>
  );
}

function VolumeKnob({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const angle = -90 + safeValue * 1.8;
  const labels = useMemo(() => Array.from({ length: 11 }, (_, index) => index * 10), []);
  const dialSize = 150;
  const dialRadius = dialSize / 2;
  const centerX = 120;
  const centerY = 124;
  const labelRadius = 102;

  return (
    <View style={styles.knobWrap}>
      <View style={styles.volumeBadge}>
        <Text style={styles.volumeBadgeText}>내 볼륨 포인트 : {safeValue}</Text>
      </View>
      <View style={styles.knobArea}>
        {labels.map((label) => {
          const angleDeg = 180 + (label / 100) * 180;
          const radian = (angleDeg * Math.PI) / 180;
          const x = centerX + Math.cos(radian) * labelRadius;
          const y = centerY + Math.sin(radian) * labelRadius;

          return (
            <Text
              key={label}
              style={[
                styles.knobLabel,
                {
                  left: x - 12,
                  top: y - 10,
                },
              ]}
            >
              {label}
            </Text>
          );
        })}

        <View style={[styles.knobDial, { width: dialSize, height: dialSize, borderRadius: dialRadius }]}>
          <View style={[styles.knobNeedle, { width: dialSize, height: dialSize, transform: [{ rotate: `${angle}deg` }] }]}>
            <View style={styles.knobNeedleBar} />
          </View>
        </View>
      </View>
    </View>
  );
}

function VolumeBenefitCard({ value }: { value: number }) {
  const tier = getVolumeTier(value);

  return (
    <View style={styles.benefitCard}>
      <View style={styles.benefitHeader}>
        <Text style={styles.benefitTitle}>{tier.name}</Text>
        <StatusBadge label={tier.badge} tone={tier.tone} />
      </View>
      <Text style={styles.benefitText}>{tier.description}</Text>
      <View style={styles.benefitRules}>
        <Text style={styles.benefitRule}>마감 전 제출: +1 포인트</Text>
        <Text style={styles.benefitRule}>마감 후 미제출: -1 포인트</Text>
        <Text style={styles.benefitRule}>합주곡 투표: 내 포인트가 표의 무게가 돼요</Text>
      </View>
    </View>
  );
}

function getVolumeTier(value: number): {
  name: string;
  badge: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  description: string;
} {
  if (value >= 35) {
    return {
      name: '공연 준비 핵심 멤버',
      badge: '최상',
      tone: 'success',
      description: '연습 제출이 꾸준해서 투표 영향력이 가장 강한 상태예요.',
    };
  }
  if (value >= 25) {
    return {
      name: '믿고 가는 멤버',
      badge: '좋음',
      tone: 'success',
      description: '연습을 잘 챙기고 있어요. 이 흐름이면 곡 선정에서도 힘이 실려요.',
    };
  }
  if (value >= 15) {
    return {
      name: '회복 가능한 상태',
      badge: '보통',
      tone: 'warning',
      description: '몇 번만 제때 제출하면 다시 영향력을 올릴 수 있어요.',
    };
  }
  return {
    name: '연습 리듬 재정비 필요',
    badge: '주의',
    tone: 'danger',
    description: '미제출이 쌓이면 투표 영향력이 약해져요. 다음 과제부터 회복해봐요.',
  };
}

const styles = StyleSheet.create({
  myInfoRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  knobWrap: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 4,
  },
  benefitCard: {
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 14,
    gap: 10,
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  benefitTitle: {
    flex: 1,
    color: theme.colors.primaryDark,
    fontSize: 15,
    fontWeight: '900',
  },
  benefitText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  benefitRules: {
    gap: 5,
  },
  benefitRule: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  volumeBadge: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#7c6be8',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  volumeBadgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  knobArea: {
    width: 240,
    height: 248,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobLabel: {
    position: 'absolute',
    width: 24,
    textAlign: 'center',
    color: '#1f173e',
    fontSize: 12,
    fontWeight: '800',
  },
  knobDial: {
    backgroundColor: '#3f3f40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobNeedle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  knobNeedleBar: {
    width: 16,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#efefef',
    marginTop: 16,
  },
  memberCard: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#ece6ff',
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  memberMeta: {
    flex: 1,
    gap: 8,
  },
  memberName: {
    color: theme.colors.primaryDark,
    fontSize: 16,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dangerButton: {
    backgroundColor: theme.colors.danger,
  },
});
