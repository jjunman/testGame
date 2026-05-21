import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [segmentWidth, setSegmentWidth] = useState(0);
  const indicatorProgress = useRef(new Animated.Value(0)).current;
  const indicatorWidth = segmentWidth > 0 ? (segmentWidth - 8) / 2 : 0;

  useEffect(() => {
    Animated.spring(indicatorProgress, {
      toValue: activeTab === 'create' ? 0 : 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.65,
    }).start();
  }, [activeTab, indicatorProgress]);

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeTab === 'create' ? '초대코드 입력으로 전환' : '밴드 만들기로 전환'}
        style={styles.segment}
        onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
        onPress={() => setActiveTab((current) => (current === 'create' ? 'invite' : 'create'))}
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
        <SegmentLabel label="밴드 만들기" active={activeTab === 'create'} />
        <SegmentLabel label="초대코드 입력" active={activeTab === 'invite'} />
      </Pressable>
      {activeTab === 'create' ? <CreateBandForm onComplete={() => navigation.popToTop()} /> : null}
      {activeTab === 'invite' ? <JoinBandForm onComplete={() => navigation.popToTop()} /> : null}
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
});
