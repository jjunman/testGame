import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StudioCandidateDto, StudioDto, StudioLocationDto } from '@band/shared-types';
import { api } from '../../api/client';
import { BandInnerNav } from '../../components/BandInnerNav';
import { OpenStreetMapHandle, OpenStreetMapMarker, OpenStreetMapView, OSMRegion } from '../../components/OpenStreetMapView';
import { Screen } from '../../components/Screen';
import { Field, PrimaryButton, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Studios'>;
type Coordinate = { latitude: number; longitude: number };
type StudioTab = 'location' | 'register';
function Marker(_: any) { return null; }
const mapsEnabled = true;

const ANSAN_CENTER: Coordinate = { latitude: 37.3219, longitude: 126.8309 };
const DEFAULT_REGION: OSMRegion = {
  ...ANSAN_CENTER,
  latitudeDelta: 0.07,
  longitudeDelta: 0.07,
};
const LOCATION_TIMEOUT_MS = 8000;

export function StudioRegisterScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const mapRef = useRef<OpenStreetMapHandle | null>(null);
  const studioListRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const [studios, setStudios] = useState<StudioDto[]>([]);
  const [candidates, setCandidates] = useState<StudioCandidateDto[]>([]);
  const [location, setLocation] = useState<StudioLocationDto | null>(null);
  const [draftCoordinate, setDraftCoordinate] = useState<Coordinate | null>(null);
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [registeringStudioId, setRegisteringStudioId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('location');
  const [activeStudioIndex, setActiveStudioIndex] = useState(0);
  const [studioListWidth, setStudioListWidth] = useState(0);

  const confirmed = candidates.find((candidate) => candidate.status === 'confirmed') ?? null;
  const registeredStudioId = confirmed?.studio.id ?? null;
  const locatedStudios = useMemo(() => studios.filter(hasCoordinate), [studios]);
  const visibleStudios = activeTab === 'location'
    ? (confirmed && hasCoordinate(confirmed.studio) ? [confirmed.studio] : [])
    : locatedStudios;
  const selectedStudio = studios.find((studio) => studio.id === selectedStudioId) ?? studios[0] ?? null;
  const studioCardWidth = studioListWidth || Math.max(0, width - 36);
  const studioCardGap = 12;

  const focusCoordinateOnMap = useCallback((coordinate: Coordinate, preserveZoom = true) => {
    if (preserveZoom) {
      mapRef.current?.animateCamera({ center: coordinate }, { duration: 500 });
      return;
    }
    mapRef.current?.animateToRegion(toRegion(coordinate), 500);
  }, []);

  const focusStudioOnMap = useCallback((studio: StudioDto | null) => {
    if (!studio || !hasCoordinate(studio)) {
      return;
    }
    focusCoordinateOnMap({ latitude: studio.latitude!, longitude: studio.longitude! });
  }, [focusCoordinateOnMap]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStudios, nextCandidates, nextLocation] = await Promise.all([
        api.get<StudioDto[]>(`/bands/${bandId}/studios`),
        api.get<StudioCandidateDto[]>(`/bands/${bandId}/studio-candidates`),
        api.get<StudioLocationDto>(`/bands/${bandId}/studio-location`),
      ]);
      const nextConfirmed = nextCandidates.find((candidate) => candidate.status === 'confirmed') ?? null;
      const nextSelectedId = nextConfirmed?.studio.id ?? selectedStudioId ?? nextStudios[0]?.id ?? null;
      const nextSelectedStudio = nextStudios.find((studio) => studio.id === nextSelectedId) ?? nextStudios[0] ?? null;
      const nextHomeCoordinate = nextLocation.latitude !== null && nextLocation.longitude !== null
        ? { latitude: nextLocation.latitude, longitude: nextLocation.longitude }
        : null;

      setStudios(nextStudios);
      setCandidates(nextCandidates);
      setLocation(nextLocation);
      setDraftCoordinate(nextHomeCoordinate);
      setActiveTab((current) => current === 'location' && nextHomeCoordinate ? 'register' : current);
      setAddressQuery(nextLocation.label ?? '');
      setEditingLocation(!nextHomeCoordinate);
      setSelectedStudioId(nextSelectedStudio?.id ?? null);
      setActiveStudioIndex(Math.max(0, nextStudios.findIndex((studio) => studio.id === nextSelectedStudio?.id)));
      requestAnimationFrame(() => {
        if (nextHomeCoordinate) {
          focusCoordinateOnMap(nextHomeCoordinate, false);
        }
      });
    } catch (error) {
      Alert.alert('합주실 불러오기 실패', error instanceof Error ? error.message : '합주실 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [bandId, focusCoordinateOnMap, selectedStudioId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void load();
    });
    return unsubscribe;
  }, [load, navigation]);

  const selectStudio = (studio: StudioDto) => {
    setSelectedStudioId(studio.id);
    const studioIndex = studios.findIndex((item) => item.id === studio.id);
    if (studioIndex >= 0) {
      setActiveStudioIndex(studioIndex);
      studioListRef.current?.scrollTo({
        x: studioIndex * (studioCardWidth + studioCardGap),
        animated: true,
      });
    }
    focusStudioOnMap(studio);
  };

  const updateDraftCoordinate = (coordinate: Coordinate, preserveZoom = false) => {
    setDraftCoordinate(coordinate);
    if (!preserveZoom) {
      focusCoordinateOnMap(coordinate, false);
    }
  };

  const onMapPress = (coordinate: Coordinate) => {
    if (editingLocation) {
      updateDraftCoordinate(coordinate, true);
    }
  };

  const findCurrentLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('위치 권한 필요', '현재 위치를 찾으려면 위치 권한을 허용해 주세요. 지도에서 직접 찍어도 저장할 수 있어요.');
        return;
      }
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('위치 서비스 필요', '기기의 위치 서비스를 켠 뒤 다시 시도해 주세요.');
        return;
      }
      const current = await getCurrentPositionWithFallback();
      setAddressQuery('');
      updateDraftCoordinate({ latitude: current.coords.latitude, longitude: current.coords.longitude });
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
        Alert.alert('주소를 찾지 못했어요', '건물명보다 도로명 주소나 번지를 조금 더 자세히 입력해 주세요.');
        return;
      }
      updateDraftCoordinate({ latitude: first.latitude, longitude: first.longitude });
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
      const nextLocation = await api.post<StudioLocationDto>(`/bands/${bandId}/studio-location`, {
        ...draftCoordinate,
        label: clean(addressQuery),
      });
      const [nextStudios, nextCandidates] = await Promise.all([
        api.get<StudioDto[]>(`/bands/${bandId}/studios`),
        api.get<StudioCandidateDto[]>(`/bands/${bandId}/studio-candidates`),
      ]);
      setLocation(nextLocation);
      setStudios(nextStudios);
      setCandidates(nextCandidates);
      setEditingLocation(false);
    } catch (error) {
      Alert.alert('위치 저장 실패', error instanceof Error ? error.message : '집 위치를 저장하지 못했어요.');
    } finally {
      setSavingLocation(false);
    }
  };

  const registerStudio = async (studio: StudioDto) => {
    setRegisteringStudioId(studio.id);
    try {
      await api.post(`/bands/${bandId}/studios/${studio.id}/register`);
      await load();
    } catch (error) {
      Alert.alert('등록 실패', error instanceof Error ? error.message : '합주실을 등록하지 못했어요.');
    } finally {
      setRegisteringStudioId(null);
    }
  };
  const mapMarkers: OpenStreetMapMarker[] = [
    ...(draftCoordinate
      ? [{ id: 'home', coordinate: draftCoordinate, title: '내 위치', color: '#16a34a' }]
      : []),
    ...visibleStudios.filter(hasCoordinate).map((studio) => {
      const selected = activeTab === 'register' && studio.id === selectedStudioId;
      return {
        id: studio.id,
        coordinate: { latitude: studio.latitude!, longitude: studio.longitude! },
        title: studio.name,
        description: studio.address,
        color: selected ? '#ef4444' : '#2563eb',
      };
    }),
  ];

  return (
    <Screen fixedFooter={<BandInnerNav bandId={bandId} active="studio" navigation={navigation} />}>
      <View style={styles.segment}>
        <Pressable style={[styles.segmentButton, activeTab === 'location' && styles.segmentButtonActive]} onPress={() => setActiveTab('location')}>
          <Text style={[styles.segmentText, activeTab === 'location' && styles.segmentTextActive]}>내 집 위치</Text>
        </Pressable>
        <Pressable style={[styles.segmentButton, activeTab === 'register' && styles.segmentButtonActive]} onPress={() => setActiveTab('register')}>
          <Text style={[styles.segmentText, activeTab === 'register' && styles.segmentTextActive]}>합주실 등록</Text>
        </Pressable>
      </View>

      {activeTab === 'location' ? (
      <View style={styles.locationPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerText}>
            <Text style={styles.sectionTitle}>내 위치</Text>
            {location?.label || draftCoordinate ? (
              <Text style={styles.metaText} numberOfLines={1}>
                {location?.label || formatCoordinate(draftCoordinate!)}
              </Text>
            ) : null}
          </View>
          <Pressable style={styles.smallButton} onPress={() => setEditingLocation((current) => !current)}>
            <Ionicons name={editingLocation ? 'close' : 'create-outline'} size={15} color={theme.colors.text} />
            <Text style={styles.smallButtonText}>{editingLocation ? '닫기' : '수정'}</Text>
          </Pressable>
        </View>
        {editingLocation ? (
          <View style={styles.locationEditor}>
            <Field value={addressQuery} onChangeText={setAddressQuery} placeholder="예: 중앙대로 915 또는 고잔동 631-1" autoCapitalize="none" />
            <View style={styles.locationActions}>
              <PrimaryButton label="주소 찾기" onPress={findAddressLocation} loading={geocoding} style={styles.secondaryButton} />
              <PrimaryButton label="현재 위치" onPress={findCurrentLocation} loading={locating} style={styles.secondaryButton} />
            </View>
            <PrimaryButton label="이 위치 저장" onPress={saveLocation} loading={savingLocation} disabled={!draftCoordinate} />
          </View>
        ) : null}
      </View>
      ) : null}

      <View style={styles.mapPanel}>
        <View style={styles.panelHeader}>
          <View style={styles.headerText}>
            <Text style={styles.sectionTitle}>지도</Text>
          </View>
          {selectedStudio ? <StatusBadge label={registeredStudioId === selectedStudio.id ? '등록됨' : '선택됨'} tone={registeredStudioId === selectedStudio.id ? 'success' : 'warning'} /> : null}
        </View>
        {mapsEnabled ? (
        <OpenStreetMapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          markers={mapMarkers}
          onPress={onMapPress}
          onMarkerPress={(markerId) => {
            if (markerId === 'home') {
              if (draftCoordinate) {
                focusCoordinateOnMap(draftCoordinate);
              }
              return;
            }
            const studio = visibleStudios.find((item) => item.id === markerId);
            if (studio) {
              activeTab === 'register' ? selectStudio(studio) : focusStudioOnMap(studio);
            }
          }}
        >
          {draftCoordinate ? (
            <Marker
              coordinate={draftCoordinate}
              draggable={editingLocation}
              pinColor="#16a34a"
              stopPropagation
              onPress={() => focusCoordinateOnMap(draftCoordinate)}
              title="내 위치"
              onDragEnd={(event: { nativeEvent: { coordinate: Coordinate } }) => updateDraftCoordinate(event.nativeEvent.coordinate, true)}
            />
          ) : null}
          {visibleStudios.map((studio) => {
            const selected = activeTab === 'register' && studio.id === selectedStudioId;
            const registered = studio.id === registeredStudioId;
            return (
              <Marker
                key={`${studio.id}-${selected ? 'selected' : 'idle'}`}
                coordinate={{ latitude: studio.latitude!, longitude: studio.longitude! }}
                title={studio.name}
                description={studio.address ?? undefined}
                pinColor={selected ? '#ef4444' : '#2563eb'}
                zIndex={selected ? 20 : registered ? 10 : 1}
                stopPropagation
                onPress={() => activeTab === 'register' ? selectStudio(studio) : focusStudioOnMap(studio)}
              />
            );
          })}
        </OpenStreetMapView>
        ) : (
          <View style={styles.mapUnavailable}>
            <Ionicons name="map-outline" size={28} color={theme.colors.primary} />
            <Text style={styles.mapUnavailableTitle}>지도 설정이 없어 목록으로 표시해요</Text>
          </View>
        )}
        <View style={styles.mapLegend}>
          <LegendDot color="#16a34a" label="내 위치" />
          {activeTab === 'register' ? <LegendDot color="#ef4444" label="선택" /> : null}
          <LegendDot color="#2563eb" label="합주실" />
        </View>
      </View>

      {activeTab === 'register' ? (
      <View
        style={styles.listSection}
        onLayout={(event) => setStudioListWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.panelHeader}>
          <View style={styles.headerText}>
            <Text style={styles.sectionTitle}>합주실 목록</Text>
          </View>
          <Text style={styles.listCount}>{loading ? '...' : `${activeStudioIndex + 1}/${Math.max(studios.length, 1)}`}</Text>
        </View>
        {studios.length === 0 && !loading ? (
          <View style={styles.emptyListCard}>
            <Text style={styles.emptyListTitle}>합주실 목록이 비어 있어요</Text>
          </View>
        ) : null}
        <StudioCarousel
          refObject={studioListRef}
          studios={studios}
          activeIndex={activeStudioIndex}
          cardWidth={studioCardWidth}
          cardGap={studioCardGap}
          selectedStudioId={selectedStudioId}
          registeredStudioId={registeredStudioId}
          registeringStudioId={registeringStudioId}
          hasSavedLocation={Boolean(draftCoordinate)}
          onSelect={selectStudio}
          onIndexChange={(index) => {
            setActiveStudioIndex(index);
            const studio = studios[index];
            if (studio && studio.id !== selectedStudioId) {
              setSelectedStudioId(studio.id);
              focusStudioOnMap(studio);
            }
          }}
          onRegister={(studio) => void registerStudio(studio)}
        />
      </View>
      ) : null}
    </Screen>
  );
}

