import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import { StudioCandidateDto, StudioLocationDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { Screen } from '../../components/Screen';
import { EmptyState, Field, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useCurrentBand } from '../../store/CurrentBandContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Studios'>;
type Coordinate = { latitude: number; longitude: number };
type StudioTab = 'location' | 'vote';

const ANSAN_CENTER: Coordinate = { latitude: 37.3219, longitude: 126.8309 };
const DEFAULT_REGION: Region = {
  ...ANSAN_CENTER,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

export function StudioScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const { currentBand } = useCurrentBand();
  const [candidates, setCandidates] = useState<StudioCandidateDto[]>([]);
  const [location, setLocation] = useState<StudioLocationDto | null>(null);
  const [draftCoordinate, setDraftCoordinate] = useState<Coordinate | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [addressQuery, setAddressQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [loadingVoteId, setLoadingVoteId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [editingLocation, setEditingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTab>('location');
  const [segmentWidth, setSegmentWidth] = useState(0);
  const indicatorProgress = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView | null>(null);
  const { width, height } = useWindowDimensions();
  const isLeader = currentBand?.myRole === 'leader';
  const confirmed = candidates.find((candidate) => candidate.status === 'confirmed') ?? null;
  const hasSavedLocation = location?.latitude !== null && location?.longitude !== null;
  const savedLocationCoordinate = hasSavedLocation && location
    ? { latitude: location.latitude!, longitude: location.longitude! }
    : null;
  const confirmedStudioCoordinate =
    confirmed?.studio.latitude != null && confirmed.studio.longitude != null
      ? { latitude: confirmed.studio.latitude, longitude: confirmed.studio.longitude }
      : null;
  const cardWidth = Math.max(280, width - 32);
  const cardGap = 12;
  const indicatorWidth = segmentWidth > 0 ? (segmentWidth - 8) / 2 : 0;

  const load = useCallback(async () => {
    const [nextCandidates, nextLocation] = await Promise.all([
      api.get<StudioCandidateDto[]>(`/bands/${bandId}/studio-candidates`),
      api.get<StudioLocationDto>(`/bands/${bandId}/studio-location`),
    ]);
    setCandidates(nextCandidates);
    setLocation(nextLocation);
    if (nextLocation.latitude !== null && nextLocation.longitude !== null) {
      const coordinate = { latitude: nextLocation.latitude, longitude: nextLocation.longitude };
      setDraftCoordinate(coordinate);
      setMapRegion(toRegion(coordinate));
      setAddressQuery(nextLocation.label ?? '');
      setEditingLocation(false);
    } else {
      const nextConfirmed = nextCandidates.find((candidate) => candidate.status === 'confirmed') ?? null;
      if (nextConfirmed?.studio.latitude != null && nextConfirmed.studio.longitude != null) {
        setMapRegion(toRegion({ latitude: nextConfirmed.studio.latitude, longitude: nextConfirmed.studio.longitude }));
      }
      setEditingLocation(true);
    }
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  useEffect(() => {
    Animated.spring(indicatorProgress, {
      toValue: activeTab === 'location' ? 0 : 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.65,
    }).start();
  }, [activeTab, indicatorProgress]);

  useEffect(() => {
    if (activeTab !== 'location' || !draftCoordinate || !confirmedStudioCoordinate) {
      return;
    }

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates([draftCoordinate, confirmedStudioCoordinate], {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [activeTab, confirmedStudioCoordinate, draftCoordinate]);

  const findCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('위치 권한 필요', '현재 위치를 찾으려면 위치 권한을 허용해 주세요. 지도에서 직접 찍어도 저장할 수 있어요.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setDraftCoordinate(coordinate);
      setMapRegion(toRegion(coordinate));
    } catch (error) {
      Alert.alert('위치 찾기 실패', error instanceof Error ? error.message : '현재 위치를 찾지 못했어요.');
    } finally {
      setLocating(false);
    }
  };

  const findAddressLocation = async () => {
    const query = addressQuery.trim();
    if (!query) {
      Alert.alert('주소 입력 필요', '집 근처 주소를 입력해 주세요.');
      return;
    }
    setGeocoding(true);
    try {
      const normalizedQuery = query.includes('안산') ? query : `경기도 안산시 ${query}`;
      const results = await Location.geocodeAsync(normalizedQuery);
      const first = results[0];
      if (!first) {
        Alert.alert('주소를 찾지 못했어요', '건물명보다 도로명 주소나 동/번지를 조금 더 자세히 입력해 주세요.');
        return;
      }
      const coordinate = {
        latitude: first.latitude,
        longitude: first.longitude,
      };
      setDraftCoordinate(coordinate);
      setMapRegion(toRegion(coordinate));
    } catch (error) {
      Alert.alert('주소 검색 실패', error instanceof Error ? error.message : '주소로 위치를 찾지 못했어요.');
    } finally {
      setGeocoding(false);
    }
  };

  const saveLocation = async () => {
    if (!draftCoordinate) {
      Alert.alert('위치 선택 필요', '지도에서 집 위치를 찍거나 현재 위치를 먼저 찾아 주세요.');
      return;
    }
    setSavingLocation(true);
    try {
      setLocation(await api.post<StudioLocationDto>(`/bands/${bandId}/studio-location`, {
        ...draftCoordinate,
        label: addressQuery.trim() || '지도에서 선택한 위치',
      }));
      setCandidates(await api.get<StudioCandidateDto[]>(`/bands/${bandId}/studio-candidates`));
      setEditingLocation(false);
    } catch (error) {
      Alert.alert('위치 저장 실패', error instanceof Error ? error.message : '집 위치를 저장하지 못했어요.');
    } finally {
      setSavingLocation(false);
    }
  };

  const onMapPress = (event: MapPressEvent) => {
    setDraftCoordinate(event.nativeEvent.coordinate);
  };

  const vote = async (candidateId: string) => {
    setLoadingVoteId(candidateId);
    try {
      await api.post(`/bands/${bandId}/studio-votes`, { candidateId });
      await load();
    } catch (error) {
      Alert.alert('투표 실패', error instanceof Error ? error.message : '합주실 투표를 저장하지 못했어요.');
    } finally {
      setLoadingVoteId(null);
    }
  };

  const finalize = () => {
    Alert.alert('합주실을 확정할까요?', '현재 투표 결과로 합주실을 확정합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '확정',
        onPress: async () => {
          setFinalizing(true);
          try {
            await api.post(`/bands/${bandId}/studio-candidates/finalize`);
            await load();
          } catch (error) {
            Alert.alert('확정 실패', error instanceof Error ? error.message : '합주실을 확정하지 못했어요.');
          } finally {
            setFinalizing(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="studio" navigation={navigation} />} scrollEnabled={activeTab !== 'vote'}>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeTab === 'location' ? '합주실 정하기로 전환' : '내 위치로 전환'}
        style={styles.segment}
        onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
        onPress={() => setActiveTab((current) => (current === 'location' ? 'vote' : 'location'))}
      >
        {indicatorWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentIndicator,
              {
                width: indicatorWidth,
                transform: [
                  {
                    translateX: indicatorProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, indicatorWidth],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
        <SegmentLabel label="내 위치" active={activeTab === 'location'} />
        <SegmentLabel label="합주실 정하기" active={activeTab === 'vote'} />
      </Pressable>

      {activeTab === 'location' ? (
      <View style={[styles.locationCard, hasSavedLocation && !editingLocation && styles.locationCardCompact]}>
        <View style={styles.locationHeader}>
          <Text style={styles.sectionTitle}>내 집 위치 정하기</Text>
          <StatusBadge label={location?.latitude !== null && location?.longitude !== null ? '저장됨' : '미입력'} tone={location?.latitude !== null && location?.longitude !== null ? 'success' : 'warning'} />
        </View>
        {hasSavedLocation && !editingLocation ? (
          <>
            <Text style={styles.metaText} numberOfLines={1}>{location?.label || (savedLocationCoordinate ? formatCoordinate(savedLocationCoordinate) : '')}</Text>
            <Pressable style={styles.locationEditButton} onPress={() => setEditingLocation(true)}>
              <Text style={styles.locationEditText}>주소 변경하기</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.metaText}>현재 위치, 주소 검색, 지도 탭 중 편한 방식으로 핀을 잡아 주세요. 추천 계산에는 좌표만 사용합니다.</Text>
        <View style={styles.addressSearch}>
          <Field
            value={addressQuery}
            onChangeText={setAddressQuery}
            placeholder="예: 중앙대로 915 또는 고잔동 631-1"
            autoCapitalize="none"
          />
          <PrimaryButton label="주소로 찾기" onPress={findAddressLocation} loading={geocoding} style={styles.addressButton} />
        </View>
          </>
        )}
        <MapView
          ref={mapRef}
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          onPress={editingLocation ? onMapPress : undefined}
        >
          {draftCoordinate ? (
            <Marker
              coordinate={draftCoordinate}
              draggable={editingLocation}
              title="내 집 위치"
              onDragEnd={(event) => setDraftCoordinate(event.nativeEvent.coordinate)}
            />
          ) : null}
          {confirmedStudioCoordinate ? (
            <Marker
              coordinate={confirmedStudioCoordinate}
              pinColor={theme.colors.primary}
              title={confirmed?.studio.name ?? '확정 합주실'}
              description={formatAddress(confirmed?.studio.address ?? null)}
            />
          ) : null}
        </MapView>
        {confirmedStudioCoordinate ? (
          <Text style={styles.coordinateText}>확정 합주실: {confirmed?.studio.name}</Text>
        ) : null}
        <View style={styles.mapLegend}>
          <LegendDot color="red" label="내 집" />
          {confirmedStudioCoordinate ? <LegendDot color={theme.colors.primary} label="확정 합주실" /> : null}
        </View>
        {editingLocation ? (
          <>
        <View style={styles.mapActions}>
          <PrimaryButton label="내 위치 찾기" onPress={findCurrentLocation} loading={locating} style={styles.mapButton} />
          <PrimaryButton label="이 위치로 저장" onPress={saveLocation} loading={savingLocation} disabled={!draftCoordinate} style={styles.mapButton} />
        </View>
            {draftCoordinate ? <Text style={styles.coordinateText}>{formatCoordinate(draftCoordinate)}</Text> : null}
          </>
        ) : null}
      </View>
      ) : null}

      {activeTab === 'vote' ? (
      <>
      {confirmed ? (
        <View style={styles.confirmedCard}>
          <StatusBadge label="확정된 합주실" tone="success" />
          <Text style={styles.confirmedTitle}>{confirmed.studio.name}</Text>
          <Text style={styles.metaText}>{formatAddress(confirmed.studio.address)}</Text>
          <PrimaryButton
            label="합주실 변경"
            onPress={() => navigation.navigate('CreateStudioCandidate', { bandId })}
            style={styles.secondaryAction}
          />
        </View>
      ) : null}
        {!confirmed ? (
        <View style={styles.candidateSection}>
          <Text style={styles.sectionTitle}>합주실 후보</Text>
          <StudioCandidateCarousel
            candidates={candidates}
            activeIndex={activeCandidateIndex}
            cardWidth={cardWidth}
            cardGap={cardGap}
            loadingVoteId={loadingVoteId}
            onIndexChange={setActiveCandidateIndex}
            onVote={vote}
            onAddCandidate={() => navigation.navigate('CreateStudioCandidate', { bandId })}
          />
          {isLeader ? (
            <PrimaryButton
              label="합주실 확정하기"
              onPress={finalize}
              loading={finalizing}
              disabled={candidates.length === 0 || finalizing}
              style={styles.secondaryAction}
            />
          ) : null}
        </View>
        ) : null}
      </>
      ) : null}
    </Screen>
  );
}

function SegmentLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={styles.segmentButton}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </View>
  );
}

function StudioCandidateCarousel({
  candidates,
  activeIndex,
  cardWidth,
  cardGap,
  loadingVoteId,
  onIndexChange,
  onVote,
  onAddCandidate,
}: {
  candidates: StudioCandidateDto[];
  activeIndex: number;
  cardWidth: number;
  cardGap: number;
  loadingVoteId: string | null;
  onIndexChange: (index: number) => void;
  onVote: (candidateId: string) => void;
  onAddCandidate: () => void;
}) {
  const totalItems = candidates.length + 1;
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + cardGap));
    const clampedIndex = Math.max(0, Math.min(totalItems - 1, rawIndex));
    const boundedIndex = Math.max(activeIndex - 1, Math.min(activeIndex + 1, clampedIndex));
    onIndexChange(boundedIndex);
  };

  return (
    <View style={styles.carouselShell}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + cardGap}
        disableIntervalMomentum
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {candidates.map((candidate, index) => (
          <View key={candidate.id} style={[styles.carouselItem, { width: cardWidth, marginRight: cardGap }]}>
            <StudioCard
              candidate={candidate}
              loading={loadingVoteId === candidate.id}
              onVote={() => void onVote(candidate.id)}
            />
          </View>
        ))}
        <Pressable style={[styles.card, styles.addStudioCard, { width: cardWidth }]} onPress={onAddCandidate}>
          <View style={styles.addStudioIcon}>
            <Ionicons name="add" size={30} color={theme.colors.primary} />
          </View>
          <Text style={styles.addStudioTitle}>합주실 후보 추가</Text>
          <Text style={styles.addStudioCaption}>목록에서 합주실을 골라 후보로 올려요.</Text>
        </Pressable>
      </ScrollView>
      <View style={styles.carouselDots}>
        {candidates.map((candidate, index) => (
          <View key={candidate.id} style={[styles.carouselDot, index === activeIndex && styles.carouselDotActive, candidate.didVote && styles.carouselDotVoted]} />
        ))}
        <View style={[styles.carouselDot, activeIndex === candidates.length && styles.carouselDotActive]} />
      </View>
    </View>
  );
}

function StudioCard({
  candidate,
  loading,
  onVote,
}: {
  candidate: StudioCandidateDto;
  loading: boolean;
  onVote: () => void;
}) {
  const { studio } = candidate;
  const distanceNotice = useMemo(() => {
    if (candidate.distanceTotalKm !== null) {
      return null;
    }
    if (studio.latitude === null || studio.longitude === null) {
      return '합주실 위치 핀이 없어 거리 계산 전이에요.';
    }
    return '멤버 집 위치가 더 모이면 거리 추천을 계산해요.';
  }, [candidate.distanceTotalKm, studio.latitude, studio.longitude]);

  return (
    <View style={[styles.card, candidate.didVote && styles.cardSelected, candidate.status === 'confirmed' && styles.cardConfirmed]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>{studio.name}</Text>
            {candidate.recommendationRank === 1 ? <StatusBadge label="추천 1순위" tone="success" /> : null}
          </View>
        </View>
        {candidate.status === 'confirmed' ? <StatusBadge label="확정" tone="success" /> : null}
      </View>

      <View style={styles.infoGrid}>
        <InfoCell icon="location-outline" label="위치" value={formatAddress(studio.address)} wide />
        <InfoCell icon="cash-outline" label="가격" value={formatPrice(studio.hourlyPrice)} />
        <InfoCell icon="navigate-outline" label="거리" value={formatDistance(candidate.distanceAverageKm)} />
        <InfoCell icon="people-outline" label="평균" value={`${candidate.missingLocationCount}명 미입력`} />
      </View>

      <View style={styles.noteArea}>
        {distanceNotice ? <Text style={styles.noteText} numberOfLines={1}>{distanceNotice}</Text> : null}
        {candidate.note ? <Text style={styles.noteText} numberOfLines={1}>메모: {candidate.note}</Text> : null}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.voteText}>{candidate.voteCount}표</Text>
        <View style={styles.linkActions}>
          {studio.phone ? <LinkButton label="전화" url={`tel:${studio.phone}`} /> : null}
          {studio.externalUrl ? <LinkButton label="링크" url={studio.externalUrl} /> : null}
        </View>
      </View>

      <PrimaryButton
        label={candidate.didVote ? '내 선택' : '이 합주실에 투표'}
        onPress={onVote}
        loading={loading}
        disabled={loading}
        style={candidate.didVote ? styles.votedButton : undefined}
      />
    </View>
  );
}

function InfoCell({ icon, label, value, wide = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.infoCell, wide && styles.infoCellWide]}>
      <View style={styles.infoCellHeader}>
        <Ionicons name={icon} size={14} color={theme.colors.primary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={wide ? 2 : 1}>{value}</Text>
    </View>
  );
}

function LinkButton({ label, url }: { label: string; url: string }) {
  return (
    <Pressable style={styles.linkButton} onPress={() => void Linking.openURL(url)}>
      <Text style={styles.linkButtonText}>{label}</Text>
    </Pressable>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function toRegion(coordinate: Coordinate): Region {
  return {
    ...coordinate,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
}

function formatPrice(value: number | null) {
  return value === null ? '미정' : `${value.toLocaleString('ko-KR')}원`;
}

function formatDistance(value: number | null) {
  return value === null ? '계산 전' : `${value.toFixed(1)}km`;
}

function formatAddress(value: string | null) {
  return value ?? '주소 미입력';
}

function formatCoordinate(coordinate: Coordinate) {
  return `위도 ${coordinate.latitude.toFixed(5)} · 경도 ${coordinate.longitude.toFixed(5)}`;
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: theme.colors.text,
  },
  actions: {
    gap: 10,
  },
  secondaryAction: {
    backgroundColor: theme.colors.textMuted,
  },
  candidateSection: {
    gap: 14,
  },
  carouselShell: {
    gap: 10,
  },
  carouselContent: {
    alignItems: 'center',
  },
  carouselItem: {
    flexShrink: 0,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
  },
  carouselDotActive: {
    width: 18,
    backgroundColor: theme.colors.text,
  },
  carouselDotVoted: {
    backgroundColor: theme.colors.primary,
  },
  locationCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 14,
  },
  locationCardCompact: {
    gap: 10,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  map: {
    height: 210,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  addressSearch: {
    gap: 10,
  },
  addressButton: {
    backgroundColor: theme.colors.textMuted,
  },
  mapActions: {
    flexDirection: 'row',
    gap: 10,
  },
  mapButton: {
    flex: 1,
  },
  coordinateText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  mapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  locationEditButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  locationEditText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  confirmedCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 16,
    gap: 8,
  },
  confirmedTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  list: {
    gap: 12,
  },
  card: {
    minHeight: 292,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  cardConfirmed: {
    borderColor: '#5fc47b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
    marginBottom: 6,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
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
    backgroundColor: theme.colors.surface,
    padding: 8,
    gap: 4,
  },
  infoCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoCellWide: {
    flexBasis: '100%',
  },
  infoLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  noteText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  noteArea: {
    minHeight: 18,
    gap: 5,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  voteText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  linkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  linkButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  votedButton: {
    backgroundColor: '#1f2a44',
  },
  addStudioCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    gap: 12,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surfaceMuted,
  },
  addStudioIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  addStudioTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  addStudioCaption: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
});
