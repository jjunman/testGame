import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { ErrorText, Field, HeroBanner, Label, PrimaryButton, SecondaryButton } from '../../components/UI';
import { theme } from '../../constants/theme';
import { useAuth } from '../../store/AuthContext';
import { AuthStackParamList } from '../../types/navigation';
import { useAsyncAction } from '../../utils/useAsync';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { run, loading, error } = useAsyncAction(async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) {
      throw new Error('이름은 2자 이상 입력해 주세요.');
    }
    if (!trimmedEmail.includes('@')) {
      throw new Error('올바른 이메일을 입력해 주세요.');
    }
    if (password.length < 6) {
      throw new Error('비밀번호는 6자 이상 입력해 주세요.');
    }
    await signup({ name: trimmedName, email: trimmedEmail, password });
  });

  return (
    <Screen safeAreaTop>
      <HeroBanner
        title="새 밴드 시작"
        subtitle="먼저 계정을 만들고, 원하는 밴드에 참여하거나 직접 밴드를 만들어보세요."
      />
      <View style={styles.form}>
        <Text style={styles.formTitle}>회원가입</Text>
        <Label>이름</Label>
        <Field value={name} onChangeText={setName} autoComplete="name" placeholder="표시될 이름" />
        <Label>이메일</Label>
        <Field value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" placeholder="name@example.com" />
        <Label>비밀번호</Label>
        <Field value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="6자 이상 입력하세요" onSubmitEditing={() => run()} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <PrimaryButton label="계정 만들기" onPress={() => run()} loading={loading} />
        <SecondaryButton label="로그인으로 돌아가기" onPress={() => navigation.goBack()} />
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
    marginBottom: 4,
  },
});
