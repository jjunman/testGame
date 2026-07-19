import Constants from 'expo-constants';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

export const mapsEnabled =
  Constants.appOwnership === 'expo' ||
  Boolean(googleMapsApiKey) ||
  Boolean(Constants.expoConfig?.extra?.googleMapsApiKeyConfigured);
