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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  fill: {
    flex: 1,
  },
  fixedFooter: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
});
