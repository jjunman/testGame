import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreatePracticeAssignmentDto, CreatePracticeFeedbackDto, UpdatePracticeFeedbackDto } from './dto';
import { PracticeService } from './practice.service';
import { audioUploadOptions } from '../common/upload';

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
    FileInterceptor('audio', audioUploadOptions),
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

  @Get('practice-assignments/:assignmentId/feedback')
  feedback(
    @CurrentUser() user: { userId: string },
    @Param('assignmentId') assignmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '연습 피드백을 불러왔습니다.';
    return this.practiceService.getFeedback(user.userId, assignmentId);
  }

  @Post('practice-submissions/:submissionId/feedback')
  createFeedback(
    @CurrentUser() user: { userId: string },
    @Param('submissionId') submissionId: string,
    @Body() dto: CreatePracticeFeedbackDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '피드백을 남겼습니다.';
    return this.practiceService.createFeedback(user.userId, submissionId, dto);
  }

  @Patch('practice-feedback/:feedbackId')
  updateFeedback(
    @CurrentUser() user: { userId: string },
    @Param('feedbackId') feedbackId: string,
    @Body() dto: UpdatePracticeFeedbackDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '피드백을 수정했습니다.';
    return this.practiceService.updateFeedback(user.userId, feedbackId, dto);
  }

  @Delete('practice-feedback/:feedbackId')
  deleteFeedback(
    @CurrentUser() user: { userId: string },
    @Param('feedbackId') feedbackId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '피드백을 삭제했습니다.';
    return this.practiceService.deleteFeedback(user.userId, feedbackId);
  }

  @Post('practice-feedback/:feedbackId/acknowledge')
  acknowledgeFeedback(
    @CurrentUser() user: { userId: string },
    @Param('feedbackId') feedbackId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '피드백을 확인했습니다.';
    return this.practiceService.acknowledgeFeedback(user.userId, feedbackId);
  }
}
