import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../constants/theme';
import { BandsStackParamList } from '../types/navigation';

type BandInnerNavProps = {
  bandId: string;
  active: 'home' | 'song' | 'vote' | 'studio' | 'settlement';
  navigation: NativeStackNavigationProp<BandsStackParamList>;
};

const navItemCount = 4;

export function BandInnerNav({ bandId, active, navigation }: BandInnerNavProps) {
  const [navWidth, setNavWidth] = useState(0);
  const activeIndex = getActiveIndex(active);
  const indicatorProgress = useRef(new Animated.Value(activeIndex)).current;
  const indicatorWidth = navWidth > 0 ? (navWidth - 8) / navItemCount : 0;
  const showIndicator = activeIndex >= 0 && indicatorWidth > 0;

  useEffect(() => {
    if (!showIndicator) {
      return;
    }

    Animated.spring(indicatorProgress, {
      toValue: activeIndex,
      useNativeDriver: true,
      damping: 20,
      stiffness: 220,
      mass: 0.65,
    }).start();
  }, [activeIndex, indicatorProgress, showIndicator]);

  return (
    <View style={styles.wrap} onLayout={(event) => setNavWidth(event.nativeEvent.layout.width)}>
      {showIndicator ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: indicatorWidth,
              transform: [
                {
                  translateX: indicatorProgress.interpolate({
                    inputRange: [0, 1, 2, 3],
                    outputRange: [0, indicatorWidth, indicatorWidth * 2, indicatorWidth * 3],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      <NavItem
        label="홈"
        active={active === 'home'}
        icon={<Ionicons name={active === 'home' ? 'home' : 'home-outline'} size={26} color={active === 'home' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('BandHome', { bandId })}
      />
      <NavItem
        label="곡·연습"
        active={active === 'song' || active === 'vote'}
        icon={
          <MaterialCommunityIcons
            name={active === 'song' || active === 'vote' ? 'music-note' : 'music-note-outline'}
            size={26}
            color={active === 'song' || active === 'vote' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('SongRound', { bandId })}
      />
      <NavItem
        label="합주실"
        active={active === 'studio'}
        icon={
          <MaterialCommunityIcons
            name={active === 'studio' ? 'map-marker' : 'map-marker-outline'}
            size={26}
            color={active === 'studio' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('Studios', { bandId })}
      />
      <NavItem
        label="정산"
        active={active === 'settlement'}
        icon={<Ionicons name={active === 'settlement' ? 'card' : 'card-outline'} size={26} color={active === 'settlement' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('Settlement', { bandId })}
      />
    </View>
  );
}

const inactiveColor = '#7c8491';

function getActiveIndex(active: BandInnerNavProps['active']) {
  if (active === 'song' || active === 'vote') {
    return 1;
  }
  return active === 'home' ? 0 : active === 'studio' ? 2 : 3;
}

function NavItem({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      {icon}
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    height: 76,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
    ...theme.shadow.floating,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: theme.radius.md,
    zIndex: 1,
  },
  itemPressed: {
    opacity: 0.62,
    transform: [{ scale: 0.97 }],
  },
  label: {
    color: inactiveColor,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
    minHeight: 30,
    textAlign: 'center',
  },
  labelActive: {
    color: theme.colors.primaryDark,
    fontWeight: '800',
  },
});
