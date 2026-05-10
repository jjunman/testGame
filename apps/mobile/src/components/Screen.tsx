import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

type ScreenProps = {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  fixedFooter?: React.ReactNode;
  scrollEnabled?: boolean;
};

export function Screen({ children, contentContainerStyle, fixedFooter, scrollEnabled = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomSpacing = insets.bottom + 116;

  const body = (
    <View style={styles.backdrop}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      {scrollEnabled ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, { paddingBottom: bottomSpacing }, contentContainerStyle]}>{children}</View>
      )}
      {fixedFooter ? <View style={styles.fixedFooter}>{fixedFooter}</View> : null}
    </View>
  );

  return <SafeAreaView style={styles.safe}>{body}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
  },
  fill: {
    flex: 1,
  },
  fixedFooter: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#ddd1ff',
    opacity: 0.55,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#ffe3ea',
    opacity: 0.5,
  },
});
