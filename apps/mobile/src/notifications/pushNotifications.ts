import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '../api/client';

let notificationHandlerReady = false;

export async function registerForPushNotificationsAsync() {
  try {
    if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
      console.warn('Android Expo Go does not support remote push notifications. Skipping push registration.');
      return null;
    }

    if (!Device.isDevice) {
      return null;
    }

    const Notifications = await import('expo-notifications');
    if (!notificationHandlerReady) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      notificationHandlerReady = true;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const currentPermission = await Notifications.getPermissionsAsync();
    let status = currentPermission.status;
    if (status !== 'granted') {
      const requestedPermission = await Notifications.requestPermissionsAsync();
      status = requestedPermission.status;
    }

    if (status !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    await api.post('/auth/push-token', { token, platform: Platform.OS });
    return token;
  } catch (error) {
    console.warn('Failed to register push notifications', error);
    return null;
  }
}
