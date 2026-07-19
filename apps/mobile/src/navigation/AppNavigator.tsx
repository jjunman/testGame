import type { BandSummary } from '@band/shared-types';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useAuth } from '../store/AuthContext';
import { useCurrentBand } from '../store/CurrentBandContext';
import { api } from '../api/client';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { BandListScreen } from '../screens/bands/BandListScreen';
import { BandAddScreen } from '../screens/bands/BandAddScreen';
import { CreateBandScreen } from '../screens/bands/CreateBandScreen';
import { JoinBandScreen } from '../screens/bands/JoinBandScreen';
import { BandHomeScreen } from '../screens/bands/BandHomeScreen';
import { VoteHubScreen } from '../screens/bands/VoteHubScreen';
import { BandMembersScreen } from '../screens/bands/BandMembersScreen';
import { SongRoundScreen, SongVoteScreen } from '../screens/bands/SongRoundScreen';
import { AddSongCandidateScreen } from '../screens/bands/AddSongCandidateScreen';
import { PracticeAssignmentListScreen } from '../screens/bands/PracticeAssignmentListScreen';
import { SongPracticeDetailScreen } from '../screens/bands/SongPracticeDetailScreen';
import { CreatePracticeAssignmentScreen } from '../screens/bands/CreatePracticeAssignmentScreen';
import { PracticeAssignmentDetailScreen } from '../screens/bands/PracticeAssignmentDetailScreen';
import { ScheduleEditScreen } from '../screens/bands/ScheduleEditScreen';
import { CreateScheduleSlotScreen } from '../screens/bands/CreateScheduleSlotScreen';
import { StudioRegisterScreen } from '../screens/bands/StudioRegisterScreen';
import { FastSettlementScreen } from '../screens/bands/FastSettlementScreen';
import { SettlementDetailScreen } from '../screens/bands/SettlementDetailScreen';
import { SettlementHistoryScreen } from '../screens/bands/SettlementHistoryScreen';
import { CreateStudioCandidateScreen } from '../screens/bands/CreateStudioCandidateScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { AuthStackParamList, BandsStackParamList } from '../types/navigation';
import { theme } from '../constants/theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const BandsStack = createNativeStackNavigator<BandsStackParamList>();
const navigationRef = createNavigationContainerRef<BandsStackParamList>();

type PendingPracticeFeedback = { bandId: string; assignmentId: string };

type AppStackOptions = NativeStackNavigationOptions & {
  headerTopInsetEnabled?: boolean;
};

const stackOptions: AppStackOptions = {
  headerStyle: {
    backgroundColor: theme.colors.background,
  },
  headerTopInsetEnabled: true,
  headerShadowVisible: false,
  headerTitleStyle: {
    color: theme.colors.text,
    fontWeight: '800' as const,
    fontSize: 17,
  },
  headerTintColor: theme.colors.text,
  contentStyle: {
    backgroundColor: theme.colors.background,
  },
};

