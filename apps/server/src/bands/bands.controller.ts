import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { BandsService } from './bands.service';
import { CreateBandDto, JoinBandDto, TransferLeaderDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('bands')
export class BandsController {
  constructor(
    private readonly bandsService: BandsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  list(@CurrentUser() user: { userId: string }, @Res({ passthrough: true }) res: Response) {
    res.locals.message = '내 밴드 목록을 불러왔습니다.';
    return this.bandsService.listBands(user.userId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('thumbnail', {
      storage: diskStorage({
        destination: 'uploads',
        filename: (_req, file, callback) => {
          const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extname(file.originalname)}`;
          callback(null, name);
        },
      }),
    }),
  )
  async create(
    @CurrentUser() currentUser: { userId: string },
    @Body() dto: CreateBandDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.usersService.findById(currentUser.userId);
    res.locals.message = '밴드를 만들었습니다.';
    const baseUrl = this.configService.get<string>('uploadBaseUrl') ?? `${req.protocol}://${req.get('host')}`;
    const thumbnailUrl = file ? `${baseUrl}/uploads/${file.filename}` : dto.thumbnailUrl;
    return this.bandsService.createBand(user!, dto, thumbnailUrl);
  }

  @Post('join')
  async join(
    @CurrentUser() currentUser: { userId: string },
    @Body() dto: JoinBandDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.usersService.findById(currentUser.userId);
    res.locals.message = '밴드에 가입했습니다.';
    return this.bandsService.joinBand(user!, dto);
  }

  @Delete(':bandId/membership')
  leave(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '밴드에서 탈퇴했습니다.';
    return this.bandsService.leaveBand(user.userId, bandId);
  }

  @Delete(':bandId')
  remove(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '밴드를 삭제했습니다.';
    return this.bandsService.deleteBand(user.userId, bandId);
  }

  @Patch(':bandId/leader')
  transferLeader(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: TransferLeaderDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '리더 권한을 변경했습니다.';
    return this.bandsService.transferLeader(user.userId, bandId, dto.targetUserId);
  }

  @Get(':bandId')
  detail(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '밴드 정보를 불러왔습니다.';
    return this.bandsService.getBandDetail(user.userId, bandId);
  }

  @Get(':bandId/members')
  members(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '밴드 멤버 목록을 불러왔습니다.';
    return this.bandsService.getMembers(user.userId, bandId);
  }

  @Get(':bandId/points')
  points(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '볼륨 포인트를 불러왔습니다.';
    return this.bandsService.getPoints(user.userId, bandId);
  }

  @Get(':bandId/todos')
  todos(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '할 일 목록을 불러왔습니다.';
    return this.bandsService.getTodos(user.userId, bandId);
  }
}
