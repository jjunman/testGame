import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { ErrorText, Field, HeroBanner, Label, PrimaryButton, SecondaryButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { AuthStackParamList } from '../../types/navigation';
import { useAsyncAction } from '../../utils/useAsync';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { run, loading, error } = useAsyncAction(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      throw new Error('이메일과 비밀번호를 모두 입력해 주세요.');
    }
    await login({ email: trimmedEmail, password });
  });

  return (
    <Screen safeAreaTop>
      <HeroBanner
        title="합주 매니지먼트"
        subtitle="합주 준비부터 과제, 투표, 일정 조율까지 한곳에서 관리해요."
      />
      <View style={styles.form}>
        <Text style={styles.formTitle}>로그인</Text>
        <Text style={styles.formDescription}>오늘 해야 할 연습과 밴드 일정을 한눈에 확인하세요.</Text>
        <Label>이메일</Label>
        <Field value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" placeholder="name@example.com" />
        <Label>비밀번호</Label>
        <Field value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="비밀번호를 입력하세요" onSubmitEditing={() => run()} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label="로그인" onPress={() => run()} loading={loading} />
        <SecondaryButton label="회원가입으로 이동" onPress={() => navigation.navigate('Signup')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  formTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sectionTitle,
    fontWeight: '800',
  },
  formDescription: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 20,
    marginBottom: 4,
  },
});
