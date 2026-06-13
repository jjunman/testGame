import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

type BandInnerNavProps = {
  bandId: string;
  active: 'home' | 'song' | 'vote' | 'calendar' | 'studio' | 'settlement';
  navigation: any;
};

let lastActiveIndex = 0;

export function BandInnerNav({ bandId, active, navigation }: BandInnerNavProps) {
  const [navWidth, setNavWidth] = useState(0);
  const activeIndex = getActiveIndex(active);
  const indicatorProgress = useRef(new Animated.Value(Math.max(0, lastActiveIndex))).current;
  const indicatorWidth = navWidth > 0 ? (navWidth - 10) / 6 : 0;
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
    lastActiveIndex = activeIndex;
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
                    inputRange: [0, 1, 2, 3, 4, 5],
                    outputRange: [0, indicatorWidth, indicatorWidth * 2, indicatorWidth * 3, indicatorWidth * 4, indicatorWidth * 5],
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
        icon={<Ionicons name={active === 'home' ? 'home' : 'home-outline'} size={21} color={active === 'home' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('BandHome', { bandId })}
      />
      <NavItem
        label="곡"
        active={active === 'song'}
        icon={
          <MaterialCommunityIcons
            name={active === 'song' ? 'music-note' : 'music-note-outline'}
            size={21}
            color={active === 'song' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('SongRound', { bandId, initialTab: 'library' })}
      />
      <NavItem
        label="투표"
        active={active === 'vote'}
        icon={<Ionicons name={active === 'vote' ? 'checkbox' : 'checkbox-outline'} size={21} color={active === 'vote' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('SongRound', { bandId, initialTab: 'vote' })}
      />
      <NavItem
        label="일정"
        active={active === 'calendar'}
        icon={<Ionicons name={active === 'calendar' ? 'calendar' : 'calendar-outline'} size={21} color={active === 'calendar' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('Schedule', { bandId })}
      />
      <NavItem
        label="합주실"
        active={active === 'studio'}
        icon={
          <MaterialCommunityIcons
            name={active === 'studio' ? 'map-marker' : 'map-marker-outline'}
            size={21}
            color={active === 'studio' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('Studios', { bandId })}
      />
      <NavItem
        label="정산"
        active={active === 'settlement'}
        icon={<Ionicons name={active === 'settlement' ? 'card' : 'card-outline'} size={21} color={active === 'settlement' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('Settlement', { bandId })}
      />
    </View>
  );
}

const inactiveColor = '#7c8491';

function getActiveIndex(active: BandInnerNavProps['active']) {
  return ['home', 'song', 'vote', 'calendar', 'studio', 'settlement'].indexOf(active);
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
    <Pressable onPress={onPress} style={styles.item}>
      {icon}
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    height: 62,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 5,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: theme.radius.md,
    zIndex: 1,
  },
  label: {
    color: inactiveColor,
    fontSize: 9,
    fontWeight: '800',
  },
  labelActive: {
    color: theme.colors.primaryDark,
  },
});
