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
    <View style={[styles.hero, align === 'center' && styles.heroCentered]}>
      {imageUrl ? (
        <ImageBackground source={{ uri: imageUrl || fallbackBandImage }} imageStyle={styles.heroThumbImage} style={styles.heroThumb}>
          <View style={styles.heroThumbOverlay} />
        </ImageBackground>
      ) : null}
      <View style={styles.heroTextBlock}>
        <View style={[styles.heroTitleRow, align === 'center' && styles.center]}>
          <Text style={[styles.heroTitle, align === 'center' && styles.centerText]} numberOfLines={2}>{title}</Text>
          {badge ? (
            <Text style={styles.heroBadgeText}>{badge}</Text>
          ) : null}
        </View>
        {subtitle ? <Text style={[styles.heroSubtitle, align === 'center' && styles.centerText]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SectionCard({
  title,
  children,
  accent,
}: {
  title?: string;
  children: React.ReactNode;
  accent?: 'purple' | 'pink';
}) {
  return (
    <View style={[styles.card, accent === 'purple' && styles.cardPurple, accent === 'pink' && styles.cardPink]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function TextButton({
  label,
  onPress,
  tone = 'default',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.textButton, disabled && styles.textButtonDisabled, style]}>
      <Text style={[styles.textButtonText, tone === 'danger' && styles.textButtonDanger]}>{label}</Text>
    </Pressable>
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
      {trailing}
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  heroCentered: {
    justifyContent: 'center',
  },
  heroThumb: {
    width: 44,
    height: 44,
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  heroThumbImage: {
    borderRadius: theme.radius.md,
  },
  heroThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  heroTextBlock: {
    flex: 1,
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroBadgeText: {
    overflow: 'hidden',
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.primarySoft,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  heroTitle: {
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
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
    padding: 13,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardPurple: {
    backgroundColor: theme.colors.surface,
  },
  cardPink: {
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.text,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
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
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  metricPill: {
    flex: 1,
    minWidth: 96,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 4,
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
    borderRadius: theme.radius.sm,
    borderWidth: 1,
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
    borderRadius: theme.radius.md,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'flex-start',
    gap: 6,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyDescription: {
    color: theme.colors.textMuted,
    textAlign: 'left',
    lineHeight: 20,
    fontSize: 13,
  },
  error: {
    color: theme.colors.danger,
    fontWeight: '600',
  },
  textButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  textButtonDisabled: {
    opacity: 0.45,
  },
  textButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  textButtonDanger: {
    color: theme.colors.danger,
  },
});
