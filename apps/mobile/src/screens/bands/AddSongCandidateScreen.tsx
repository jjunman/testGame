import React, { useMemo, useState } from 'react';
import { Alert, KeyboardTypeOptions, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { Field, HeroBanner, Label, PrimaryButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'AddSongCandidate'>;

export function AddSongCandidateScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && artist.trim().length > 0 && youtubeUrl.trim().length > 0,
    [artist, title, youtubeUrl],
  );

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('입력 필요', '곡 제목, 가수, 유튜브 링크를 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/bands/${bandId}/song-candidates`, {
        title: title.trim(),
        artist: artist.trim(),
        youtubeUrl: youtubeUrl.trim(),
      });
      Alert.alert('제출 완료', '후보곡을 추가했습니다.', [
        { text: '확인', onPress: () => navigation.navigate('SongRound', { bandId, initialTab: 'vote' }) },
      ]);
    } catch (error) {
      Alert.alert('제출 실패', error instanceof Error ? error.message : '후보곡을 추가하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="vote" navigation={navigation} />}>
      <HeroBanner
        title="후보곡 추가하기"
        subtitle="곡 제목, 가수, 유튜브 링크만 입력하면 바로 후보로 올라가요."
        badge="후보 등록"
      />

      <View style={styles.formCard}>
        <Text style={styles.title}>곡 정보</Text>
        <InputRow label="곡 제목" value={title} onChangeText={setTitle} placeholder="예: No Pain" />
        <InputRow label="가수" value={artist} onChangeText={setArtist} placeholder="예: 실리카겔" />
        <InputRow
          label="유튜브 링크"
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <PrimaryButton label="제출하기" onPress={submit} loading={submitting} disabled={!canSubmit} />
    </Screen>
  );
}

function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Label>{label}</Label>
      <Field
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 12,
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  fieldGroup: {
    gap: 6,
  },
});
