import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BandSummary } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, StatusBadge } from '../../components/UI';
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
        <Pressable style={styles.addBandCard} onPress={() => navigation.navigate('BandAdd')}>
          <View style={styles.addBandGlow} />
          <View style={styles.addBandRow}>
            <View style={styles.addBandIcon}>
              <Ionicons name="add" size={26} color="#fff" />
            </View>
            <View style={styles.addBandTextWrap}>
              <Text style={styles.addBandTitle}>밴드 가입하기</Text>
              <Text style={styles.addBandSubtitle}>만들기 또는 초대코드 입력</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  userButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
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
  addBandCard: {
    minHeight: 126,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#d9d5ff',
    backgroundColor: '#f8f7ff',
    padding: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addBandGlow: {
    position: 'absolute',
    right: -34,
    top: -42,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: theme.colors.primarySoft,
  },
  addBandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  addBandIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  addBandTextWrap: {
    flex: 1,
    gap: 5,
  },
  addBandTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  addBandSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
