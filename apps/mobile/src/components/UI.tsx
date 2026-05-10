import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { fallbackBandImage, theme } from '../constants/theme';

export function HeroBanner({
  title,
  subtitle,
  imageUrl,
  badge,
  align = 'left',
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  badge?: string;
  align?: 'left' | 'center';
}) {
  return (
    <ImageBackground source={{ uri: imageUrl || fallbackBandImage }} imageStyle={styles.heroImage} style={styles.hero}>
      <View style={styles.heroOverlay} />
      {badge ? (
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <View style={[styles.heroContent, align === 'center' && styles.center]}>
        <Text style={[styles.heroTitle, align === 'center' && styles.centerText]}>{title}</Text>
        {subtitle ? <Text style={[styles.heroSubtitle, align === 'center' && styles.centerText]}>{subtitle}</Text> : null}
      </View>
    </ImageBackground>
  );
}

export function SectionCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: 'purple' | 'pink';
}) {
  return (
    <View style={[styles.card, accent === 'purple' && styles.cardPurple, accent === 'pink' && styles.cardPink]}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.primary}
      {...props}
    />
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[styles.button, disabled && styles.buttonDisabled, style]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.secondaryButton, style]}>
      <Text style={[styles.secondaryText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function MetricPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'pink';
}) {
  return (
    <View style={[styles.metricPill, tone === 'pink' && styles.metricPillPink]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function StatusBadge({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <Text
      style={[
        styles.badge,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warning' && styles.badgeWarning,
        tone === 'danger' && styles.badgeDanger,
      ]}
    >
      {label}
    </Text>
  );
}

export function OptionRow({
  title,
  subtitle,
  selected,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.optionRow, selected && styles.optionRowSelected]}>
      <View style={styles.optionCheck}>
        <Text style={[styles.optionCheckText, selected && styles.optionCheckTextSelected]}>{selected ? '?' : ''}</Text>
      </View>
      <View style={styles.optionBody}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{title}</Text>
        {subtitle ? <Text style={[styles.optionSubtitle, selected && styles.optionSubtitleSelected]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? <StatusBadge label={selected ? '선택됨' : '선택'} tone={selected ? 'success' : 'default'} />}
    </Pressable>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 164,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroImage: {
    borderRadius: theme.radius.lg,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 13, 41, 0.48)',
  },
  heroBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroContent: {
    gap: 4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
  },
  center: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    gap: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  cardPurple: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  cardPink: {
    backgroundColor: '#fff0f3',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: theme.colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 108,
    textAlignVertical: 'top',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: theme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 15,
  },
  metricPill: {
    flex: 1,
    minWidth: 96,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  metricPillPink: {
    backgroundColor: theme.colors.accentSoft,
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: theme.colors.primarySoft,
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  badgeSuccess: {
    backgroundColor: '#dff7ee',
    color: '#18875d',
  },
  badgeWarning: {
    backgroundColor: '#fff1d8',
    color: '#b56a00',
  },
  badgeDanger: {
    backgroundColor: '#ffe1e7',
    color: '#d1475d',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionRowSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  optionCheckText: {
    color: theme.colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  optionCheckTextSelected: {
    color: theme.colors.primaryDark,
  },
  optionBody: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionTitleSelected: {
    color: '#fff',
  },
  optionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  optionSubtitleSelected: {
    color: 'rgba(255,255,255,0.82)',
  },
  empty: {
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyDescription: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  error: {
    color: theme.colors.danger,
    fontWeight: '600',
  },
});
