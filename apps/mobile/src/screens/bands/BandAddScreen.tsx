import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { theme } from '../../constants/theme';
import { CreateBandForm } from './CreateBandScreen';
import { JoinBandForm } from './JoinBandScreen';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'BandAdd'>;
type BandAddTab = 'create' | 'invite';

export function BandAddScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<BandAddTab>('create');

  return (
    <Screen>
      <View style={styles.segment}>
        <SegmentButton label="밴드 만들기" active={activeTab === 'create'} onPress={() => setActiveTab('create')} />
        <SegmentButton label="초대코드 입력" active={activeTab === 'invite'} onPress={() => setActiveTab('invite')} />
      </View>
      {activeTab === 'create' ? <CreateBandForm onComplete={() => navigation.popToTop()} /> : null}
      {activeTab === 'invite' ? <JoinBandForm onComplete={() => navigation.popToTop()} /> : null}
    </Screen>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
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
});
