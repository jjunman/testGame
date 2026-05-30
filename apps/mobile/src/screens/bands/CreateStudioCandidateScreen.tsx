import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import { StudioDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, Field, HeroBanner, Label, PrimaryButton, SectionCard } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'CreateStudioCandidate'>;
type Coordinate = { latitude: number; longitude: number };

const ANSAN_CENTER: Coordinate = { latitude: 37.3219, longitude: 126.8309 };
const DEFAULT_REGION: Region = {
  ...ANSAN_CENTER,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function CreateStudioCandidateScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const mapRef = useRef<MapView | null>(null);
  const studioListRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const [studios, setStudios] = useState<StudioDto[]>([]);
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeStudioIndex, setActiveStudioIndex] = useState(0);

  const loadStudios = useCallback(async () => {
    setLoading(true);
    try {
      const nextStudios = await api.get<StudioDto[]>(`/bands/${bandId}/studios`);
      setStudios(nextStudios);
      setSelectedStudioId((current) => current ?? nextStudios[0]?.id ?? null);
      const firstLocated = nextStudios.find(hasCoordinate);
      if (firstLocated) {
        mapRef.current?.animateToRegion(toRegion(firstLocated), 350);
      }
    } catch (error) {
      Alert.alert('목록 불러오기 실패', error instanceof Error ? error.message : '합주실 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [bandId]);

  useEffect(() => {
    void loadStudios();
  }, [loadStudios]);

  const submit = async () => {
    if (!selectedStudioId) {
      Alert.alert('합주실 선택 필요', '앱에서 제공하는 합주실 중 하나를 선택해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/bands/${bandId}/studio-candidates`, {
        studioId: selectedStudioId,
        note: clean(note),
      });
      Alert.alert('후보 추가 완료', '합주실 후보가 추가되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('후보 추가 실패', error instanceof Error ? error.message : '합주실 후보를 추가하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectStudio = (studio: StudioDto) => {
    setSelectedStudioId(studio.id);
    if (hasCoordinate(studio)) {
      const nextRegion = toRegion(studio);
      mapRef.current?.animateToRegion(nextRegion, 350);
    }
  };

  const locatedStudios = studios.filter(hasCoordinate);
  const selectedStudio = studios.find((studio) => studio.id === selectedStudioId) ?? null;
  const studioCardWidth = Math.max(260, width - 64);
  const studioCardGap = 12;
  const onStudioScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / (studioCardWidth + studioCardGap));
    const clampedIndex = Math.max(0, Math.min(studios.length - 1, rawIndex));
    const boundedIndex = Math.max(activeStudioIndex - 1, Math.min(activeStudioIndex + 1, clampedIndex));
    setActiveStudioIndex(boundedIndex);
    const nextStudio = studios[boundedIndex];
    if (nextStudio) {
      selectStudio(nextStudio);
    }
  };
  const scrollToStudioIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(studios.length - 1, index));
    setActiveStudioIndex(nextIndex);
    const nextStudio = studios[nextIndex];
    if (nextStudio) {
      selectStudio(nextStudio);
    }
    studioListRef.current?.scrollTo({
      x: nextIndex * (studioCardWidth + studioCardGap),
      animated: true,
    });
  };

  return (
    <Screen>
      <HeroBanner title="합주실 후보 추가" subtitle="앱에서 제공하는 안산 합주실 목록에서 후보를 골라요." />

      <SectionCard title="앱 제공 합주실">
        <PrimaryButton label="목록 새로고침" onPress={loadStudios} loading={loading} />
        {studios.length > 0 ? (
          <Text style={styles.countText}>
            {`제공 중인 합주실 ${studios.length}곳`}
          </Text>
        ) : null}
        {studios.length === 0 ? (
          <EmptyState title="제공 목록이 비어 있어요" description="잠시 후 다시 불러와 주세요." />
        ) : (
          <>
            <MapView ref={mapRef} style={styles.map} initialRegion={DEFAULT_REGION}>
              {locatedStudios.map((studio) => (
                <Marker
                  key={`${studio.id}-${studio.id === selectedStudioId ? 'selected' : 'idle'}`}
                  coordinate={{ latitude: studio.latitude!, longitude: studio.longitude! }}
                  title={studio.name}
                  description={studio.address ?? undefined}
                  pinColor={studio.id === selectedStudioId ? '#ef4444' : '#7b8496'}
                  onPress={() => selectStudio(studio)}
                />
              ))}
            </MapView>
            {selectedStudio ? <Text style={styles.selectedText}>선택됨: {selectedStudio.name}</Text> : null}
            <ScrollView
              ref={studioListRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={studioCardWidth + studioCardGap}
              disableIntervalMomentum
              contentContainerStyle={styles.studioList}
              onMomentumScrollEnd={onStudioScrollEnd}
            >
              {studios.map((studio, index) => (
                <View key={studio.id} style={[styles.studioCardWrap, { width: studioCardWidth, marginRight: index === studios.length - 1 ? 0 : studioCardGap }]}>
                  <StudioOption
                    studio={studio}
                    selected={selectedStudioId === studio.id}
                    onPress={() => selectStudio(studio)}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.carouselNav}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="이전 합주실 후보"
                disabled={activeStudioIndex === 0}
                onPress={() => scrollToStudioIndex(activeStudioIndex - 1)}
                style={[styles.carouselArrow, activeStudioIndex === 0 && styles.carouselArrowDisabled]}
              >
                <Text style={styles.carouselArrowText}>{'<'}</Text>
              </Pressable>
              <Text style={styles.carouselCount}>{`${activeStudioIndex + 1}/${studios.length}`}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="다음 합주실 후보"
                disabled={activeStudioIndex >= studios.length - 1}
                onPress={() => scrollToStudioIndex(activeStudioIndex + 1)}
                style={[styles.carouselArrow, activeStudioIndex >= studios.length - 1 && styles.carouselArrowDisabled]}
              >
                <Text style={styles.carouselArrowText}>{'>'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </SectionCard>

      <SectionCard title="후보 메모">
        <Label>부원들에게 남길 메모</Label>
        <Field value={note} onChangeText={setNote} placeholder="예: 가격이 저렴하고 중앙역이랑 가까워요." multiline />
        <PrimaryButton label="후보 추가하기" onPress={submit} loading={submitting} disabled={!selectedStudioId || submitting} />
      </SectionCard>
    </Screen>
  );
}

function StudioOption({
  studio,
  selected,
  onPress,
}: {
  studio: StudioDto;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.studioOption, selected && styles.studioOptionSelected]} onPress={onPress}>
      <View style={styles.optionHeader}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{studio.name}</Text>
      </View>
      <View style={styles.infoGrid}>
        <StudioInfo icon="location-outline" label="위치" value={studio.address ?? '주소 확인 필요'} selected={selected} wide />
        <StudioInfo icon="cash-outline" label="가격" value={formatPrice(studio.hourlyPrice)} selected={selected} />
        <StudioInfo icon="navigate-outline" label="거리" value={formatDistance(studio.myDistanceKm)} selected={selected} />
        <StudioInfo icon="people-outline" label="평균" value={formatDistance(studio.distanceAverageKm)} selected={selected} />
      </View>
    </Pressable>
  );
}

function StudioInfo({ icon, label, value, selected, wide = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; selected: boolean; wide?: boolean }) {
  return (
    <View style={[styles.infoCell, wide && styles.infoCellWide, selected && styles.infoCellSelected]}>
      <View style={styles.infoCellHeader}>
        <Ionicons name={icon} size={14} color={selected ? theme.colors.primary : theme.colors.textMuted} />
        <Text style={[styles.infoLabel, selected && styles.optionMetaSelected]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, selected && styles.optionMetaSelected]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function clean(value: string) {
  const next = value.trim();
  return next ? next : undefined;
}

function formatPrice(value: number | null) {
  return value === null ? '가격 확인 필요' : `시간당 ${value.toLocaleString('ko-KR')}원`;
}

function formatDistance(value: number | null) {
  return value === null ? '계산 전' : `${value.toFixed(1)}km`;
}


function hasCoordinate(studio: StudioDto) {
  return studio.latitude !== null && studio.longitude !== null;
}

function toRegion(studio: StudioDto): Region {
  return {
    latitude: studio.latitude ?? ANSAN_CENTER.latitude,
    longitude: studio.longitude ?? ANSAN_CENTER.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };
}

const styles = StyleSheet.create({
  studioList: {
    marginTop: 12,
    alignItems: 'center',
  },
  studioCardWrap: {
    flexShrink: 0,
  },
  map: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 12,
  },
  countText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  selectedText: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  carouselNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  carouselArrow: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  carouselArrowDisabled: {
    opacity: 0.35,
  },
  carouselArrowText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  carouselCount: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    minWidth: 46,
  },
  studioOption: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 14,
    gap: 14,
  },
  studioOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  optionTitleSelected: {
    color: theme.colors.text,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoCell: {
    flex: 1,
    minWidth: 0,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 8,
    gap: 4,
  },
  infoCellWide: {
    flexBasis: '100%',
  },
  infoCellSelected: {
    backgroundColor: '#fff',
  },
  infoCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  infoValue: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  optionMetaSelected: {
    color: theme.colors.textMuted,
  },
});
