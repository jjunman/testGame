import React, { useMemo, useState } from 'react';
import { Alert, ImageBackground, KeyboardTypeOptions, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { Field, PrimaryButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'AddSongCandidate'>;

export function AddSongCandidateScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const trimmedTitle = title.trim();
  const trimmedArtist = artist.trim();
  const trimmedYoutubeUrl = youtubeUrl.trim();
  const youtubeVideoId = useMemo(() => getYoutubeVideoId(trimmedYoutubeUrl), [trimmedYoutubeUrl]);
  const youtubeThumbnailUrl = youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg` : null;

  const canSubmit = useMemo(
    () => trimmedTitle.length >= 1 && trimmedArtist.length >= 1 && trimmedYoutubeUrl.length >= 1,
    [trimmedArtist, trimmedTitle, trimmedYoutubeUrl],
  );

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('입력 필요', '곡 제목, 가수, 유튜브 링크를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/bands/${bandId}/song-candidates`, {
        title: trimmedTitle,
        artist: trimmedArtist,
        youtubeUrl: trimmedYoutubeUrl,
      });
      Alert.alert('제출 완료', '후보곡을 추가했어요.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('제출 실패', error instanceof Error ? error.message : '후보곡을 추가하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      fixedFooter={<BandInnerNav bandId={bandId} active="vote" navigation={navigation} />}
      contentContainerStyle={styles.screenContent}
    >
      <View style={styles.form}>
        <Text style={styles.title}>곡 정보</Text>
        <InputRow label="곡 제목" value={title} onChangeText={setTitle} placeholder="제목을 입력.." />
        <InputRow label="가수" value={artist} onChangeText={setArtist} placeholder="가수를 입력.." />
        <InputRow
          label="유튜브 링크"
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          placeholder="유튜브 링크를 입력해주세요.."
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.previewGroup}>
          <Text style={styles.inputLabel}>링크 썸네일</Text>
          {youtubeThumbnailUrl ? (
            <ImageBackground
              source={{ uri: youtubeThumbnailUrl }}
              imageStyle={styles.previewImage}
              style={styles.previewCard}
            >
              <View style={styles.previewOverlay} />
            </ImageBackground>
          ) : (
            <View style={[styles.previewCard, styles.previewPlaceholder]}>
              <Text style={styles.previewPlaceholderText}>유튜브 링크를 입력하면 썸네일이 보여요</Text>
            </View>
          )}
        </View>
      </View>

      <PrimaryButton
        label="제출하기"
        onPress={submit}
        loading={submitting}
        disabled={!canSubmit}
        style={styles.submitButton}
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
      <Text style={styles.inputLabel}>{label}</Text>
      <Field
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={styles.input}
      />
    </View>
  );
}

function getYoutubeVideoId(value: string) {
  if (!value) {
    return null;
  }

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1,
    paddingTop: 22,
    gap: 24,
  },
  form: {
    gap: 22,
  },
  title: {
    color: theme.colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 9,
  },
  previewGroup: {
    gap: 9,
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  input: {
    minHeight: 58,
    borderRadius: theme.radius.md,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  previewCard: {
    height: 178,
    overflow: 'hidden',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    borderRadius: theme.radius.md,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  previewPlaceholder: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  previewPlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  submitButton: {
    minHeight: 56,
    marginTop: 4,
  },
});
