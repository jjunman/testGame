export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'development-secret',
  databaseUrl: process.env.DATABASE_URL ?? '',
  uploadBaseUrl: process.env.UPLOAD_BASE_URL ?? 'http://localhost:4000',
});