function StudioCarousel({
  refObject,
  studios,
  activeIndex,
  cardWidth,
  cardGap,
  selectedStudioId,
  registeredStudioId,
  registeringStudioId,
  hasSavedLocation,
  onSelect,
  onIndexChange,
  onRegister,
}: {
  refObject: React.RefObject<ScrollView | null>;
  studios: StudioDto[];
  activeIndex: number;
  cardWidth: number;
  cardGap: number;
  selectedStudioId: string | null;
  registeredStudioId: string | null;
  registeringStudioId: string | null;
  hasSavedLocation: boolean;
  onSelect: (studio: StudioDto) => void;
  onIndexChange: (index: number) => void;
  onRegister: (studio: StudioDto) => void;
}) {
  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + cardGap));
    const boundedIndex = Math.max(0, Math.min(studios.length - 1, rawIndex));
    onIndexChange(boundedIndex);
  };

  return (
    <View style={styles.carouselShell}>
      <ScrollView
        ref={refObject}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + cardGap}
        disableIntervalMomentum
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {studios.map((studio, index) => (
          <View key={studio.id} style={[styles.carouselItem, { width: cardWidth, marginRight: index === studios.length - 1 ? 0 : cardGap }]}>
            <StudioListCard
              studio={studio}
              selected={studio.id === selectedStudioId}
              registered={studio.id === registeredStudioId}
              registering={registeringStudioId === studio.id}
              hasSavedLocation={hasSavedLocation}
              onSelect={() => onSelect(studio)}
              onRegister={() => onRegister(studio)}
            />
          </View>
        ))}
      </ScrollView>
      <View style={styles.carouselDots}>
        {studios.map((studio, index) => (
          <View key={studio.id} style={[styles.carouselDot, index === activeIndex && styles.carouselDotActive]} />
        ))}
      </View>
    </View>
  );
}

