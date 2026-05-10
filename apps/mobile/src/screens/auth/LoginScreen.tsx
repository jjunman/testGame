import React, { useState } from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { ErrorText, Field, HeroBanner, Label, PrimaryButton, SecondaryButton, SectionCard } from '../../components/UI';
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
    <Screen>
      <HeroBanner
        title="합주 매니지먼트"
        subtitle="합주 준비부터 과제, 투표, 일정 조율까지 한곳에서 관리해요."
        badge="Welcome back"
      />
      <SectionCard title="로그인">
        <Text>오늘 해야 할 연습과 밴드 일정이 한눈에 보이도록 화면을 정리해둘게요.</Text>
        <Label>이메일</Label>
        <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" />
        <Label>비밀번호</Label>
        <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="비밀번호를 입력하세요" />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label="로그인" onPress={() => run()} loading={loading} />
        <SecondaryButton label="회원가입으로 이동" onPress={() => navigation.navigate('Signup')} />
      </SectionCard>
    </Screen>
  );
}
