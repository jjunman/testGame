import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PracticeAssignmentDto } from '@band/shared-types';
import { api } from '../../api/client';
import { Screen } from '../../components/Screen';
import { EmptyState, HeroBanner, PrimaryButton, SectionCard, StatusBadge } from '../../components/UI';
import { theme } from '../../constants/theme';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'PracticeAssignments'>;

export function PracticeAssignmentListScreen({ route, navigation }: Props) {
  const { bandId } = route.params;
  const [items, setItems] = useState<PracticeAssignmentDto[]>([]);

  const load = useCallback(async () => {
    setItems(await api.get<PracticeAssignmentDto[]>(`/bands/${bandId}/practice-assignments`));
  }, [bandId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  return (
    <Screen>
      <HeroBanner
        title="개인 연습"
        subtitle="연습 마감일과 제출 상태를 한 번에 확인해요."
        badge={`${items.length}개 과제`}
      />

      <PrimaryButton
          label="연습 과제 만들기"
          onPress={() => navigation.navigate('CreatePracticeAssignment', { bandId })}
        />

      {items.length === 0 ? (
        <EmptyState
          title="등록된 연습 과제가 없어요"
          description="리더가 합주곡의 연습 구간과 마감일을 정하면 여기에 연습 카드가 생겨요."
        />
      ) : null}

      {items.map((item) => (
        <SectionCard key={item.id} title={item.songTitle ?? item.title}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge label={item.hasSubmitted ? '제출 완료' : '제출 필요'} tone={item.hasSubmitted ? 'success' : 'danger'} />
            <StatusBadge label={item.status === 'open' ? '진행중' : '마감'} tone={item.status === 'open' ? 'warning' : 'default'} />
          </View>
          <Text style={{ color: theme.colors.text }}>
            {item.description ?? '이 곡의 연습 과제를 확인하고 녹음본을 제출해 주세요.'}
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            마감일: {new Date(item.dueAt).toLocaleString('ko-KR')}
          </Text>
          {item.startSec !== null || item.endSec !== null ? (
            <Text style={{ color: theme.colors.textMuted }}>
              연습 구간: {item.startSec ?? 0}초 - {item.endSec ?? '?'}초
            </Text>
          ) : null}
          <PrimaryButton
            label="곡 연습 페이지로 이동"
            onPress={() => navigation.navigate('PracticeAssignmentDetail', { bandId, assignmentId: item.id })}
          />
        </SectionCard>
      ))}
    </Screen>
  );
}
