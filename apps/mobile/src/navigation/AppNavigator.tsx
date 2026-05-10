import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getFocusedRouteNameFromRoute, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { BandListScreen } from '../screens/bands/BandListScreen';
import { CreateBandScreen } from '../screens/bands/CreateBandScreen';
import { JoinBandScreen } from '../screens/bands/JoinBandScreen';
import { BandHomeScreen } from '../screens/bands/BandHomeScreen';
import { VoteHubScreen } from '../screens/bands/VoteHubScreen';
import { BandMembersScreen } from '../screens/bands/BandMembersScreen';
import { SongRoundScreen } from '../screens/bands/SongRoundScreen';
import { AddSongCandidateScreen } from '../screens/bands/AddSongCandidateScreen';
import { PracticeAssignmentListScreen } from '../screens/bands/PracticeAssignmentListScreen';
import { CreatePracticeAssignmentScreen } from '../screens/bands/CreatePracticeAssignmentScreen';
import { PracticeAssignmentDetailScreen } from '../screens/bands/PracticeAssignmentDetailScreen';
import { ScheduleScreen } from '../screens/bands/ScheduleScreen';
import { ScheduleEditScreen } from '../screens/bands/ScheduleEditScreen';
import { CreateScheduleSlotScreen } from '../screens/bands/CreateScheduleSlotScreen';
import { StudioScreen } from '../screens/bands/StudioScreen';
import { CreateStudioCandidateScreen } from '../screens/bands/CreateStudioCandidateScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { AuthStackParamList, BandsStackParamList, MainTabParamList } from '../types/navigation';
import { theme } from '../constants/theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const BandsStack = createNativeStackNavigator<BandsStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const stackOptions = {
  headerStyle: {
    backgroundColor: theme.colors.background,
  },
  headerShadowVisible: false,
  headerTitleStyle: {
    color: theme.colors.primaryDark,
    fontWeight: '800' as const,
  },
  contentStyle: {
    backgroundColor: theme.colors.background,
  },
};

function BandsNavigator() {
  return (
    <BandsStack.Navigator screenOptions={stackOptions}>
      <BandsStack.Screen name="BandList" component={BandListScreen} options={{ title: '내 밴드' }} />
      <BandsStack.Screen name="JoinBand" component={JoinBandScreen} options={{ title: '밴드 추가하기' }} />
      <BandsStack.Screen name="CreateBand" component={CreateBandScreen} options={{ title: '밴드 만들기' }} />
      <BandsStack.Screen name="BandHome" component={BandHomeScreen} options={{ title: '밴드 홈', animation: 'none' }} />
      <BandsStack.Screen name="VoteHub" component={VoteHubScreen} options={{ title: '투표 모아보기', animation: 'none' }} />
      <BandsStack.Screen name="BandMembers" component={BandMembersScreen} options={{ title: '멤버 / 포인트', animation: 'none' }} />
      <BandsStack.Screen name="SongRound" component={SongRoundScreen} options={{ title: '합주곡 정하기', animation: 'none' }} />
      <BandsStack.Screen name="AddSongCandidate" component={AddSongCandidateScreen} options={{ title: '곡 추가하기' }} />
      <BandsStack.Screen name="PracticeAssignments" component={PracticeAssignmentListScreen} options={{ title: '개인 연습' }} />
      <BandsStack.Screen name="CreatePracticeAssignment" component={CreatePracticeAssignmentScreen} options={{ title: '연습 과제 만들기' }} />
      <BandsStack.Screen name="PracticeAssignmentDetail" component={PracticeAssignmentDetailScreen} options={{ title: '연습 상세' }} />
      <BandsStack.Screen name="Schedule" component={ScheduleScreen} options={{ title: '합주 스케줄러', animation: 'none' }} />
      <BandsStack.Screen name="ScheduleEdit" component={ScheduleEditScreen} options={{ title: '시간 맞추기' }} />
      <BandsStack.Screen name="CreateScheduleSlot" component={CreateScheduleSlotScreen} options={{ title: '합주 시간 제안' }} />
      <BandsStack.Screen name="Studios" component={StudioScreen} options={{ title: '합주실 정하기' }} />
      <BandsStack.Screen name="CreateStudioCandidate" component={CreateStudioCandidateScreen} options={{ title: '합주실 후보 추가' }} />
    </BandsStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={stackOptions}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: '로그인' }} />
      <AuthStack.Screen name="Signup" component={SignupScreen} options={{ title: '회원가입' }} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#9e96c8',
        tabBarStyle:
          route.name === 'UserTab' ||
          (route.name === 'BandsTab' && !['JoinBand', 'CreateBand'].includes(getFocusedRouteNameFromRoute(route) ?? 'BandList'))
            ? { display: 'none' }
            : {
                height: 72,
                backgroundColor: '#e7ddff',
                borderTopWidth: 0,
                paddingTop: 10,
                paddingBottom: 10,
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 16,
                borderRadius: 22,
              },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size, focused }) => {
          if (route.name === 'BandsTab') {
            return <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />;
          }

          return <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="BandsTab" component={BandsNavigator} options={{ title: '홈' }} />
      <Tabs.Screen name="UserTab" component={ProfileScreen} options={{ title: '유저' }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <NavigationContainer>{user ? <MainTabs /> : <AuthNavigator />}</NavigationContainer>;
}