function StudioListCard({
  studio,
  selected,
  registered,
  registering,
  hasSavedLocation,
  onSelect,
  onRegister,
}: {
  studio: StudioDto;
  selected: boolean;
  registered: boolean;
  registering: boolean;
  hasSavedLocation: boolean;
  onSelect: () => void;
  onRegister: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.studioCard,
        registered && styles.studioCardRegistered,
        selected && styles.studioCardSelected,
        pressed && styles.studioCardPressed,
      ]}
      onPress={onSelect}
    >
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle} numberOfLines={2}>{studio.name}</Text>
        {registered ? <StatusBadge label="등록됨" tone="success" /> : selected ? (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark" size={13} color={theme.colors.primaryDark} />
            <Text style={styles.selectedBadgeText}>선택됨</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.addressRow}>
        <Ionicons name="location-outline" size={15} color={theme.colors.textMuted} />
        <Text style={styles.addressText} numberOfLines={2}>{formatAddress(studio.address)}</Text>
      </View>
      <View style={styles.infoGrid}>
        <InfoCell icon="navigate-outline" label="내 거리" value={hasSavedLocation ? formatDistance(studio.myDistanceKm) : '내 위치 필요'} />
        <InfoCell icon="people-outline" label="평균 거리" value={formatDistance(studio.distanceAverageKm)} />
        <InfoCell icon="cash-outline" label="가격" value={formatPrice(studio.hourlyPrice)} />
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.linkActions}>
          {studio.phone ? <LinkButton icon="call-outline" label="전화" url={`tel:${studio.phone}`} /> : null}
          {studio.externalUrl ? <LinkButton icon="open-outline" label="정보" url={studio.externalUrl} /> : null}
        </View>
        <PrimaryButton label={registered ? '등록됨' : '이 합주실 등록'} onPress={onRegister} loading={registering} disabled={registered || registering} style={styles.registerButton} />
      </View>
    </Pressable>
  );
}

