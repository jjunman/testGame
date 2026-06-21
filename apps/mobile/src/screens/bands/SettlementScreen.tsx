import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BandMemberSummary, SettlementDto, StudioCandidateDto, StudioDto } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Settlement'>;
type SettlementOption = {
  id: string;
  source: 'candidate' | 'studio';
  studioId: string;
  name: string;
  address: string | null;
  hourlyPrice: number | null;
  voteCount?: number;
  status?: StudioCandidateDto['status'];
};

const REFRESH_MS = 5000;

export function SettlementScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [candidates, setCandidates] = useState<StudioCandidateDto[]>([]);
  const [studios, setStudios] = useState<StudioDto[]>([]);
  const [members, setMembers] = useState<BandMemberSummary[]>([]);
  const [settlement, setSettlement] = useState<SettlementDto | null>(null);
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [customTotalText, setCustomTotalText] = useState('');
  const [totalFocused, setTotalFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const options = useMemo(() => buildOptions(candidates, studios), [candidates, studios]);
  const selected = options.find((option) => option.studioId === selectedStudioId) ?? options[0] ?? null;
  const customTotalPrice = parsePrice(customTotalText);
  const totalPrice = customTotalPrice ?? selected?.hourlyPrice ?? null;
  const participantIds = new Set(settlement?.participantUserIds ?? members.map((member) => member.userId));
  const paidIds = new Set(settlement?.paidUserIds ?? []);
  const participatingMembers = members.filter((member) => participantIds.has(member.userId));
  const splitCount = Math.max(1, participatingMembers.length);
  const perMemberPrice = totalPrice === null ? null : Math.ceil(totalPrice / splitCount);
  const paidCount = participatingMembers.filter((member) => paidIds.has(member.userId)).length;
  const unpaidCount = Math.max(0, participatingMembers.length - paidCount);

  const saveSettlement = useCallback(async (body: Partial<SettlementDto>) => {
    savingRef.current = true;
    try {
      const updated = await api.patch<SettlementDto>(`/bands/${bandId}/settlement`, body);
      setSettlement(updated);
      setSelectedStudioId(updated.selectedStudioId);
      if (!totalFocused) {
        setCustomTotalText(updated.customTotalPrice === null ? '' : String(updated.customTotalPrice));
      }
      return updated;
    } finally {
      savingRef.current = false;
    }
  }, [bandId, totalFocused]);

  const load = useCallback(async (silent = false) => {
    if (silent) {
      if (savingRef.current || totalFocused) {
        return;
      }
      try {
        const nextSettlement = await api.get<SettlementDto>(`/bands/${bandId}/settlement`);
        setSettlement(nextSettlement);
        setSelectedStudioId((current) => resolveSelectedStudioId(nextSettlement.selectedStudioId ?? current, options));
        setCustomTotalText(nextSettlement.customTotalPrice === null ? '' : String(nextSettlement.customTotalPrice));
      } catch {
        // Keep the current screen steady during background refresh failures.
      }
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const [nextCandidates, nextStudios, nextMembers, nextSettlement] = await Promise.all([
        api.get<StudioCandidateDto[]>(`/bands/${bandId}/studio-candidates`),
        api.get<StudioDto[]>(`/bands/${bandId}/studios`),
        api.get<BandMemberSummary[]>(`/bands/${bandId}/members`),
        api.get<SettlementDto>(`/bands/${bandId}/settlement`),
      ]);
      const normalizedMembers = nextMembers.map((member) => ({
        ...member,
        profileImageUrl: toApiAssetUrl(member.profileImageUrl),
      }));
      const nextOptions = buildOptions(nextCandidates, nextStudios);
      const nextSelectedStudioId = resolveSelectedStudioId(nextSettlement.selectedStudioId, nextOptions);

      setCandidates(nextCandidates);
      setStudios(nextStudios);
      setMembers(normalizedMembers);
      setSettlement(nextSettlement);
      setSelectedStudioId(nextSelectedStudioId);
      if (!totalFocused) {
        setCustomTotalText(nextSettlement.customTotalPrice === null ? '' : String(nextSettlement.customTotalPrice));
      }
      if (nextSelectedStudioId !== nextSettlement.selectedStudioId) {
        void saveSettlement({ selectedStudioId: nextSelectedStudioId });
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '정산 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [bandId, options, saveSettlement, totalFocused]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [load, navigation]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load(true);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const selectOption = (option: SettlementOption) => {
    setSelectedStudioId(option.studioId);
    setCustomTotalText('');
    void saveSettlement({ selectedStudioId: option.studioId, customTotalPrice: null });
  };

  const saveTotalPrice = () => {
    setTotalFocused(false);
    void saveSettlement({ customTotalPrice: parsePrice(customTotalText) });
  };

  const toggleParticipant = (userId: string) => {
    if (!settlement) {
      return;
    }
    const current = new Set(settlement.participantUserIds);
    if (current.has(userId)) {
      if (current.size <= 1) {
        return;
      }
      current.delete(userId);
    } else {
      current.add(userId);
    }
    const participantUserIds = members.map((member) => member.userId).filter((id) => current.has(id));
    const paidUserIds = settlement.paidUserIds.filter((id) => current.has(id));
    setSettlement({ ...settlement, participantUserIds, paidUserIds });
    void saveSettlement({ participantUserIds, paidUserIds });
  };

  const togglePaid = (userId: string) => {
    if (!settlement || !participantIds.has(userId)) {
      return;
    }
    const current = new Set(settlement.paidUserIds);
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    const paidUserIds = members.map((member) => member.userId).filter((id) => current.has(id) && participantIds.has(id));
    setSettlement({ ...settlement, paidUserIds });
    void saveSettlement({ paidUserIds });
  };

  const markAllPaid = () => {
    if (!settlement) {
      return;
    }
    const paidUserIds = participatingMembers.map((member) => member.userId);
    setSettlement({ ...settlement, paidUserIds });
    void saveSettlement({ paidUserIds });
  };

  const clearPaid = () => {
    if (!settlement) {
      return;
    }
    setSettlement({ ...settlement, paidUserIds: [] });
    void saveSettlement({ paidUserIds: [] });
  };

  const resetDraft = () => {
    if (!settlement) {
      return;
    }
    const participantUserIds = members.map((member) => member.userId);
    setCustomTotalText('');
    setSettlement({ ...settlement, customTotalPrice: null, participantUserIds, paidUserIds: [] });
    void saveSettlement({ customTotalPrice: null, participantUserIds, paidUserIds: [] });
  };

  if (loadError) {
    return (
      <Screen fixedFooter={<BandInnerNav bandId={bandId} active="settlement" navigation={navigation} />}>
        <View style={styles.loadingCard}>
          <Text style={styles.errorTitle}>불러오기 실패</Text>
          <Text style={styles.mutedText}>{loadError}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (loading || !settlement) {
    return (
      <Screen fixedFooter={<BandInnerNav bandId={bandId} active="settlement" navigation={navigation} />}>
        <View style={styles.loadingCard}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>정산 정보를 불러오는 중이에요.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="settlement" navigation={navigation} />}>
      {selected ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryTitleBlock}>
                <Text style={styles.summaryLabel}>선택한 합주실</Text>
                <Text style={styles.summaryTitle} numberOfLines={2}>{selected.name}</Text>
              </View>
              <View style={styles.summaryHeaderActions}>
                {selected.status === 'confirmed' ? <StatusBadge label="등록됨" tone="success" /> : null}
                <Pressable style={styles.resetChip} onPress={resetDraft}>
                  <Ionicons name="refresh-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={styles.resetChipText}>초기화</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.priceHero}>
              <Text style={styles.priceLabel}>1인 정산액</Text>
              <Text style={styles.priceValue}>{formatPrice(perMemberPrice)}</Text>
              <Text style={styles.priceMeta}>{formatPrice(totalPrice)} / 참여 {splitCount}명</Text>
            </View>

            <View style={styles.overrideBox}>
              <Text style={styles.overrideLabel}>직접 입력</Text>
              <View style={styles.overrideInputWrap}>
                <TextInput
                  value={customTotalText}
                  onChangeText={setCustomTotalText}
                  onFocus={() => setTotalFocused(true)}
                  onBlur={saveTotalPrice}
                  placeholder={selected?.hourlyPrice === null || selected?.hourlyPrice === undefined
                    ? '가격'
                    : selected.hourlyPrice.toLocaleString('ko-KR')}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="number-pad"
                  style={styles.overrideInput}
                />
                <Text style={styles.overrideUnit}>원</Text>
              </View>
            </View>

            {selected.address ? <Text style={styles.addressText}>{selected.address}</Text> : null}
          </View>

          <View style={styles.splitCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>참여 멤버</Text>
              <Text style={styles.sectionHint}>합주에 참여하는 멤버를 선택해주세요</Text>
            </View>
            <View style={styles.participantList}>
              {members.map((member) => {
                const included = participantIds.has(member.userId);
                return (
                  <Pressable
                    key={member.userId}
                    style={[styles.participantRow, !included && styles.participantRowOff]}
                    onPress={() => toggleParticipant(member.userId)}
                  >
                    <MemberAvatar member={member} included={included} />
                    <View style={styles.memberText}>
                      <Text style={[styles.memberName, !included && styles.memberNameOff]}>{member.name}</Text>
                      <Text style={styles.memberPosition}>{member.positionLabel}</Text>
                    </View>
                    <Text style={[styles.participantStatus, included && styles.participantStatusOn]}>
                      {included ? '참여' : '불참'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.checkCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>입금 체크</Text>
              <Text style={styles.sectionHint}>{paidCount}명 완료 · {unpaidCount}명 남음</Text>
            </View>
            <View style={styles.checkActions}>
              <Pressable style={styles.smallActionButton} onPress={markAllPaid}>
                <Text style={styles.smallActionText}>전체 완료</Text>
              </Pressable>
              <Pressable style={styles.smallActionButtonMuted} onPress={clearPaid}>
                <Text style={styles.smallActionMutedText}>전체 해제</Text>
              </Pressable>
            </View>
            <View style={styles.memberList}>
              {members.map((member) => {
                const included = participantIds.has(member.userId);
                const paid = paidIds.has(member.userId);
                return (
                  <Pressable
                    key={member.userId}
                    disabled={!included}
                    style={[styles.memberRow, paid && styles.memberRowPaid, !included && styles.memberRowDisabled]}
                    onPress={() => togglePaid(member.userId)}
                  >
                    <MemberAvatar member={member} included={included} />
                    <View style={styles.memberText}>
                      <Text style={[styles.memberName, !included && styles.memberNameOff]}>{member.name}</Text>
                      <Text style={styles.memberPosition}>{included ? member.positionLabel : '불참으로 제외됨'}</Text>
                    </View>
                    <Text style={[styles.memberPrice, paid && styles.memberPricePaid, !included && styles.memberPriceOff]}>
                      {included ? formatPrice(perMemberPrice) : '제외'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>합주실 선택</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionScroller}>
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  style={[styles.optionCard, selected.studioId === option.studioId && styles.optionCardSelected]}
                  onPress={() => selectOption(option)}
                >
                  <View style={styles.optionTop}>
                    <Text style={styles.optionSource}>{option.source === 'candidate' ? '후보' : '목록'}</Text>
                    {option.status === 'confirmed' ? <StatusBadge label="등록됨" tone="success" /> : null}
                  </View>
                  <Text style={styles.optionName} numberOfLines={2}>{option.name}</Text>
                  <Text style={styles.optionPrice}>{formatPrice(option.hourlyPrice)}</Text>
                  <Text style={styles.optionMeta}>합주실 등록 가격</Text>
                  {typeof option.voteCount === 'number' ? <Text style={styles.optionMeta}>투표 {option.voteCount}표</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </>
      ) : (
        <EmptyState
          title="정산할 합주실이 아직 없어요"
          description="합주실 후보를 추가하거나 합주실을 확정하면 여기에서 1인 정산액을 계산할 수 있어요."
        />
      )}
    </Screen>
  );
}

function buildOptions(candidates: StudioCandidateDto[], studios: StudioDto[]): SettlementOption[] {
  const candidateOptions: SettlementOption[] = candidates.map((candidate) => ({
    id: `candidate:${candidate.id}`,
    source: 'candidate' as const,
    studioId: candidate.studio.id,
    name: candidate.studio.name,
    address: candidate.studio.address,
    hourlyPrice: candidate.studio.hourlyPrice,
    voteCount: candidate.voteCount,
    status: candidate.status,
  }));
  const candidateStudioIds = new Set(candidates.map((candidate) => candidate.studio.id));
  const studioOptions: SettlementOption[] = studios
    .filter((studio) => !candidateStudioIds.has(studio.id))
    .map((studio) => ({
      id: `studio:${studio.id}`,
      source: 'studio' as const,
      studioId: studio.id,
      name: studio.name,
      address: studio.address,
      hourlyPrice: studio.hourlyPrice,
    }));

  return [...candidateOptions, ...studioOptions].sort((a, b) => {
    if (Number(b.status === 'confirmed') !== Number(a.status === 'confirmed')) {
      return Number(b.status === 'confirmed') - Number(a.status === 'confirmed');
    }
    return 0;
  });
}

function resolveSelectedStudioId(value: string | null, options: SettlementOption[]) {
  if (value && options.some((option) => option.studioId === value)) {
    return value;
  }
  const confirmed = options.find((option) => option.status === 'confirmed');
  return confirmed?.studioId ?? options[0]?.studioId ?? null;
}

function parsePrice(value: string) {
  const normalized = value.replace(/[^0-9]/g, '');
  return normalized ? Number(normalized) : null;
}

function formatPrice(value: number | null) {
  return value === null ? '가격 미정' : `${value.toLocaleString('ko-KR')}원`;
}

function MemberAvatar({ member, included }: { member: BandMemberSummary; included: boolean }) {
  return (
    <View style={[styles.avatar, !included && styles.avatarOff]}>
      {member.profileImageUrl ? (
        <Image source={{ uri: member.profileImageUrl }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarInitial}>{member.name.slice(0, 1)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    minHeight: 160,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 12,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  errorTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  mutedText: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  summaryCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 15,
    gap: 13,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryHeaderActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  resetChip: {
    minHeight: 30,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetChipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  summaryTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryTitle: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 25,
  },
  priceHero: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    padding: 15,
    gap: 4,
  },
  priceLabel: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  priceValue: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  priceMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  overrideBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 12,
    gap: 8,
  },
  overrideLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  overrideInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
  },
  overrideInput: {
    flex: 1,
    minHeight: 44,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    paddingVertical: 8,
  },
  overrideUnit: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  overrideHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  addressText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  splitCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    gap: 3,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  participantList: {
    gap: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  participantRowOff: {
    opacity: 0.72,
    backgroundColor: theme.colors.surface,
  },
  participantStatus: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  participantStatusOn: {
    color: theme.colors.primaryDark,
  },
  checkCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  checkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallActionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: '#9de5dc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionButtonMuted: {
    flex: 1,
    minHeight: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  smallActionMutedText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  memberRowPaid: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#9de5dc',
  },
  memberRowDisabled: {
    opacity: 0.58,
  },
  memberText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  memberName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  memberNameOff: {
    color: theme.colors.textMuted,
  },
  memberPosition: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  memberPrice: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  memberPricePaid: {
    color: theme.colors.accent,
    textDecorationLine: 'line-through',
  },
  memberPriceOff: {
    color: theme.colors.textMuted,
    textDecorationLine: 'none',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOff: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitial: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  optionScroller: {
    gap: 10,
    paddingRight: 6,
  },
  optionCard: {
    width: 190,
    minHeight: 156,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 8,
  },
  optionCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#fbfaff',
  },
  optionTop: {
    minHeight: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  optionSource: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  optionName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  optionPrice: {
    marginTop: 'auto',
    color: theme.colors.primaryDark,
    fontSize: 17,
    fontWeight: '900',
  },
  optionMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
});
