export default () => {
  const production = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET?.trim() || 'development-secret';
  const databaseUrl = process.env.DATABASE_URL?.trim() || '';
  const uploadBaseUrl = process.env.UPLOAD_BASE_URL?.trim() || 'http://localhost:4000';
  const androidFingerprints = (process.env.APP_LINK_ANDROID_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (production && jwtSecret.length < 32) {
    throw new Error('운영 환경의 JWT_SECRET은 32자 이상이어야 합니다.');
  }
  if (production && !databaseUrl) {
    throw new Error('운영 환경에는 DATABASE_URL이 필요합니다.');
  }
  if (production && !uploadBaseUrl.startsWith('https://')) {
    throw new Error('운영 환경의 UPLOAD_BASE_URL은 HTTPS 주소여야 합니다.');
  }

  return {
    port: parseInt(process.env.PORT ?? '4000', 10),
    jwtSecret,
    databaseUrl,
    uploadBaseUrl: uploadBaseUrl.replace(/\/$/, ''),
    appLinkAndroidPackageName: process.env.APP_LINK_ANDROID_PACKAGE_NAME?.trim() || 'com.jjunm.bandmanagement',
    appLinkAndroidFingerprints: androidFingerprints,
    appLinkAppleTeamId: process.env.APP_LINK_APPLE_TEAM_ID?.trim() || '',
    appLinkAppleBundleId: process.env.APP_LINK_APPLE_BUNDLE_ID?.trim() || '',
    appLinkStoreUrl: process.env.APP_LINK_STORE_URL?.trim() || '',
    uploadDir: process.env.UPLOAD_DIR?.trim() || 'uploads',
    databaseSynchronize: process.env.DB_SYNCHRONIZE
      ? process.env.DB_SYNCHRONIZE === 'true'
      : !production,
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
};
