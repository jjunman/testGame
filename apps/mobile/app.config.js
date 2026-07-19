const appJson = require('./app.json');

const googleMapsApiKey = (
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  ''
).trim();

module.exports = () => {
  const expo = appJson.expo;
  const android = expo.android || {};
  const androidConfig = android.config || {};

  return {
    expo: {
      ...expo,
      android: {
        ...android,
        config: googleMapsApiKey
          ? {
              ...androidConfig,
              googleMaps: {
                ...(androidConfig.googleMaps || {}),
                apiKey: googleMapsApiKey,
              },
            }
          : androidConfig,
      },
      extra: {
        ...(expo.extra || {}),
        googleMapsApiKeyConfigured: Boolean(googleMapsApiKey),
      },
    },
  };
};
