import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto, SavePushTokenDto, SignupDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('signup')
  signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    res.locals.message = '회원가입에 성공했습니다.';
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    res.locals.message = '로그인에 성공했습니다.';
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(
    @CurrentUser() user: { userId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '현재 사용자 정보를 불러왔습니다.';
    return this.authService.me(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-token')
  async savePushToken(
    @CurrentUser() user: { userId: string },
    @Body() dto: SavePushTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '푸시 알림 기기를 저장했습니다.';
    await this.usersService.savePushToken(user.userId, dto.token, dto.platform);
    return { saved: true };
  }
}