function InfoCell({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <View style={styles.infoCellHeader}>
        <Ionicons name={icon} size={14} color={theme.colors.primary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function LinkButton({ icon, label, url }: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string }) {
  return (
    <Pressable style={styles.linkButton} onPress={() => void Linking.openURL(url)}>
      <Ionicons name={icon} size={15} color={theme.colors.textMuted} />
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

async function getCurrentPositionWithFallback() {
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('현재 위치를 찾는 데 시간이 오래 걸리고 있어요.')), LOCATION_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 2000 });
    if (lastKnown) {
      return lastKnown;
    }
    throw error;
  }
}

function hasCoordinate(studio: StudioDto) {
  return studio.latitude !== null && studio.longitude !== null;
}

function toRegion(value: Coordinate | StudioDto): OSMRegion {
  return {
    latitude: value.latitude ?? ANSAN_CENTER.latitude,
    longitude: value.longitude ?? ANSAN_CENTER.longitude,
    latitudeDelta: 0.018,
    longitudeDelta: 0.018,
  };
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

function formatAddress(value: string | null) {
  return value ?? '주소 확인 필요';
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
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.surface,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  segmentTextActive: {
    color: theme.colors.text,
  },
  locationPanel: {
    gap: 10,
  },
  mapPanel: {
    gap: 10,
  },
  listSection: {
    gap: 10,
  },
  panelHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  smallButton: {
    minHeight: 34,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  smallButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  listCount: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  locationEditor: {
    gap: 10,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.textMuted,
  },
  map: {
    height: 250,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  mapUnavailable: {
    minHeight: 250,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  mapUnavailableTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
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
    fontSize: 13,
    fontWeight: '800',
  },
  emptyListCard: {
    minHeight: 92,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  emptyListTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  studioCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7e8ee',
    backgroundColor: theme.colors.surface,
    padding: 18,
    gap: 14,
    ...theme.shadow.card,
  },
  studioCardSelected: {
    borderColor: '#9589ef',
    backgroundColor: '#fbfaff',
    shadowColor: '#7467e8',
    shadowOpacity: 0.12,
    elevation: 3,
  },
  studioCardRegistered: {
    borderColor: '#b9ddd2',
    backgroundColor: '#f5fbf9',
  },
  studioCardPressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.96,
  },
  carouselShell: {
    gap: 10,
  },
  carouselContent: {
    alignItems: 'stretch',
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
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#d5d7df',
  },
  carouselDotActive: {
    width: 22,
    backgroundColor: theme.colors.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  selectedBadge: {
    minHeight: 26,
    borderRadius: 999,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  selectedBadgeText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  addressText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  infoCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ececf2',
    backgroundColor: '#f8f8fb',
    paddingHorizontal: 9,
    paddingVertical: 10,
    justifyContent: 'space-between',
    gap: 6,
  },
  infoCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#ececf2',
    paddingTop: 14,
  },
  linkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  linkButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e1e3e9',
    backgroundColor: '#fff',
    minHeight: 38,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  linkButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
  },
  registerButton: {
    minWidth: 136,
    minHeight: 42,
    borderRadius: 12,
  },
});
