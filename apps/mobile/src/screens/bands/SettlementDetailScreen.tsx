import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettlementRoundDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'SettlementDetail'>;

export function SettlementDetailScreen({ route, navigation }: Props) {
  const { bandId, settlementId } = route.params;
  const [round, setRound] = useState<SettlementRoundDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setRound(await api.get<SettlementRoundDto>(`/bands/${bandId}/settlement/${settlementId}`)); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : '정산 내역을 불러오지 못했어요.'); }
  }, [bandId, settlementId]);
  useEffect(() => navigation.addListener('focus', () => void load()), [load, navigation]);

  if (!round) return <Screen><View style={styles.center}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={theme.colors.primary} />}</View></Screen>;
  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.done}><Ionicons name="checkmark" size={18} color="#fff" /></View>
        <Text style={styles.label}>완료된 정산</Text>
        <Text style={styles.amount}>{round.totalAmount.toLocaleString('ko-KR')}원</Text>
        <Text style={styles.meta}>{formatDate(round.completedAt)} · {(round.participants ?? []).length}명</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>참여 내역</Text>
        {(round.participants ?? []).map((participant) => (
          <View key={participant.userId} style={styles.row}>
            <View style={styles.initial}><Text style={styles.initialText}>{participant.memberName.slice(0, 1)}</Text></View>
            <Text style={styles.name}>{participant.memberName}</Text>
            <Text style={styles.share}>{participant.amount.toLocaleString('ko-KR')}원</Text>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
          </View>
        ))}
      </View>
      <Text style={styles.audit}>생성 {round.createdByName} · 마지막 처리 {round.updatedByName}</Text>
    </Screen>
  );
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleString('ko-KR') : ''; }
const styles = StyleSheet.create({
  content: { gap: 16 }, center: { minHeight: 300, alignItems: 'center', justifyContent: 'center' }, error: { color: theme.colors.textMuted },
  hero: { backgroundColor: '#fff', borderRadius: theme.radius.md, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  done: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }, label: { marginTop: 10, color: theme.colors.textMuted, fontWeight: '700' }, amount: { marginTop: 5, fontSize: 30, fontWeight: '900', color: theme.colors.text }, meta: { marginTop: 7, color: theme.colors.textMuted },
  card: { backgroundColor: '#fff', borderRadius: theme.radius.md, padding: 18, borderWidth: 1, borderColor: theme.colors.border }, title: { marginBottom: 8, fontSize: 17, fontWeight: '800', color: theme.colors.text },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 }, initial: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, initialText: { fontWeight: '900', color: theme.colors.primaryDark }, name: { flex: 1, fontWeight: '800', color: theme.colors.text }, share: { fontWeight: '900', color: theme.colors.text }, audit: { textAlign: 'center', fontSize: 13, color: theme.colors.textMuted },
});
