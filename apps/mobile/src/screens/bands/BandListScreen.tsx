import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BandSummary } from '@band/shared-types';
import { api, toApiAssetUrl } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, IconButton, StatusBadge } from '../../components/UI';
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
        <IconButton icon="person-outline" label="프로필" onPress={() => navigation.navigate('Profile')} />
      ),
    });
  }, [navigation]);

  return (
    <Screen scrollEnabled={false} contentContainerStyle={styles.listScreen}>
      <FlatList
        data={bands}
        keyExtractor={(band) => band.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={(
          <EmptyState
            title="아직 가입한 밴드가 없어요"
            description="밴드를 만들거나 초대코드로 참여해주세요"
          />
        )}
        renderItem={({ item: band }) => {
          const selected = currentBand?.id === band.id;
          const todoCount = band.todoCount ?? 0;

          return (
            <Pressable
              onPress={() => {
                setCurrentBand(band);
                navigation.navigate('BandHome', { bandId: band.id });
              }}
              style={({ pressed }) => [styles.cardWrap, selected && styles.cardWrapSelected, pressed && styles.cardWrapPressed]}
            >
              {todoCount > 0 ? (
                <View style={styles.todoBadge}>
                  <Text style={styles.todoBadgeText}>{todoCount > 9 ? '9+' : todoCount}</Text>
                </View>
              ) : null}
              <ImageBackground source={{ uri: band.thumbnailUrl || fallbackBandImage }} imageStyle={styles.cardImage} style={styles.bandCard}>
                <View style={styles.cardDim} />
                <View style={styles.cardTop}>
                  <StatusBadge label={band.myRole === 'leader' ? '리더' : '멤버'} tone="default" />
                  <Text style={styles.inviteCode}>{band.inviteCode}</Text>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.bandTitle}>{band.name}</Text>
                  <Text style={styles.bandMeta}>{band.myPosition || '포지션 미설정'} · 멤버 {band.memberCount}명</Text>
                </View>
              </ImageBackground>
            </Pressable>
          );
        }}
        ListFooterComponent={(
          <Pressable accessibilityRole="button" accessibilityLabel="밴드 추가하기" style={styles.addBandCard} onPress={() => navigation.navigate('BandAdd')}>
            <View style={styles.addBandRow}>
              <View style={styles.addBandIcon}>
                <Ionicons name="add" size={26} color="#fff" />
              </View>
              <View style={styles.addBandTextWrap}>
                <Text style={styles.addBandTitle}>밴드 추가하기</Text>
                <Text style={styles.addBandSubtitle}>또는 초대코드 입력</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listScreen: {
    flex: 1,
    paddingBottom: 0,
  },
  listContent: {
    gap: 14,
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  cardWrap: {
    borderRadius: theme.radius.md,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardWrapSelected: {
    borderColor: theme.colors.primary,
  },
  cardWrapPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.88,
  },
  bandCard: {
    minHeight: 132,
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  todoBadge: {
    position: 'absolute',
    top: -10,
    right: -6,
    zIndex: 5,
    elevation: 5,
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
    borderWidth: 2,
    borderColor: '#fff',
  },
  todoBadgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 22,
    includeFontPadding: false,
    textAlign: 'center',
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
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  addBandCard: {
    minHeight: 78,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  addBandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  addBandIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  addBandTextWrap: {
    flex: 1,
    gap: 6,
  },
  addBandTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  addBandSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
