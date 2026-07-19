import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { PositionType } from '@band/shared-types';
import { api } from '../../api/client';
import { PositionSelector } from '../../components/PositionSelector';
import { Screen } from '../../components/Screen';
import { ErrorText, Field, Label, PrimaryButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'JoinBand'>;

export function JoinBandScreen({ route, navigation }: Props) {
  return (
    <Screen>
      <JoinBandForm initialInviteCode={route.params?.inviteCode} onComplete={() => navigation.popToTop()} />
    </Screen>
  );
}

export function JoinBandForm({ initialInviteCode, onComplete }: { initialInviteCode?: string; onComplete: () => void }) {
  const [inviteCode, setInviteCode] = useState(() => normalizeInviteCode(initialInviteCode ?? ''));
  const [positionType, setPositionType] = useState<PositionType>('lead_guitar');
  const [customPosition, setCustomPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialInviteCode) {
      setInviteCode(normalizeInviteCode(initialInviteCode));
    }
  }, [initialInviteCode]);

  const submit = async () => {
    const normalizedCode = normalizeInviteCode(inviteCode);
    const trimmedCustomPosition = customPosition.trim();
    if (normalizedCode.length === 0) {
      setError('초대코드를 입력해 주세요.');
      return;
    }
    if (positionType === 'custom' && trimmedCustomPosition.length === 0) {
      setError('직접 포지션을 작성해 주세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/bands/join', {
        inviteCode: normalizedCode,
        positionType,
        ...(positionType === 'custom' ? { customPosition: trimmedCustomPosition } : {}),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '밴드 가입에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.form}>
        <Text style={styles.formTitle}>초대코드 입력하기</Text>
        <Label>초대코드</Label>
        <Field
          value={inviteCode}
          onChangeText={(value) => setInviteCode(normalizeInviteCode(value))}
          autoCapitalize="characters"
          placeholder="6자리 코드를 입력.."
        />
        <PositionSelector
          value={positionType}
          onChange={setPositionType}
          customPosition={customPosition}
          onChangeCustomPosition={setCustomPosition}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label="가입하기" onPress={submit} loading={loading} />
    </View>
  );
}

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  formTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sectionTitle,
    fontWeight: '800',
    marginBottom: 4,
  },
});
