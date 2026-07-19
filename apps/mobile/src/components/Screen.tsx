import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

type ScreenProps = {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  fixedFooter?: React.ReactNode;
  safeAreaTop?: boolean;
  scrollEnabled?: boolean;
};

export function Screen({ children, contentContainerStyle, fixedFooter, safeAreaTop = false, scrollEnabled = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const hasFixedFooter = Boolean(fixedFooter);
  const [footerHeight, setFooterHeight] = useState(96);
  const contentOffset = useRef(new Animated.Value(hasFixedFooter ? 32 : 0)).current;
  const bottomSpacing = hasFixedFooter ? insets.bottom + footerHeight + 26 : insets.bottom + 28;

  useEffect(() => {
    if (!hasFixedFooter || !isFocused) {
      return;
    }

    contentOffset.setValue(32);
    Animated.timing(contentOffset, {
      toValue: 0,
      duration: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentOffset, hasFixedFooter, isFocused]);

  const content = scrollEnabled ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, { paddingBottom: bottomSpacing }, contentContainerStyle]}>{children}</View>
  );

  const body = (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.animatedContent, { transform: [{ translateX: contentOffset }] }]}>
        {content}
      </Animated.View>
      {fixedFooter ? (
        <View style={styles.fixedFooter} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
          {fixedFooter}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={safeAreaTop ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}>
      {body}
    </SafeAreaView>
  );
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
    paddingTop: 18,
    paddingBottom: 28,
    gap: 20,
  },
  animatedContent: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  fixedFooter: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
  },
});