function BandsNavigator() {
  return (
    <BandsStack.Navigator screenOptions={stackOptions}>
      <BandsStack.Screen name="BandList" component={BandListScreen} options={{ title: '내 밴드' }} />
      <BandsStack.Screen name="Profile" component={ProfileScreen} options={{ title: '유저' }} />
      <BandsStack.Screen name="BandAdd" component={BandAddScreen} options={{ title: '밴드 추가하기' }} />
      <BandsStack.Screen name="JoinBand" component={JoinBandScreen} options={{ title: '초대코드 입력하기' }} />
      <BandsStack.Screen name="CreateBand" component={CreateBandScreen} options={{ title: '밴드 만들기' }} />
      <BandsStack.Screen name="BandHome" component={BandHomeScreen} options={{ title: '밴드 홈', animation: 'none' }} />
      <BandsStack.Screen name="VoteHub" component={VoteHubScreen} options={{ title: '투표 모아보기', animation: 'none' }} />
      <BandsStack.Screen name="BandMembers" component={BandMembersScreen} options={{ title: '밴드 정보', animation: 'none' }} />
      <BandsStack.Screen name="SongRound" component={SongRoundScreen} options={{ title: '곡과 연습', animation: 'none' }} />
      <BandsStack.Screen name="SongVote" component={SongVoteScreen} options={{ title: '합주곡 투표' }} />
      <BandsStack.Screen name="AddSongCandidate" component={AddSongCandidateScreen} options={{ title: '곡 추가하기' }} />
      <BandsStack.Screen name="PracticeAssignments" component={PracticeAssignmentListScreen} options={{ title: '개인 연습' }} />
      <BandsStack.Screen name="SongPracticeDetail" component={SongPracticeDetailScreen} options={{ title: '연습 메인' }} />
      <BandsStack.Screen name="CreatePracticeAssignment" component={CreatePracticeAssignmentScreen} options={{ title: '연습 과제 만들기' }} />
      <BandsStack.Screen name="PracticeAssignmentDetail" component={PracticeAssignmentDetailScreen} options={{ title: '연습 상세' }} />
      <BandsStack.Screen name="ScheduleEdit" component={ScheduleEditScreen} options={{ title: '시간 맞추기' }} />
      <BandsStack.Screen name="CreateScheduleSlot" component={CreateScheduleSlotScreen} options={{ title: '합주 일정 등록' }} />
      <BandsStack.Screen name="Studios" component={StudioRegisterScreen} options={{ title: '합주실 등록', animation: 'none' }} />
      <BandsStack.Screen name="Settlement" component={FastSettlementScreen} options={{ title: '정산', animation: 'none' }} />
      <BandsStack.Screen name="SettlementDetail" component={SettlementDetailScreen} options={{ title: '정산 상세' }} />
      <BandsStack.Screen name="SettlementHistory" component={SettlementHistoryScreen} options={{ title: '완료된 정산' }} />
      <BandsStack.Screen name="CreateStudioCandidate" component={CreateStudioCandidateScreen} options={{ title: '합주실 후보 추가' }} />
    </BandsStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ ...stackOptions, headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: '로그인' }} />
      <AuthStack.Screen name="Signup" component={SignupScreen} options={{ title: '회원가입' }} />
    </AuthStack.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  const { currentBand, setCurrentBand } = useCurrentBand();
  const [navigationReady, setNavigationReady] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [pendingPracticeFeedback, setPendingPracticeFeedback] = useState<PendingPracticeFeedback | null>(null);

  useEffect(() => {
    const handleInviteUrl = (url: string | null) => {
      const inviteCode = getInviteCodeFromUrl(url);
      if (inviteCode) {
        setPendingInviteCode(inviteCode);
      }
    };

    void Linking.getInitialURL().then(handleInviteUrl);
    const subscription = Linking.addEventListener('url', (event) => handleInviteUrl(event.url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    let removeListener: (() => void) | undefined;
    const handleResponse = (response: { notification: { request: { content: { data: Record<string, unknown> } } } }) => {
      const data = response.notification.request.content.data;
      if (data.type === 'practice_feedback' && typeof data.bandId === 'string' && typeof data.assignmentId === 'string') {
        setPendingPracticeFeedback({ bandId: data.bandId, assignmentId: data.assignmentId });
      }
    };

    void import('expo-notifications').then(async (Notifications) => {
      if (!mounted) {
        return;
      }
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        handleResponse(lastResponse);
        await Notifications.clearLastNotificationResponseAsync();
      }
      const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      removeListener = () => subscription.remove();
    }).catch((error) => console.warn('Failed to register notification navigation', error));

    return () => {
      mounted = false;
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    if (user && navigationReady && pendingInviteCode && navigationRef.isReady()) {
      navigationRef.navigate('JoinBand', { inviteCode: pendingInviteCode });
      setPendingInviteCode(null);
    }
  }, [navigationReady, pendingInviteCode, user]);

  useEffect(() => {
    if (!user || !navigationReady || !pendingPracticeFeedback || !navigationRef.isReady()) {
      return;
    }

    let cancelled = false;
    const openFeedback = async () => {
      if (currentBand?.id !== pendingPracticeFeedback.bandId) {
        try {
          const bands = await api.get<BandSummary[]>('/bands');
          const targetBand = bands.find((band) => band.id === pendingPracticeFeedback.bandId);
          if (targetBand && !cancelled) {
            setCurrentBand(targetBand);
          }
        } catch (error) {
          console.warn('Failed to load band for feedback notification', error);
        }
      }
      if (!cancelled && navigationRef.isReady()) {
        navigationRef.navigate('PracticeAssignmentDetail', pendingPracticeFeedback);
        setPendingPracticeFeedback(null);
      }
    };

    void openFeedback();
    return () => {
      cancelled = true;
    };
  }, [currentBand?.id, navigationReady, pendingPracticeFeedback, setCurrentBand, user]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={() => setNavigationReady(true)}>
      {user ? <BandsNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

function getInviteCodeFromUrl(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const pathParts = [parsed.hostname, ...parsed.pathname.split('/')].filter(Boolean);
    const joinIndex = pathParts.findIndex((part) => part.toLowerCase() === 'join');
    const inviteCode = joinIndex >= 0
      ? pathParts[joinIndex + 1]
      : parsed.searchParams.get('inviteCode');

    return inviteCode ? decodeURIComponent(inviteCode).trim().toUpperCase() : null;
  } catch {
    return null;
  }
}
