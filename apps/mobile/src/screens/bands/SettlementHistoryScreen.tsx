import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SettlementRoundDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'SettlementHistory'>;

export function SettlementHistoryScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [rounds, setRounds] = useState<SettlementRoundDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setError(null);
      setRounds(await api.get<SettlementRoundDto[]>(`/bands/${bandId}/settlement/history`));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '정산 내역을 불러오지 못했어요.');
    }
  }, [bandId]);

  useEffect(() => navigation.addListener('focus', () => void load()), [load, navigation]);

  if (!rounds) {
    return <Screen><View style={styles.center}>{error ? <Text style={styles.muted}>{error}</Text> : <ActivityIndicator color={theme.colors.primary} />}</View></Screen>;
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      {rounds.length === 0 ? (
        <View style={styles.empty}><Ionicons name="receipt-outline" size={28} color={theme.colors.textMuted} /><Text style={styles.muted}>완료된 정산이 없어요.</Text></View>
      ) : rounds.map((round) => (
        <Pressable
          key={round.id}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => navigation.navigate('SettlementDetail', { bandId, settlementId: round.id })}
        >
          <View style={styles.icon}><Ionicons name="checkmark" size={16} color={theme.colors.accent} /></View>
          <View style={styles.grow}>
            <Text style={styles.amount}>{round.totalAmount.toLocaleString('ko-KR')}원</Text>
            <Text style={styles.meta}>{formatDate(round.completedAt)} · {round.participants.length}명</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ))}
    </Screen>
  );
}

function formatDate(value: string | null) { return value ? new Date(value).toLocaleDateString('ko-KR') : ''; }

const styles = StyleSheet.create({
  content: { gap: 10 }, center: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  pressed: { opacity: 0.7 }, icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EAF8F0', alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 }, amount: { fontSize: 16, fontWeight: '900', color: theme.colors.text }, meta: { marginTop: 4, fontSize: 13, color: theme.colors.textMuted },
  empty: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 }, muted: { color: theme.colors.textMuted },
});
