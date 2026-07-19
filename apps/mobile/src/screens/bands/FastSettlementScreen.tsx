import React, { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BandMemberSummary, SettlementOverviewDto, SettlementRoundDto } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Settlement'>;
type DeadlinePreset = '30s' | 1 | 3 | 7;

export function FastSettlementScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [members, setMembers] = useState<BandMemberSummary[]>([]);
  const [overview, setOverview] = useState<SettlementOverviewDto | null>(null);
  const [amountText, setAmountText] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>(3);
  const [editing, setEditing] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedRoundIds, setExpandedRoundIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(700)).current;

  const load = useCallback(async () => {
    try {
      const [nextMembers, nextOverview] = await Promise.all([
        api.get<BandMemberSummary[]>(`/bands/${bandId}/members`),
        api.get<SettlementOverviewDto>(`/bands/${bandId}/settlement`),
      ]);
      setMembers(nextMembers.map((member) => ({ ...member, profileImageUrl: toApiAssetUrl(member.profileImageUrl) })));
      const normalizedOverview: SettlementOverviewDto = {
        activeRounds: Array.isArray(nextOverview?.activeRounds) ? nextOverview.activeRounds : [],
        outstandingRounds: Array.isArray(nextOverview?.outstandingRounds) ? nextOverview.outstandingRounds : [],
        outstandingSummary: nextOverview?.outstandingSummary ?? { totalAmount: 0, unpaidCount: 0, unpaidMemberCount: 0 },
        recentCompleted: Array.isArray(nextOverview?.recentCompleted) ? nextOverview.recentCompleted : [],
      };
      setOverview(normalizedOverview);
      const normalizedOngoingRounds = [...normalizedOverview.activeRounds, ...normalizedOverview.outstandingRounds];
      setExpandedRoundIds((current) => current.length === 0 && normalizedOngoingRounds.length === 1
        ? [normalizedOngoingRounds[0].id]
        : current.filter((id) => normalizedOngoingRounds.some((round) => round.id === id)));
    } catch (error) {
      Alert.alert('불러오기 실패', errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [bandId]);

  useEffect(() => navigation.addListener('focus', () => void load()), [load, navigation]);
  useEffect(() => {
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const beginEdit = (round: SettlementRoundDto) => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(700);
    setAmountText(String(round.totalAmount));
    setSelectedIds(round.participants.map((participant) => participant.userId));
    setEditingRoundId(round.id);
    setEditing(true);
    requestAnimationFrame(() => setComposerOpen(true));
  };

  const beginNew = () => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(700);
    setSelectedIds(members.map((member) => member.userId));
    setAmountText('');
    setDeadlinePreset(3);
    setEditing(false);
    setEditingRoundId(null);
    requestAnimationFrame(() => setComposerOpen(true));
  };

  const closeComposer = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 700, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setEditing(false);
      setEditingRoundId(null);
      setComposerOpen(false);
    });
  }, [backdropOpacity, sheetTranslateY]);

  const toggleMember = (userId: string) => {
    setSelectedIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]);
  };

  const toggleRoundDetails = (roundId: string) => {
    setExpandedRoundIds((current) => current.includes(roundId)
      ? current.filter((id) => id !== roundId)
      : [...current, roundId]);
  };

  const saveRound = async () => {
    const totalAmount = parseAmount(amountText);
    if (!totalAmount) return Alert.alert('총 금액을 입력해주세요.');
    if (selectedIds.length === 0) return Alert.alert('참여 멤버를 1명 이상 포함해주세요.');
    setSaving(true);
    try {
      const editingRound = [...(overview?.activeRounds ?? [])]
        .find((round) => round?.id === editingRoundId);
      if (editing && editingRound) {
        await api.patch(`/bands/${bandId}/settlement/${editingRound.id}`, {
          totalAmount,
          participantUserIds: selectedIds,
          version: editingRound.version,
        });
        Alert.alert('정산을 수정했어요', '금액이 바뀔 수 있어 기존 입금 상태를 모두 초기화했어요.');
      } else {
        await api.post(`/bands/${bandId}/settlement`, {
          totalAmount,
          participantUserIds: selectedIds,
          deadlineDays: deadlinePreset === '30s' ? 3 : deadlinePreset,
          ...(deadlinePreset === '30s' ? { deadlineSeconds: 30 } : {}),
        });
      }
      closeComposer();
      await load();
    } catch (error) {
      Alert.alert('저장하지 못했어요', errorMessage(error));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async (round: SettlementRoundDto, userId: string, paid: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await api.patch<SettlementRoundDto>(
        `/bands/${bandId}/settlement/${round.id}/participants/${userId}/payment`,
        { paid, version: round.version },
      );
      if (updated.status === 'completed') Alert.alert('정산 완료', '모두 입금해서 이번 정산이 자동으로 완료됐어요.');
      await load();
    } catch (error) {
      Alert.alert('상태를 바꾸지 못했어요', errorMessage(error));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const confirmPaymentChange = (
    round: SettlementRoundDto,
    participant: SettlementRoundDto['participants'][number],
    nextPaid: boolean,
  ) => {
    Alert.alert(
      nextPaid ? '입금하기' : '입금 취소',
      nextPaid
        ? `${formatPrice(participant.amount)}을 입금하시겠습니까?`
        : `${formatPrice(participant.amount)}의 입금을 취소하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: nextPaid ? '입금하기' : '입금 취소',
          style: nextPaid ? 'default' : 'destructive',
          onPress: () => void togglePaid(round, participant.userId, nextPaid),
        },
      ],
    );
  };

  const activeRounds = overview?.activeRounds ?? [];
  const outstandingRounds = overview?.outstandingRounds ?? [];
  const ongoingRounds = [...activeRounds, ...outstandingRounds];
  const recentCompleted = overview?.recentCompleted ?? [];
  const showComposer = composerOpen;
  const deferredAmountText = useDeferredValue(amountText);
  const preview = distribute(parseAmount(deferredAmountText) ?? 0, selectedIds);

  useEffect(() => {
    const nextDeadline = activeRounds.reduce<number | null>((nearest, round) => {
      const value = new Date(round.deadlineAt).getTime();
      return nearest === null || value < nearest ? value : nearest;
    }, null);
    if (nextDeadline === null) return;
    const timer = setTimeout(() => void load(), Math.max(0, nextDeadline - Date.now()) + 750);
    return () => clearTimeout(timer);
  }, [activeRounds, load]);

  const openComposerAnimation = useCallback(() => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(700);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [backdropOpacity, sheetTranslateY]);

  if (loading || !overview) {
    return <Screen fixedFooter={<BandInnerNav bandId={bandId} active="settlement" navigation={navigation} />}><View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View></Screen>;
  }

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="settlement" navigation={navigation} />} contentContainerStyle={styles.content}>
      <Modal
        visible={showComposer}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeComposer}
        onShow={openComposerAnimation}
      >
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View pointerEvents="box-none" style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={styles.backdropPressable} onPress={closeComposer} />
          </Animated.View>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <View style={styles.titleRow}>
            <View><Text style={styles.eyebrow}>{editing ? '진행 중 정산 수정' : '새 정산'}</Text><Text style={styles.title}>얼마를 나눌까요?</Text></View>
            <Pressable onPress={closeComposer}><Text style={styles.cancel}>취소</Text></Pressable>
          </View>
          <View style={styles.amountBox}>
            <TextInput
              value={amountText}
              onChangeText={(value) => setAmountText(value.replace(/\D/g, '').replace(/^0+/, ''))}
              keyboardType="number-pad"
              placeholder="총 금액"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.amountInput}
            />
            <Text style={styles.won}>원</Text>
          </View>
          {parseAmount(deferredAmountText) ? (
            <Text style={styles.amountGuide}>{formatKoreanAmount(parseAmount(deferredAmountText) ?? 0)}</Text>
          ) : null}
          {!editing ? (
            <View style={styles.deadlineSection}>
              <Text style={styles.sectionTitle}>마감 기한</Text>
              <View style={styles.deadlineOptions}>
                {(['30s', 1, 3, 7] as const).map((preset) => (
                  <Pressable key={preset} onPress={() => setDeadlinePreset(preset)} style={[styles.deadlineOption, deadlinePreset === preset && styles.deadlineOptionActive]}>
                    <Text style={[styles.deadlineOptionText, deadlinePreset === preset && styles.deadlineOptionTextActive]}>{preset === '30s' ? '30초' : `${preset}일`}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>참여 멤버</Text><Text style={styles.count}>{selectedIds.length}명</Text></View>
          {members.map((member) => {
            const selected = selectedIds.includes(member.userId);
            return (
              <Pressable key={member.userId} onPress={() => toggleMember(member.userId)} style={[styles.memberRow, selected && styles.memberSelected]}>
                <Avatar name={member.name} uri={member.profileImageUrl} />
                <View style={styles.grow}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberSub}>{selected ? formatPrice(preview[member.userId] ?? 0) : '정산 제외'}</Text></View>
                <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={25} color={selected ? theme.colors.primary : theme.colors.textMuted} />
              </Pressable>
            );
          })}
            </ScrollView>
            <View style={styles.sheetFooter}>
              {editing ? <Text style={styles.warning}>수정하면 모든 멤버의 입금 상태가 초기화돼요.</Text> : null}
              <Pressable disabled={saving || !parseAmount(amountText)} onPress={() => void saveRound()} style={[styles.primaryButton, (saving || !parseAmount(amountText)) && styles.disabled]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{editing ? '수정 저장하기' : '정산 요청하기'}</Text>}
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.overviewPanel}>
        <View style={styles.overviewHeader}>
          <View>
            <Text style={styles.overviewTitle}>정산 현황</Text>
          </View>
          <Pressable onPress={beginNew} style={({ pressed }) => [styles.overviewAddButton, pressed && styles.startButtonPressed]}>
            <Ionicons name="add" size={19} color="#fff" />
            <Text style={styles.overviewAddText}>새 정산</Text>
          </Pressable>
        </View>
        <View style={styles.overviewMetrics}>
          <SettlementMetric icon="time-outline" label="전체 진행" value={`${ongoingRounds.length}건`} tone={ongoingRounds.length > 0 ? 'primary' : 'neutral'} divider />
          <SettlementMetric icon="people-outline" label="미입금" value={`${overview.outstandingSummary.unpaidMemberCount}명`} tone={overview.outstandingSummary.unpaidMemberCount > 0 ? 'danger' : 'neutral'} divider />
          <SettlementMetric icon="wallet-outline" label="미입금액" value={formatPrice(overview.outstandingSummary.totalAmount)} tone="neutral" />
        </View>
      </View>

      {ongoingRounds.length > 0 ? (
        <View style={styles.carouselSection}>
          <View style={styles.carouselHeader}>
            <View>
              <Text style={styles.activeListTitle}>진행 중 정산</Text>
            </View>
            <Text style={styles.carouselCount}>{ongoingRounds.length}건</Text>
          </View>
          <View style={styles.roundList}>
            {ongoingRounds.map((round) => {
              const paidCount = round.participants.filter((item) => item.paid).length;
              const unpaidCount = round.participants.length - paidCount;
              return (
              <View key={round.id} style={[styles.card, round.status === 'outstanding' && styles.outstandingCard]}>
                <View style={styles.titleRow}>
                  <View style={styles.settlementTitleBlock}>
                    <Text style={styles.settlementCardTitle}>{formatPrice(round.totalAmount)}</Text>
                    <Text style={[styles.eyebrow, isDeadlineUrgent(round.deadlineAt) && styles.urgentDeadline]}>{deadlineLabel(round.deadlineAt)}</Text>
                  </View>
                  <View style={styles.cardStatusGroup}>
                    <StatusBadge label={round.status === 'outstanding' ? '미입금' : '진행 중'} tone={round.status === 'outstanding' ? 'danger' : 'default'} />
                    {round.status === 'active' ? <Pressable style={styles.editButton} onPress={() => beginEdit(round)}><Ionicons name="pencil" size={14} color={theme.colors.textMuted} /></Pressable> : null}
                  </View>
                </View>
                <View style={styles.settlementInfoGrid}>
                  <SettlementInfoCell icon="checkmark-circle-outline" label="입금 완료" value={`${paidCount}명`} />
                  <SettlementInfoCell icon="people-outline" label="미입금" value={`${unpaidCount}명`} danger={unpaidCount > 0} />
                  <SettlementInfoCell icon="calendar-outline" label="마감" value={formatDate(round.deadlineAt)} />
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${round.participants.length === 0 ? 0 : Math.round((paidCount / round.participants.length) * 100)}%` },
                    ]}
                  />
                </View>
                <Pressable style={styles.detailsToggle} onPress={() => toggleRoundDetails(round.id)}>
                  <Text style={styles.detailsToggleText}>{expandedRoundIds.includes(round.id) ? '입금 현황 접기' : '입금 현황 보기'}</Text>
                  <Ionicons name={expandedRoundIds.includes(round.id) ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.primaryDark} />
                </Pressable>
                {expandedRoundIds.includes(round.id) ? (
                  <View style={styles.participantList}>
                    {round.participants.map((participant) => (
                      <View key={participant.userId} style={styles.memberRow}>
                        <Avatar name={participant.memberName} uri={toApiAssetUrl(participant.profileImageUrl)} />
                        <View style={styles.grow}><Text style={styles.memberName}>{participant.memberName}</Text><Text style={styles.memberSub}>{formatPrice(participant.amount)}</Text></View>
                        <Pressable disabled={saving} onPress={() => confirmPaymentChange(round, participant, !participant.paid)} style={[styles.paidButton, participant.paid && styles.paidButtonOn]}>
                          {participant.paid ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                          <Text style={[styles.paidText, participant.paid && styles.paidTextOn]}>{participant.paid ? '완료' : '입금하기'}</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );})}
          </View>
        </View>
      ) : null}

      {recentCompleted.length > 0 ? (
        <View style={styles.history}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>최근 완료 정산</Text>
            <Pressable onPress={() => navigation.navigate('SettlementHistory', { bandId })}>
              <Text style={styles.moreText}>더보기</Text>
            </Pressable>
          </View>
          {recentCompleted.slice(0, 3).map((round) => (
            <Pressable key={round.id} style={styles.historyRowCompact} onPress={() => navigation.navigate('SettlementDetail', { bandId, settlementId: round.id })}>
              <Text style={styles.historyDateCompact}>{formatDate(round.completedAt)}</Text>
              <Text style={styles.historyAmountCompact}>{formatPrice(round.totalAmount)}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function SettlementMetric({
  icon,
  label,
  value,
  tone,
  divider = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: 'neutral' | 'primary' | 'accent' | 'danger';
  divider?: boolean;
}) {
  const iconColor = tone === 'danger'
    ? theme.colors.danger
    : tone === 'accent'
      ? theme.colors.accent
      : tone === 'primary'
        ? theme.colors.primaryDark
        : theme.colors.textMuted;

  return (
    <View
      style={[
        styles.overviewMetric,
        tone === 'primary' && styles.overviewMetricPrimary,
        tone === 'accent' && styles.overviewMetricAccent,
        tone === 'danger' && styles.overviewMetricDanger,
        divider && styles.overviewMetricDivider,
      ]}
    >
      <View style={styles.overviewMetricHeader}>
        <Ionicons name={icon} size={15} color={iconColor} />
        <Text style={styles.overviewMetricLabel}>{label}</Text>
      </View>
      <Text
        style={[
          styles.overviewMetricValue,
          tone === 'primary' && styles.overviewMetricValuePrimary,
          tone === 'accent' && styles.overviewMetricValueAccent,
          tone === 'danger' && styles.overviewMetricValueDanger,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function SettlementInfoCell({
  icon,
  label,
  value,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <View style={styles.settlementInfoCell}>
      <View style={styles.settlementInfoHeader}>
        <Ionicons name={icon} size={14} color={danger ? theme.colors.danger : theme.colors.primary} />
        <Text style={styles.settlementInfoLabel}>{label}</Text>
      </View>
      <Text style={[styles.settlementInfoValue, danger && styles.settlementInfoValueDanger]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Avatar({ name, uri }: { name: string; uri: string | null }) {
  return <View style={styles.avatar}>{uri ? <Image source={{ uri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.slice(0, 1)}</Text>}</View>;
}

function distribute(total: number, ids: string[]) {
  if (!ids.length) return {} as Record<string, number>;
  const base = Math.floor(total / ids.length);
  const remainder = total % ids.length;
  return Object.fromEntries(ids.map((id, index) => [id, base + (index < remainder ? 1 : 0)]));
}

function parseAmount(value: string) { const digits = value.replace(/\D/g, ''); return digits ? Number(digits) : null; }
function formatInput(value: string) { const amount = parseAmount(value); return amount === null ? '' : amount.toLocaleString('ko-KR'); }
function formatPrice(value: number) { return `${value.toLocaleString('ko-KR')}원`; }
function formatKoreanAmount(value: number) {
  const amount = Math.max(0, Math.floor(value));
  const man = Math.floor(amount / 10_000);
  const cheon = Math.floor((amount % 10_000) / 1_000);
  const won = amount % 1_000;
  const parts: string[] = [];
  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (cheon > 0) parts.push(`${cheon}천`);
  if (won > 0 || parts.length === 0) parts.push(won.toLocaleString('ko-KR'));
  return `${parts.join(' ')}원`;
}
function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString('ko-KR') : ''; }
function deadlineLabel(value: string) {
  const remaining = new Date(value).getTime() - Date.now();
  const hours = Math.max(0, Math.ceil(remaining / (60 * 60 * 1000)));
  if (hours <= 24) return `${hours}시간 후 마감`;
  return `${Math.ceil(hours / 24)}일 후 마감`;
}
function isDeadlineUrgent(value: string) {
  const remaining = new Date(value).getTime() - Date.now();
  return remaining > 0 && remaining < 24 * 60 * 60 * 1000;
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.'; }

const styles = StyleSheet.create({
  content: { gap: 24 }, center: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  overviewPanel: { gap: 14, paddingTop: 2 },
  overviewHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  overviewTitle: { color: theme.colors.text, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  overviewAddButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  overviewAddText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  overviewMetrics: { minHeight: 82, flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: '#e6e7eb', backgroundColor: theme.colors.surface, paddingVertical: 12, ...theme.shadow.card },
  overviewMetric: { flex: 1, minWidth: 0, paddingHorizontal: 12, justifyContent: 'space-between', gap: 8 },
  overviewMetricPrimary: {},
  overviewMetricAccent: {},
  overviewMetricDanger: {},
  overviewMetricDivider: { borderRightWidth: 1, borderRightColor: '#ececf0' },
  overviewMetricHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  overviewMetricLabel: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  overviewMetricValue: { color: theme.colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  overviewMetricValuePrimary: { color: theme.colors.primaryDark },
  overviewMetricValueAccent: { color: theme.colors.accent },
  overviewMetricValueDanger: { color: theme.colors.danger },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(22, 27, 24, 0.46)' },
  backdropPressable: { flex: 1 },
  sheet: { height: '76%', backgroundColor: theme.colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 10 },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 16 },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: '#fff' },
  card: { backgroundColor: theme.colors.surface, borderRadius: 14, padding: 18, gap: 14, borderWidth: 1, borderColor: '#e6e7eb', ...theme.shadow.card },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, eyebrow: { marginTop: 3, fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  urgentDeadline: { color: theme.colors.danger },
  title: { marginTop: 4, fontSize: 22, fontWeight: '900', color: theme.colors.text }, cancel: { color: theme.colors.textMuted, fontWeight: '700' },
  amountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 16 },
  amountInput: { flex: 1, paddingVertical: 16, fontSize: 25, fontWeight: '900', fontVariant: ['tabular-nums'], color: theme.colors.text, textAlign: 'right' }, won: { marginLeft: 8, fontSize: 17, fontWeight: '800', color: theme.colors.text },
  amountGuide: { marginTop: -5, paddingHorizontal: 4, color: theme.colors.textMuted, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  deadlineSection: { gap: 9 },
  deadlineOptions: { flexDirection: 'row', gap: 8 },
  deadlineOption: { flex: 1, minHeight: 42, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  deadlineOptionActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  deadlineOptionText: { color: theme.colors.textMuted, fontWeight: '800' },
  deadlineOptionTextActive: { color: theme.colors.primaryDark },
  sectionHeader: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }, sectionTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text }, count: { color: theme.colors.primaryDark, fontWeight: '800' },
  memberRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: theme.radius.md }, memberSelected: { backgroundColor: theme.colors.primarySoft },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarText: { fontWeight: '900', color: theme.colors.primaryDark },
  grow: { flex: 1 }, memberName: { fontSize: 15, fontWeight: '800', color: theme.colors.text }, memberSub: { marginTop: 3, fontSize: 13, color: theme.colors.textMuted },
  primaryButton: { alignSelf: 'stretch', marginTop: 8, minHeight: 54, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.4 }, primaryText: { color: '#fff', fontWeight: '900', fontSize: 16 }, warning: { textAlign: 'center', color: theme.colors.textMuted, fontSize: 13 },
  heroAmount: { marginTop: 4, fontSize: 28, lineHeight: 34, fontWeight: '900', color: theme.colors.text }, editButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, editText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  progress: { color: theme.colors.textMuted, fontWeight: '700' }, divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 3 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.colors.surfaceMuted },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },
  detailsToggle: { minHeight: 42, borderRadius: 12, backgroundColor: theme.colors.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 1 },
  detailsToggleText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '800' },
  participantList: { borderTopWidth: 1, borderTopColor: '#ececf2', paddingTop: 8 },
  paidButton: { minWidth: 82, minHeight: 34, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' }, paidButtonOn: { backgroundColor: theme.colors.primaryDark, borderColor: theme.colors.primaryDark }, paidText: { fontSize: 13, fontWeight: '800', color: theme.colors.textMuted }, paidTextOn: { color: '#fff' },
  history: { gap: 8 }, historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, historyIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyRowCompact: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 2 },
  historyDateCompact: { flex: 1, color: theme.colors.textMuted, fontSize: 13, lineHeight: 20, textAlignVertical: 'center' },
  historyAmountCompact: { color: theme.colors.text, fontSize: 14, lineHeight: 20, fontWeight: '800', textAlignVertical: 'center' },
  moreText: { color: theme.colors.primary, fontWeight: '800' },
  startCard: { backgroundColor: '#fff', borderRadius: theme.radius.md, padding: 18, borderWidth: 1, borderColor: theme.colors.border, gap: 14 },
  startCardText: { gap: 4 },
  startCardTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.text },
  startCardDescription: { fontSize: 13, lineHeight: 19, color: theme.colors.textMuted },
  listTitle: { marginTop: 2, fontSize: 15, fontWeight: '800', color: theme.colors.textMuted },
  activeListTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: theme.colors.text },
  carouselSection: { gap: 11 },
  roundList: { gap: 14 },
  carouselHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  carouselCount: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  cardStatusGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  carouselPager: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  pagerButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  pagerButtonDisabled: { opacity: 0.3 },
  pagerText: { minWidth: 52, color: theme.colors.text, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  settlementTitleBlock: { flex: 1, minWidth: 0 },
  settlementCardTitle: { color: theme.colors.text, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  settlementInfoGrid: { flexDirection: 'row', gap: 7 },
  settlementInfoCell: { flex: 1, minWidth: 0, minHeight: 68, borderRadius: 12, borderWidth: 1, borderColor: '#ececf2', backgroundColor: '#f8f8fb', paddingHorizontal: 9, paddingVertical: 10, justifyContent: 'space-between', gap: 6 },
  settlementInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  settlementInfoLabel: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '800' },
  settlementInfoValue: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  settlementInfoValueDanger: { color: theme.colors.danger },
  outstandingCard: { backgroundColor: theme.colors.surface, borderColor: '#e6e7eb' },
  outstandingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  outstandingDate: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted },
  outstandingAmount: { fontSize: 19, fontWeight: '900', color: theme.colors.text },
  outstandingMeta: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '700' },
  compactMemberRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  compactMemberName: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '800', color: theme.colors.text },
  compactMemberAmount: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '700' },
  compactPaidButton: { minHeight: 28, paddingHorizontal: 9, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  compactPaidText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '800' },
  outstandingEditButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F0F1F3' },
  outstandingEditText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  emptyCard: { backgroundColor: '#fff', borderRadius: theme.radius.md, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 14, fontSize: 19, fontWeight: '900', color: theme.colors.text },
  emptyDescription: { marginTop: 6, marginBottom: 16, color: theme.colors.textMuted },
  startButton: { minHeight: 48, paddingHorizontal: 24, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  startCardCompact: { minHeight: 80, backgroundColor: '#fff', borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  startCardLead: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  startIconCompact: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  startTitleCompact: { color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  startDescriptionCompact: { marginTop: 2, color: theme.colors.textMuted, fontSize: 13 },
  startButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
