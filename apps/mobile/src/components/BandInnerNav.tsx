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
        icon={<Ionicons name={active === 'home' ? 'home' : 'home-outline'} size={22} color={active === 'home' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('BandHome', { bandId })}
      />
      <NavItem
        label="노래"
        active={active === 'song'}
        icon={
          <MaterialCommunityIcons
            name={active === 'song' ? 'music-note' : 'music-note-outline'}
            size={22}
            color={active === 'song' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('SongRound', { bandId })}
      />
      <NavItem
        label="달력"
        active={active === 'calendar'}
        icon={<Ionicons name={active === 'calendar' ? 'calendar' : 'calendar-outline'} size={22} color={active === 'calendar' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('Schedule', { bandId })}
      />
      <NavItem
        label="합주실"
        active={active === 'studio'}
        icon={
          <MaterialCommunityIcons
            name={active === 'studio' ? 'map-marker' : 'map-marker-outline'}
            size={22}
            color={active === 'studio' ? theme.colors.primary : inactiveColor}
          />
        }
        onPress={() => navigation.navigate('Studios', { bandId })}
      />
      <NavItem
        label="멤버"
        active={active === 'user'}
        icon={<Ionicons name={active === 'user' ? 'person' : 'person-outline'} size={22} color={active === 'user' ? theme.colors.primary : inactiveColor} />}
        onPress={() => navigation.navigate('BandMembers', { bandId })}
      />
    </View>
  );
}

const inactiveColor = '#7c8491';

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
    <Pressable onPress={onPress} style={[styles.item, active && styles.itemActive]}>
      {icon}
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    height: 68,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 6,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 5,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: theme.radius.md,
  },
  itemActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  label: {
    color: inactiveColor,
    fontSize: 10,
    fontWeight: '800',
  },
  labelActive: {
    color: theme.colors.primary,
  },
});
