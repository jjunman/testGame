import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PositionType } from '@band/shared-types';
import { api } from '../../api/client';
import { PositionSelector } from '../../components/PositionSelector';
import { Screen } from '../../components/Screen';
import { ErrorText, Field, Label, PrimaryButton, SectionCard } from '../../components/UI';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'JoinBand'>;

export function JoinBandScreen({ navigation }: Props) {
  return (
    <Screen>
      <JoinBandForm onComplete={() => navigation.popToTop()} />
    </Screen>
  );
}

export function JoinBandForm({ onComplete }: { onComplete: () => void }) {
  const [inviteCode, setInviteCode] = useState('');
  const [positionType, setPositionType] = useState<PositionType>('lead_guitar');
  const [customPosition, setCustomPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const normalizedCode = inviteCode.trim().toUpperCase();
    const trimmedCustomPosition = customPosition.trim();
    if (normalizedCode.length === 0) {
      setError('초대코드를 입력해 주세요.');
      return;
    }
    if (positionType === 'custom' && trimmedCustomPosition.length === 0) {
      setError('직접 입력 포지션을 작성해 주세요.');
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
    <SectionCard title="초대코드 입력하기">
        <Label>초대코드</Label>
        <Field
          value={inviteCode}
          onChangeText={(value) => setInviteCode(value.toUpperCase())}
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
    </SectionCard>
  );
}
