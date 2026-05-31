import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardTypeOptions, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SongRoundDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { Field, HeroBanner, Label, PrimaryButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'AddSongCandidate'>;

export function AddSongCandidateScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;

    api
      .get<SongRoundDto | null>(`/bands/${bandId}/song-round`)
      .then((round) => {
        if (!isMounted) {
          return;
        }
        setAlreadySubmitted(Boolean(round?.candidates.some((candidate) => candidate.createdByUserId === user?.id)));
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [bandId, user?.id]);

  const canSubmit = useMemo(
    () => !alreadySubmitted && title.trim().length > 0 && artist.trim().length > 0 && youtubeUrl.trim().length > 0,
    [alreadySubmitted, artist, title, youtubeUrl],
  );

  const submit = async () => {
    if (alreadySubmitted) {
      Alert.alert('후보곡 제한', '후보곡은 한 사람당 한 곡만 올릴 수 있어요.');
      return;
    }

    if (!canSubmit) {
      Alert.alert('입력 필요', '곡 제목, 가수, 유튜브 링크를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/bands/${bandId}/song-candidates`, {
        title: title.trim(),
        artist: artist.trim(),
        youtubeUrl: youtubeUrl.trim(),
      });
      Alert.alert('제출 완료', '후보곡을 추가했어요.', [
        { text: '확인', onPress: () => navigation.navigate('SongRound', { bandId, initialTab: 'vote' }) },
      ]);
    } catch (error) {
      Alert.alert('제출 실패', error instanceof Error ? error.message : '후보곡을 추가하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="vote" navigation={navigation} />}>
      <HeroBanner
        title="후보곡 추가하기"
        subtitle="곡 제목, 가수, 유튜브 링크를 입력하면 바로 후보로 올라가요."
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

      {alreadySubmitted ? (
        <Text style={styles.notice}>이미 후보곡을 올렸어요. 기존 후보곡을 삭제하면 다시 올릴 수 있어요.</Text>
      ) : null}

      <PrimaryButton
        label={alreadySubmitted ? '이미 후보곡을 올렸어요' : '제출하기'}
        onPress={submit}
        loading={submitting}
        disabled={!canSubmit}
      />
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
  notice: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
