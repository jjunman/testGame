import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { HeroBanner, MetricPill, PrimaryButton, SectionCard } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
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
      <Pressable
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={18} color={theme.colors.primaryDark} />
        <Text style={styles.backButtonText}>돌아가기</Text>
      </Pressable>

      <HeroBanner
        title={user?.name ?? '유저'}
        subtitle={user?.email ?? '로그인이 필요해요'}
        align="center"
      />

      <View style={styles.profileSummary}>
        <MetricPill label="이름" value={user?.name ?? '-'} />
        <View style={styles.emailRow}>
          <Text style={styles.emailLabel}>이메일</Text>
          <Text style={styles.emailValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
            {user?.email ?? '-'}
          </Text>
        </View>
      </View>

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
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 10,
  },
  backButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  profileSummary: {
    gap: 10,
  },
  emailRow: {
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  emailLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  emailValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  bodyText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});
