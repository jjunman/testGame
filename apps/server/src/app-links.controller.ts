import { Controller, Get, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Controller()
export class AppLinksController {
  constructor(private readonly configService: ConfigService) {}

  @Get('.well-known/assetlinks.json')
  assetLinks(@Res() res: Response) {
    const packageName = this.configService.get<string>('appLinkAndroidPackageName');
    const fingerprints = this.configService.get<string[]>('appLinkAndroidFingerprints') ?? [];

    res.type('application/json').send(
      fingerprints.length > 0
        ? [
            {
              relation: ['delegate_permission/common.handle_all_urls'],
              target: {
                namespace: 'android_app',
                package_name: packageName,
                sha256_cert_fingerprints: fingerprints,
              },
            },
          ]
        : [],
    );
  }

  @Get(['apple-app-site-association', '.well-known/apple-app-site-association'])
  appleAppSiteAssociation(@Res() res: Response) {
    const teamId = this.configService.get<string>('appLinkAppleTeamId');
    const bundleId = this.configService.get<string>('appLinkAppleBundleId');
    const appId = teamId && bundleId ? `${teamId}.${bundleId}` : null;

    res.type('application/json').send({
      applinks: {
        apps: [],
        details: appId
          ? [
              {
                appIDs: [appId],
                components: [
                  {
                    '/': '/join/*',
                  },
                ],
              },
            ]
          : [],
      },
    });
  }

  @Get('join/:inviteCode')
  inviteFallback(@Param('inviteCode') inviteCode: string, @Res() res: Response) {
    const safeInviteCode = encodeURIComponent(inviteCode.trim());
    const appLink = `bandmanagement://join/${safeInviteCode}`;
    const appStoreUrl = this.configService.get<string>('appLinkStoreUrl');

    res.type('html').send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>밴드 초대</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8f5ff; color: #211b2f; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      section { width: min(420px, 100%); background: #fff; border: 1px solid #e4def2; border-radius: 14px; padding: 26px; box-sizing: border-box; }
      h1 { margin: 0 0 10px; font-size: 22px; }
      p { margin: 0 0 18px; color: #665c76; line-height: 1.55; }
      strong { display: block; padding: 12px 14px; border-radius: 10px; background: #f1ebff; color: #5b35c8; letter-spacing: 0.08em; }
      a { display: block; margin-top: 16px; border-radius: 10px; background: #6b45d8; color: #fff; text-align: center; padding: 13px 16px; text-decoration: none; font-weight: 800; }
    </style>
    <script>
      window.location.href = ${JSON.stringify(appLink)};
    </script>
  </head>
  <body>
    <main>
      <section>
        <h1>밴드 초대가 도착했어요</h1>
        <p>앱이 자동으로 열리지 않으면 아래 버튼을 눌러주세요.</p>
        <strong>${escapeHtml(inviteCode.trim())}</strong>
        <a href="${appLink}">앱에서 열기</a>
        ${appStoreUrl ? `<a href="${escapeHtml(appStoreUrl)}">앱 설치하기</a>` : ''}
      </section>
    </main>
  </body>
</html>`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
