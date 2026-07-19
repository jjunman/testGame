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
import { Ionicons } from '@expo/vector-icons';
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.textButton, pressed && styles.textButtonPressed, disabled && styles.textButtonDisabled, style]}
    >
      <Text style={[styles.textButtonText, tone === 'danger' && styles.textButtonDanger]}>{label}</Text>
    </Pressable>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = React.useState(false);

  return (
    <TextInput
      {...props}
      style={[styles.input, focused && styles.inputFocused, props.multiline && styles.inputMultiline, props.style]}
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.primary}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, (disabled || loading) && styles.buttonDisabled, style]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function ActionCardButton({
  title,
  subtitle,
  icon,
  onPress,
  loading,
  disabled,
  style,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionCard,
        pressed && !disabled && !loading && styles.actionCardPressed,
        (disabled || loading) && styles.actionCardDisabled,
        style,
      ]}
    >
      <View style={styles.actionIconBox}>
        {loading ? <ActivityIndicator color={theme.colors.primaryDark} /> : <Ionicons name={icon} size={22} color={theme.colors.primaryDark} />}
      </View>
      <View style={styles.actionTextBlock}>
        <Text style={styles.actionTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.actionSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
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
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed, style]}>
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, selected && styles.optionRowSelected, pressed && styles.optionRowPressed]}
    >
      <View style={styles.optionCheck}>
        {selected ? <Ionicons name="checkmark" size={15} color={theme.colors.primaryDark} /> : null}
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

export function ErrorState({
  title = '불러오기 실패',
  description,
  actionLabel = '다시 시도',
  onRetry,
}: {
  title?: string;
  description: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorState}>
      <View style={styles.errorIconBox}>
        <Ionicons name="alert-circle-outline" size={22} color={theme.colors.danger} />
      </View>
      <View style={styles.errorStateCopy}>
        <Text style={styles.errorStateTitle}>{title}</Text>
        <Text style={styles.errorStateDescription}>{description}</Text>
      </View>
      {onRetry ? <SecondaryButton label={actionLabel} onPress={onRetry} style={styles.errorRetryButton} /> : null}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  tone = 'default',
  size = 38,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'plain';
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size },
        tone === 'danger' && styles.iconButtonDanger,
        tone === 'plain' && styles.iconButtonPlain,
        pressed && !disabled && styles.iconButtonPressed,
        disabled && styles.iconButtonDisabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.52)} color={tone === 'danger' ? theme.colors.danger : theme.colors.primaryDark} />
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const content = (
    <>
      {icon ? (
        <View style={styles.listRowIcon}>
          <Ionicons name={icon} size={18} color={theme.colors.primaryDark} />
        </View>
      ) : null}
      <View style={styles.listRowBody}>
        <Text style={styles.listRowTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} /> : null)}
    </>
  );

  if (!onPress) {
    return <View style={styles.listRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
    >
      {content}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.segmentPressed]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={2}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function LoadingState({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <View style={[styles.loadingState, fullScreen && styles.loadingStateFullScreen]}>
      <View style={styles.loadingWindow}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  heroCentered: {
    justifyContent: 'center',
  },
  heroThumb: {
    width: 56,
    height: 56,
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
    gap: 3,
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
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  heroTitle: {
    flexShrink: 1,
    color: theme.colors.text,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
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
    padding: 20,
    gap: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardPurple: {
    backgroundColor: theme.colors.surface,
  },
  cardPink: {
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontSize: theme.typography.sectionTitle,
    lineHeight: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 0,
  },
  input: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: theme.colors.text,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inputMultiline: {
    minHeight: 124,
    textAlignVertical: 'top',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    paddingHorizontal: 20,
    minHeight: 58,
  },
  buttonPressed: {
    backgroundColor: theme.colors.primaryDark,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
  actionCard: {
    minHeight: 84,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionCardPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  actionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  actionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  secondaryButtonPressed: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.primary,
    transform: [{ scale: 0.985 }],
  },
  secondaryText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
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
    fontSize: 17,
    fontWeight: '900',
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#eef0f3',
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  optionRowSelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  optionRowPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.88,
  },
  optionCheck: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  optionBody: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  optionTitleSelected: {
    color: theme.colors.text,
  },
  optionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  optionSubtitleSelected: {
    color: theme.colors.textMuted,
  },
  empty: {
    borderRadius: theme.radius.md,
    paddingVertical: 28,
    paddingHorizontal: 18,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'flex-start',
    gap: 6,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyDescription: {
    color: theme.colors.textMuted,
    textAlign: 'left',
    lineHeight: 23,
    fontSize: 15,
    fontWeight: '600',
  },
  errorState: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#f0c7c7',
    backgroundColor: '#fff7f7',
    padding: 18,
    gap: 14,
  },
  errorIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe7e7',
  },
  errorStateCopy: {
    gap: 5,
  },
  errorStateTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  errorStateDescription: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  errorRetryButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.primarySoft,
  },
  iconButtonDanger: {
    backgroundColor: '#fff1f1',
    borderColor: '#f0c7c7',
  },
  iconButtonPlain: {
    backgroundColor: theme.colors.surface,
  },
  iconButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  listRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  listRowPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  listRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
  },
  listRowBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  listRowTitle: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  listRowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  segmented: {
    minHeight: 56,
    flexDirection: 'row',
    borderRadius: theme.radius.sm,
    padding: 4,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadow.card,
  },
  segmentPressed: {
    opacity: 0.72,
  },
  segmentText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '800',
  },
  segmentTextActive: {
    color: theme.colors.text,
  },
  error: {
    color: theme.colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  loadingState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingStateFullScreen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingWindow: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  textButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  textButtonPressed: {
    opacity: 0.62,
  },
  textButtonDisabled: {
    opacity: 0.45,
  },
  textButtonText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  textButtonDanger: {
    color: theme.colors.danger,
  },
});
