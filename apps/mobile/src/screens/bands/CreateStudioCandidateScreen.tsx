import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  const [studios, setStudios] = useState<StudioDto[]>([]);
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStudios = useCallback(async () => {
    setLoading(true);
    try {
      const nextStudios = await api.get<StudioDto[]>(`/bands/${bandId}/studios`);
      setStudios(nextStudios);
      setSelectedStudioId((current) => current ?? nextStudios[0]?.id ?? null);
      const firstLocated = nextStudios.find(hasCoordinate);
      if (firstLocated) {
        setMapRegion(toRegion(firstLocated));
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
      setMapRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 350);
    }
  };

  const visibleStudios = expanded ? studios : studios.slice(0, 3);
  const locatedStudios = studios.filter(hasCoordinate);
  const selectedStudio = studios.find((studio) => studio.id === selectedStudioId) ?? null;

  return (
    <Screen>
      <HeroBanner title="합주실 후보 추가" subtitle="앱에서 제공하는 안산 합주실 목록에서 후보를 골라요." badge="안산" />

      <SectionCard title="앱 제공 합주실">
        <PrimaryButton label="목록 새로고침" onPress={loadStudios} loading={loading} />
        {studios.length > 0 ? (
          <Text style={styles.countText}>
            {expanded ? `제공 중인 합주실 ${studios.length}곳` : `가까운 순 ${Math.min(3, studios.length)}곳 표시 중`}
          </Text>
        ) : null}
        {studios.length === 0 ? (
          <EmptyState title="제공 목록이 비어 있어요" description="잠시 후 다시 불러와 주세요." />
        ) : (
          <>
            <MapView ref={mapRef} style={styles.map} region={mapRegion} onRegionChangeComplete={setMapRegion}>
              {locatedStudios.map((studio) => (
                <Marker
                  key={studio.id}
                  coordinate={{ latitude: studio.latitude!, longitude: studio.longitude! }}
                  title={studio.name}
                  description={studio.address ?? undefined}
                  pinColor={studio.id === selectedStudioId ? theme.colors.primary : '#7b8496'}
                  onPress={() => selectStudio(studio)}
                />
              ))}
            </MapView>
            {selectedStudio ? <Text style={styles.selectedText}>선택됨: {selectedStudio.name}</Text> : null}
            <View style={styles.studioList}>
              {visibleStudios.map((studio) => (
                <StudioOption
                  key={studio.id}
                  studio={studio}
                  selected={selectedStudioId === studio.id}
                  onPress={() => selectStudio(studio)}
                />
              ))}
            </View>
            {studios.length > 3 ? (
              <PrimaryButton
                label={expanded ? '접기' : '전체 보기'}
                onPress={() => setExpanded((current) => !current)}
                style={styles.toggleButton}
              />
            ) : null}
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
      <StudioInfo label="위치" value={studio.address ?? '주소 확인 필요'} selected={selected} />
      <StudioInfo label="가격" value={formatPrice(studio.hourlyPrice)} selected={selected} />
      <StudioInfo label="내 거리" value={formatDistance(studio.myDistanceKm)} selected={selected} />
      <StudioInfo label="평균" value={formatDistance(studio.distanceAverageKm)} selected={selected} />
    </Pressable>
  );
}

function StudioInfo({ label, value, selected }: { label: string; value: string; selected: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, selected && styles.optionMetaSelected]}>{label}</Text>
      <Text style={[styles.infoValue, selected && styles.optionMetaSelected]}>{value}</Text>
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
    gap: 8,
    marginTop: 10,
  },
  map: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
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
    marginTop: 8,
  },
  studioOption: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    padding: 14,
    gap: 8,
  },
  studioOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
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
    color: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoLabel: {
    width: 44,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  infoValue: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  optionMetaSelected: {
    color: 'rgba(255,255,255,0.86)',
  },
  toggleButton: {
    marginTop: 10,
    backgroundColor: theme.colors.primaryDark,
  },
});
