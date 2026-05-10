import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PositionType } from '@band/shared-types';
import { api } from '../../api/client';
import { PositionSelector } from '../../components/PositionSelector';
import { Screen } from '../../components/Screen';
import { ErrorText, Field, HeroBanner, Label, PrimaryButton, SecondaryButton, SectionCard } from '../../components/UI';
import { fallbackBandImage } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'CreateBand'>;

export function CreateBandScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [positionType, setPositionType] = useState<PositionType>('lead_guitar');
  const [customPosition, setCustomPosition] = useState('');
  const [thumbnail, setThumbnail] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '밴드 썸네일을 고르려면 사진 보관함 접근 권한이 필요해요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    setThumbnail({
      uri: asset.uri,
      name: asset.fileName ?? `band-thumbnail.${asset.uri.split('.').pop() ?? 'jpg'}`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedCustomPosition = customPosition.trim();
    if (trimmedName.length < 2) {
      setError('밴드 이름은 2자 이상 입력해 주세요.');
      return;
    }
    if (positionType === 'custom' && trimmedCustomPosition.length === 0) {
      setError('직접 입력 포지션을 작성해 주세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (thumbnail) {
        const form = new FormData();
        form.append('name', trimmedName);
        form.append('positionType', positionType);
        if (positionType === 'custom') {
          form.append('customPosition', trimmedCustomPosition);
        }
        form.append('thumbnail', thumbnail as any);
        await api.post('/bands', form);
      } else {
        await api.post('/bands', {
          name: trimmedName,
          positionType,
          ...(positionType === 'custom' ? { customPosition: trimmedCustomPosition } : {}),
        });
      }
      navigation.popToTop();
    } catch (err) {
      setError(err instanceof Error ? err.message : '밴드 만들기에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <SectionCard title="밴드 만들기">
        <HeroBanner
          title="밴드 썸네일"
          subtitle="휴대폰 갤러리에서 밴드 대표 사진을 골라 주세요."
          imageUrl={thumbnail?.uri ?? fallbackBandImage}
          badge="Thumbnail"
        />
        <SecondaryButton label="갤러리에서 선택" onPress={pickImage} />
        <Label>밴드 이름</Label>
        <Field value={name} onChangeText={setName} placeholder="예: 합주 매니지먼트 밴드" />
        <PositionSelector
          value={positionType}
          onChange={setPositionType}
          customPosition={customPosition}
          onChangeCustomPosition={setCustomPosition}
        />
        <Text>초대코드는 6자리 랜덤 영문 대문자와 숫자로 자동 생성됩니다.</Text>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label="밴드 만들기" onPress={submit} loading={loading} />
      </SectionCard>
    </Screen>
  );
}
