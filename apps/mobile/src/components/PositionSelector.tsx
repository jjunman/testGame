import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PositionType } from '@band/shared-types';
import { positionOptions, theme } from '../constants/theme';
import { Field, Label } from './UI';

type Props = {
  value: PositionType;
  onChange: (value: PositionType) => void;
  customPosition: string;
  onChangeCustomPosition: (value: string) => void;
};

export function PositionSelector({
  value,
  onChange,
  customPosition,
  onChangeCustomPosition,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () => positionOptions.find((option) => option.value === value) ?? positionOptions[0],
    [value],
  );

  return (
    <View style={styles.wrap}>
      <Label>내 포지션</Label>
      <Pressable onPress={() => setOpen((prev) => !prev)} style={[styles.trigger, open && styles.triggerOpen]}>
        <View style={styles.triggerTextWrap}>
          <Text style={styles.triggerLabel}>포지션 선택</Text>
          <Text style={styles.triggerValue}>{selectedOption.label}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.primaryDark} />
      </Pressable>

      {open ? (
        <View style={styles.menu}>
          {positionOptions.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                {selected ? <Ionicons name="checkmark" size={18} color={theme.colors.primaryDark} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {value === 'custom' ? (
        <Field
          value={customPosition}
          onChangeText={onChangeCustomPosition}
          placeholder="직접 포지션을 입력해 주세요"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  triggerOpen: {
    borderColor: theme.colors.primary,
  },
  triggerTextWrap: {
    gap: 2,
  },
  triggerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  triggerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  menu: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: theme.colors.backgroundAlt,
  },
  optionSelected: {
    backgroundColor: theme.colors.primarySoft,
  },
  optionText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: theme.colors.primaryDark,
    fontWeight: '700',
  },
});
