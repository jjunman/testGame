import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreatePracticeAssignmentDto } from './dto';
import { PracticeService } from './practice.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Get('bands/:bandId/practice-assignments')
  list(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '연습 과제 목록을 불러왔습니다.';
    return this.practiceService.listAssignments(user.userId, bandId);
  }

  @Post('bands/:bandId/practice-assignments')
  create(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: CreatePracticeAssignmentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '연습 과제를 만들었습니다.';
    return this.practiceService.createAssignment(user.userId, bandId, dto);
  }

  @Get('practice-assignments/:assignmentId')
  detail(
    @CurrentUser() user: { userId: string },
    @Param('assignmentId') assignmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '연습 과제 정보를 불러왔습니다.';
    return this.practiceService.getAssignmentDetail(user.userId, assignmentId);
  }

  @Post('practice-assignments/:assignmentId/submission')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: 'uploads',
        filename: (_req, file, callback) => {
          const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extname(file.originalname)}`;
          callback(null, name);
        },
      }),
    }),
  )
  submit(
    @CurrentUser() user: { userId: string },
    @Param('assignmentId') assignmentId: string,
    @Body('durationSec') durationSec: string | undefined,
    @Body('syncOffsetMs') syncOffsetMs: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '녹음 파일을 제출했습니다.';
    return this.practiceService.submit(user.userId, assignmentId, file, durationSec, syncOffsetMs);
  }

  @Post('practice-assignments/:assignmentId/close')
  close(
    @CurrentUser() user: { userId: string },
    @Param('assignmentId') assignmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '연습 과제를 마감했습니다.';
    return this.practiceService.closeAssignment(user.userId, assignmentId);
  }

  @Get('practice-assignments/:assignmentId/submissions')
  submissions(
    @CurrentUser() user: { userId: string },
    @Param('assignmentId') assignmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '제출 목록을 불러왔습니다.';
    return this.practiceService.getSubmissions(user.userId, assignmentId);
  }

  @Post('practice-assignments/:assignmentId/mix')
  mix(
    @CurrentUser() user: { userId: string },
    @Param('assignmentId') assignmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주 믹스 파일을 생성했습니다.';
    return this.practiceService.generateMix(user.userId, assignmentId);
  }
}
