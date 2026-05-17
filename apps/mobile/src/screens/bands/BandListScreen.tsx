import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BandSummary } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, PrimaryButton, StatusBadge } from '../../components/UI';
import { fallbackBandImage, theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'BandList'>;

export function BandListScreen({ navigation }: Props) {
  const [bands, setBands] = useState<BandSummary[]>([]);
  const { currentBand, setCurrentBand } = useCurrentBand();

  const load = useCallback(async () => {
    const result = await api.get<BandSummary[]>('/bands');
    const normalized = result.map((band) => ({
      ...band,
      thumbnailUrl: toApiAssetUrl(band.thumbnailUrl),
    }));
    setBands(normalized);
    if (!currentBand || !normalized.some((band) => band.id === currentBand.id)) {
      setCurrentBand(normalized[0] ?? null);
    }
  }, [currentBand, setCurrentBand]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable style={styles.userButton} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person-outline" size={20} color={theme.colors.primaryDark} />
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>내 밴드</Text>
        <Text style={styles.pageSubtitle}>밴드를 고르면 바로 메인 허브로 이어집니다.</Text>
      </View>

      <View style={styles.actionWrap}>
        <PrimaryButton label="밴드 추가하기" onPress={() => navigation.navigate('JoinBand')} />
      </View>

      {bands.length === 0 ? (
        <EmptyState
          title="아직 가입한 밴드가 없어요"
          description="밴드를 만들거나 초대코드로 참여하면 여기서 바로 홈 흐름이 시작돼요."
        />
      ) : null}

      <View style={styles.listWrap}>
        {bands.map((band) => {
          const selected = currentBand?.id === band.id;

          return (
            <Pressable
              key={band.id}
              onPress={() => {
                setCurrentBand(band);
                navigation.navigate('BandHome', { bandId: band.id });
              }}
              style={[styles.cardWrap, selected && styles.cardWrapSelected]}
            >
              <ImageBackground source={{ uri: band.thumbnailUrl || fallbackBandImage }} imageStyle={styles.cardImage} style={styles.bandCard}>
                <View style={styles.cardDim} />
                <View style={styles.cardTop}>
                  <StatusBadge label={selected ? '현재 밴드' : band.myRole === 'leader' ? '리더' : '멤버'} tone={selected ? 'success' : 'default'} />
                  <Text style={styles.inviteCode}>{band.inviteCode}</Text>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.bandTitle}>{band.name}</Text>
                  <Text style={styles.bandMeta}>{band.myPosition || '포지션 미설정'} · 멤버 {band.memberCount}명</Text>
                </View>
              </ImageBackground>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
  },
  pageSubtitle: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  actionWrap: {
    gap: 10,
  },
  listWrap: {
    gap: 12,
  },
  cardWrap: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardWrapSelected: {
    borderColor: theme.colors.primary,
  },
  bandCard: {
    minHeight: 126,
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: theme.radius.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardBottom: {
    gap: 4,
  },
  cardDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 20, 30, 0.46)',
  },
  cardImage: {
    borderRadius: theme.radius.md,
  },
  bandTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  bandMeta: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
  },
  inviteCode: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
