import React, { useState } from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PositionType } from '@band/shared-types';
import { api } from '../../api/client';
import { PositionSelector } from '../../components/PositionSelector';
import { Screen } from '../../components/Screen';
import { ErrorText, Field, Label, PrimaryButton, SectionCard } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'CreateBand'>;

export function CreateBandScreen({ navigation }: Props) {
  return (
    <Screen>
      <CreateBandForm onComplete={() => navigation.popToTop()} />
    </Screen>
  );
}

export function CreateBandForm({ onComplete }: { onComplete: () => void }) {
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
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : '밴드 만들기에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard>
        <View style={styles.thumbnailRow}>
          <ImageBackground
            source={{ uri: thumbnail?.uri ?? fallbackBandImage }}
            imageStyle={styles.thumbnailImage}
            style={styles.thumbnailPreview}
          >
            <View style={styles.thumbnailOverlay} />
          </ImageBackground>
          <View style={styles.thumbnailCopy}>
            <Text style={styles.thumbnailTitle}>밴드 썸네일</Text>
            <Text style={styles.thumbnailSubtitle}>밴드 대표 사진을 골라 주세요.</Text>
          </View>
          <Pressable
            accessibilityLabel="갤러리에서 밴드 썸네일 선택"
            accessibilityRole="button"
            onPress={pickImage}
            style={({ pressed }) => [styles.galleryButton, pressed && styles.galleryButtonPressed]}
          >
            <Ionicons name="pencil-outline" size={21} color={theme.colors.primaryDark} />
          </Pressable>
        </View>
        <Label>밴드 이름</Label>
        <Field value={name} onChangeText={setName} placeholder="예: 합주 매니지먼트 밴드" />
        <PositionSelector
          value={positionType}
          onChange={setPositionType}
          customPosition={customPosition}
          onChangeCustomPosition={setCustomPosition}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label="밴드 만들기" onPress={submit} loading={loading} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  thumbnailRow: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: '#fbfcfd',
    padding: 12,
  },
  thumbnailPreview: {
    width: 92,
    height: 72,
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  thumbnailImage: {
    borderRadius: theme.radius.sm,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  thumbnailCopy: {
    flex: 1,
    gap: 3,
  },
  thumbnailTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  thumbnailSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  galleryButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  galleryButtonPressed: {
    backgroundColor: theme.colors.primarySoft,
  },
});
