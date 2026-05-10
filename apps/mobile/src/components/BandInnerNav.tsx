import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

type BandInnerNavProps = {
  bandId: string;
  active: 'home' | 'song' | 'calendar' | 'studio' | 'user';
  navigation: any;
};

export function BandInnerNav({ bandId, active, navigation }: BandInnerNavProps) {
  return (
    <View style={styles.wrap}>
      <NavItem
        label="홈"
        active={active === 'home'}
        icon={<Ionicons name={active === 'home' ? 'home' : 'home-outline'} size={23} color={active === 'home' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('BandHome', { bandId })}
      />
      <NavItem
        label="쏭"
        active={active === 'song'}
        icon={
          <MaterialCommunityIcons
            name={active === 'song' ? 'music-note' : 'music-note-outline'}
            size={23}
            color={active === 'song' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('SongRound', { bandId })}
      />
      <NavItem
        label="calendar"
        active={active === 'calendar'}
        icon={<Ionicons name={active === 'calendar' ? 'calendar' : 'calendar-outline'} size={23} color={active === 'calendar' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('Schedule', { bandId })}
      />
      <NavItem
        label="김태영"
        active={active === 'studio'}
        icon={
          <MaterialCommunityIcons
            name={active === 'studio' ? 'map-marker' : 'map-marker-outline'}
            size={23}
            color={active === 'studio' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('Studios', { bandId })}
      />
      <NavItem
        label="바보"
        active={active === 'user'}
        icon={<Ionicons name={active === 'user' ? 'person' : 'person-outline'} size={23} color={active === 'user' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('BandMembers', { bandId })}
      />
    </View>
  );
}

const inactiveColor = '#9e96c8';

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
    height: 72,
    backgroundColor: '#e7ddff',
    borderRadius: 22,
    paddingTop: 10,
    paddingBottom: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    color: inactiveColor,
    fontSize: 10,
    fontWeight: '700',
  },
  labelActive: {
    color: theme.colors.primary,
  },
});
