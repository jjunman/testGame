import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { HeroBanner, PrimaryButton, SectionCard } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Profile'>;

export function ProfileScreen(_: Props) {
  const { user, logout } = useAuth();
  const confirmLogout = () => {
    Alert.alert('로그아웃할까요?', '현재 계정에서 로그아웃합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  };

  return (
    <Screen>
      <HeroBanner
        title={user?.name ?? '유저'}
        subtitle={user?.email ?? '로그인이 필요해요'}
        align="center"
      />

      <SectionCard title="계정">
        <Text style={styles.bodyText}>
          현재 계정으로 가입한 밴드와 개인 정보를 확인하고, 필요하면 로그아웃할 수 있어요.
        </Text>
        <PrimaryButton label="로그아웃" onPress={confirmLogout} />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});
