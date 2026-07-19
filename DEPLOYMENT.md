# 친구 테스트용 배포 가이드

## 1. Railway

저장소 루트를 Railway 서비스에 연결합니다. `railway.json`이 서버 빌드, 시작 명령과 `/health` 검사를 설정합니다.

Railway 프로젝트에 PostgreSQL을 추가하고 서버 서비스에 다음 변수를 설정합니다.

```env
NODE_ENV=production
JWT_SECRET=32자 이상의 무작위 문자열
DATABASE_URL=${{Postgres.DATABASE_URL}}
UPLOAD_BASE_URL=https://발급받은-도메인.up.railway.app
UPLOAD_DIR=/data/uploads
DB_SYNCHRONIZE=true
```

`PORT`는 Railway가 자동으로 제공합니다.

서버 서비스에 Volume을 추가하고 마운트 경로를 `/data`로 설정합니다. 이 설정이 없으면 이미지와 녹음 파일이 재배포 때 사라집니다.

첫 배포 후 아래 주소에서 HTTP 200 응답을 확인합니다.

```text
https://발급받은-도메인.up.railway.app/health
```

이 프로젝트는 아직 DB migration 대신 TypeORM 동기화를 사용합니다. 소수 친구와 새 DB로 시작하는 현재 단계에서는 `DB_SYNCHRONIZE=true`가 필요합니다. 실제 사용자 데이터가 쌓인 뒤 엔티티 구조를 변경하기 전에는 migration을 먼저 도입해야 합니다.

## 2. EAS Preview APK

`apps/mobile`에서 실행합니다.

```powershell
cd apps/mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value https://발급받은-도메인.up.railway.app --visibility plaintext
npx eas-cli build --platform android --profile preview
```

빌드가 끝나면 EAS 설치 링크를 친구에게 공유합니다. Android에서 출처를 알 수 없는 앱 설치 허용이 한 번 필요할 수 있습니다.

## 3. 배포 전 확인

- Railway Volume 마운트가 `/data`인지 확인
- 회원가입, 로그인, 밴드 생성과 초대코드 가입 확인
- 이미지 및 녹음 업로드 후 서버 재배포하고 파일 유지 여부 확인
- 두 대 이상의 실제 Android 기기에서 투표, 일정, 정산 동기화 확인
- 알림을 사용할 경우 EAS 프로젝트의 Android FCM V1 자격 증명 설정
- `.env`, 로컬 PostgreSQL 데이터, 녹음 파일이 Git에 포함되지 않았는지 확인

