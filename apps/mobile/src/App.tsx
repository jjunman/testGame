import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './store/AuthContext';
import { CurrentBandProvider } from './store/CurrentBandContext';
import { AppNavigator } from './navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <CurrentBandProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </CurrentBandProvider>
    </AuthProvider>
  );
}
