import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { Repository } from 'typeorm';
import { BandsService } from '../bands/bands.service';
import { PracticeAssignmentStatus, PracticeSubmissionStatus } from '../common/enums';
import { PointsService } from '../points/points.service';
import { SongCandidate } from '../songs/song-candidate.entity';
import { UsersService } from '../users/users.service';
import { CreatePracticeAssignmentDto } from './dto';
import { PracticeAssignment } from './practice-assignment.entity';
import { PracticeSubmission } from './practice-submission.entity';

const execFileAsync = promisify(execFile);

@Injectable()
export class PracticeService {
  constructor(
    @InjectRepository(PracticeAssignment)
    private readonly assignmentsRepository: Repository<PracticeAssignment>,
    @InjectRepository(PracticeSubmission)
    private readonly submissionsRepository: Repository<PracticeSubmission>,
    @InjectRepository(SongCandidate)
    private readonly candidatesRepository: Repository<SongCandidate>,
    private readonly bandsService: BandsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly pointsService: PointsService,
  ) {}

  async listAssignments(userId: string, bandId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const items = await this.assignmentsRepository.find({
      where: { band: { id: bandId } },
      relations: ['submissions', 'submissions.user', 'songCandidate', 'songCandidate.songCatalog'],
      order: { dueAt: 'ASC' },
    });

    await Promise.all(items.map((assignment) => this.settleMissedPracticePoint(userId, assignment)));

    return items.map((assignment) => ({
      id: assignment.id,
      bandId,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueAt.toISOString(),
      status: assignment.status,
      startSec: assignment.startSec,
      endSec: assignment.endSec,
      hasSubmitted: assignment.submissions?.some((item) => item.user.id === userId) ?? false,
      songTitle: assignment.songCandidate?.songCatalog?.title ?? null,
    }));
  }

  async createAssignment(userId: string, bandId: string, dto: CreatePracticeAssignmentDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const songCandidate = dto.songCandidateId
      ? await this.candidatesRepository.findOne({
          where: { id: dto.songCandidateId },
          relations: ['round', 'round.band'],
        })
      : null;

    if (dto.songCandidateId && (!songCandidate || songCandidate.round.band.id !== bandId)) {
      throw new NotFoundException('연결할 합주곡을 찾을 수 없습니다.');
    }

    return this.assignmentsRepository.save(
      this.assignmentsRepository.create({
        band: membership.band,
        songCandidate,
        title: dto.title,
        description: dto.description ?? null,
        startSec: dto.startSec ?? null,
        endSec: dto.endSec ?? null,
        dueAt: new Date(dto.dueAt),
        status: PracticeAssignmentStatus.OPEN,
        createdByUser: membership.user,
      }),
    );
  }

  async getAssignmentDetail(userId: string, assignmentId: string) {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: ['band', 'songCandidate', 'songCandidate.songCatalog', 'submissions', 'submissions.user'],
    });
    if (!assignment) {
      throw new NotFoundException('연습 과제를 찾을 수 없습니다.');
    }

    const membership = await this.bandsService.requireMembership(userId, assignment.band.id);
    await this.settleMissedPracticePoint(userId, assignment);
    const mySubmission = assignment.submissions?.find((item) => item.user.id === userId) ?? null;
    const pointStatus = await this.pointsService.getPracticePointStatus(assignment.band.id, userId, assignmentId);
    const members = await this.bandsService.getMembers(userId, assignment.band.id);
    await Promise.all(members.map((member) => this.settleMissedPracticePoint(member.userId, assignment)));
    const memberStatuses = await Promise.all(
      members.map(async (member) => {
        const submission = assignment.submissions?.find((item) => item.user.id === member.userId) ?? null;
        const memberPointStatus = await this.pointsService.getPracticePointStatus(assignment.band.id, member.userId, assignmentId);

        return {
          userId: member.userId,
          name: member.name,
          role: member.role,
          submitted: Boolean(submission),
          submittedAt: submission?.submittedAt.toISOString() ?? null,
          pointChange: memberPointStatus.changeAmount,
          currentVolumePoints: memberPointStatus.currentVolumePoints,
        };
      }),
    );

    return {
      id: assignment.id,
      bandId: assignment.band.id,
      title: assignment.title,
      description: assignment.description,
      dueAt: assignment.dueAt.toISOString(),
      status: assignment.status,
      startSec: assignment.startSec,
      endSec: assignment.endSec,
      song: assignment.songCandidate
        ? {
            title: assignment.songCandidate.songCatalog.title,
            artist: assignment.songCandidate.songCatalog.artist,
            youtubeUrl: assignment.songCandidate.songCatalog.youtubeVideoId
              ? `https://www.youtube.com/watch?v=${assignment.songCandidate.songCatalog.youtubeVideoId}`
              : null,
          }
        : null,
      mySubmission: mySubmission
        ? {
            id: mySubmission.id,
            audioUrl: mySubmission.audioUrl,
            submittedAt: mySubmission.submittedAt.toISOString(),
          }
        : null,
      isClosed: assignment.dueAt.getTime() < Date.now(),
      mixAudioUrl: assignment.mixAudioUrl,
      mixGeneratedAt: assignment.mixGeneratedAt?.toISOString() ?? null,
      pointStatus,
      memberStatuses: membership.role === 'leader' ? memberStatuses : [],
    };
  }

  async submit(userId: string, assignmentId: string, file: Express.Multer.File, clientDurationSec?: string) {
    if (!file) {
      throw new BadRequestException('업로드할 오디오 파일이 필요합니다.');
    }

    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: ['band'],
    });
    if (!assignment) {
      throw new NotFoundException('연습 과제를 찾을 수 없습니다.');
    }

    await this.bandsService.requireMembership(userId, assignment.band.id);
    const user = await this.usersService.findById(userId);
    const probedDurationSec = await this.getAudioDurationSec(file.path);
    const parsedClientDurationSec = clientDurationSec ? Number(clientDurationSec) : null;
    const durationSec = probedDurationSec ?? (Number.isFinite(parsedClientDurationSec) ? parsedClientDurationSec : null);
    const requiredSec = this.getRequiredRecordingSec(assignment);
    if (requiredSec !== null && (durationSec === null || durationSec + 0.75 < requiredSec)) {
      await fs.unlink(file.path).catch(() => undefined);
      const actual = durationSec === null ? '확인 불가' : `${Math.floor(durationSec)}초`;
      throw new BadRequestException(`녹음 길이가 부족합니다. 최소 ${requiredSec}초가 필요합니다. 현재 녹음 길이: ${actual}`);
    }
    const audioUrl = `${this.configService.get<string>('uploadBaseUrl')}/uploads/${file.filename}`;
    const existing = await this.submissionsRepository.findOne({
      where: { assignment: { id: assignmentId }, user: { id: userId } },
    });
    const firstSubmission = !existing;

    const saved = await this.submissionsRepository.save(
      this.submissionsRepository.create({
        id: existing?.id,
        assignment,
        user: user!,
        audioUrl,
        durationSec: durationSec === null ? null : Math.round(durationSec),
        status: PracticeSubmissionStatus.SUBMITTED,
      }),
    );

    if (firstSubmission && assignment.dueAt.getTime() >= Date.now()) {
      await this.pointsService.addPracticePoint(assignment.band.id, userId, assignmentId);
    }

    return saved;
  }

  async closeAssignment(userId: string, assignmentId: string) {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: ['band', 'submissions', 'submissions.user'],
    });
    if (!assignment) {
      throw new NotFoundException('연습 과제를 찾을 수 없습니다.');
    }

    await this.bandsService.requireMembership(userId, assignment.band.id);
    assignment.dueAt = new Date(Date.now() - 1000);
    assignment.status = PracticeAssignmentStatus.CLOSED;
    await this.assignmentsRepository.save(assignment);

    const members = await this.bandsService.getMembers(userId, assignment.band.id);
    await Promise.all(members.map((member) => this.settleMissedPracticePoint(member.userId, assignment)));

    return this.getAssignmentDetail(userId, assignmentId);
  }

  async getSubmissions(userId: string, assignmentId: string) {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: ['band'],
    });
    if (!assignment) {
      throw new NotFoundException('연습 과제를 찾을 수 없습니다.');
    }

    const membership = await this.bandsService.requireMembership(userId, assignment.band.id);
    const closed = assignment.dueAt.getTime() < Date.now();
    if (!closed && membership.role !== 'leader') {
      throw new ForbiddenException('마감 전에는 리더만 제출 목록을 볼 수 있습니다.');
    }

    const submissions = await this.submissionsRepository.find({
      where: { assignment: { id: assignmentId } },
      order: { submittedAt: 'ASC' },
    });

    return submissions.map((submission) => ({
      id: submission.id,
      userId: submission.user.id,
      userName: submission.user.name,
      audioUrl: submission.audioUrl,
      submittedAt: submission.submittedAt.toISOString(),
    }));
  }

  async generateMix(userId: string, assignmentId: string) {
    if (!ffmpegPath) {
      throw new BadRequestException('서버에서 오디오 믹싱 도구를 찾을 수 없습니다.');
    }

    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: ['band', 'submissions', 'submissions.user'],
    });
    if (!assignment) {
      throw new NotFoundException('연습 과제를 찾을 수 없습니다.');
    }

    const membership = await this.bandsService.requireMembership(userId, assignment.band.id);
    const closed = assignment.dueAt.getTime() < Date.now();
    if (!closed && membership.role !== 'leader') {
      throw new ForbiddenException('마감 전에는 리더만 믹스를 생성할 수 있습니다.');
    }

    const submissions = assignment.submissions ?? [];
    if (submissions.length === 0) {
      throw new BadRequestException('믹싱할 녹음본이 없습니다.');
    }

    const inputPaths = submissions.map((submission) => this.resolveUploadPath(submission.audioUrl));
    await Promise.all(
      inputPaths.map(async (inputPath) => {
        try {
          await fs.access(inputPath);
        } catch {
          throw new NotFoundException('제출된 녹음 파일을 찾을 수 없습니다.');
        }
      }),
    );

    const mixesDir = path.resolve(process.cwd(), 'uploads', 'mixes');
    await fs.mkdir(mixesDir, { recursive: true });

    const outputName = `${assignment.id}-${Date.now()}.mp3`;
    const outputPath = path.join(mixesDir, outputName);
    const args = [
      '-y',
      ...inputPaths.flatMap((inputPath) => ['-i', inputPath]),
      '-filter_complex',
      `amix=inputs=${inputPaths.length}:duration=longest:dropout_transition=0:normalize=1`,
      '-ac',
      '2',
      '-ar',
      '44100',
      '-b:a',
      '192k',
      outputPath,
    ];

    try {
      await execFileAsync(ffmpegPath, args, { windowsHide: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      throw new BadRequestException(`믹스 파일 생성에 실패했습니다. ${message}`);
    }

    assignment.mixAudioUrl = `${this.configService.get<string>('uploadBaseUrl')}/uploads/mixes/${outputName}`;
    assignment.mixGeneratedAt = new Date();
    await this.assignmentsRepository.save(assignment);

    return {
      assignmentId: assignment.id,
      mixAudioUrl: assignment.mixAudioUrl,
      mixGeneratedAt: assignment.mixGeneratedAt.toISOString(),
      submissionCount: submissions.length,
    };
  }

  private async settleMissedPracticePoint(userId: string, assignment: PracticeAssignment) {
    const closed = assignment.dueAt.getTime() < Date.now();
    const hasSubmitted = assignment.submissions?.some((item) => item.user.id === userId) ?? false;

    if (closed && !hasSubmitted) {
      await this.pointsService.deductPracticePoint(assignment.band.id, userId, assignment.id);
    }
  }

  private getRequiredRecordingSec(assignment: PracticeAssignment) {
    if (assignment.startSec === null || assignment.endSec === null || assignment.endSec <= assignment.startSec) {
      return null;
    }
    return assignment.endSec - assignment.startSec;
  }

  private async getAudioDurationSec(filePath: string) {
    if (!ffmpegPath) {
      return null;
    }
    const ffmpegExecutable = ffmpegPath;

    const output = await new Promise<string>((resolve) => {
      try {
        execFile(ffmpegExecutable, ['-i', filePath], { windowsHide: true, encoding: 'utf8' }, (_error: unknown, stdout: string, stderr: string) => {
          resolve(`${stdout}\n${stderr}`);
        });
      } catch {
        resolve('');
      }
    });
    const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
    if (!match) {
      return null;
    }
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }

  private resolveUploadPath(audioUrl: string) {
    try {
      const parsed = new URL(audioUrl);
      const pathname = decodeURIComponent(parsed.pathname);
      const marker = '/uploads/';
      const index = pathname.indexOf(marker);
      if (index >= 0) {
        return path.resolve(process.cwd(), 'uploads', pathname.slice(index + marker.length));
      }
    } catch {
      // Fall through to legacy relative handling.
    }

    const normalized = audioUrl.replace(/\\/g, '/');
    const marker = '/uploads/';
    const index = normalized.indexOf(marker);
    const relative = index >= 0 ? normalized.slice(index + marker.length) : path.basename(normalized);
    return path.resolve(process.cwd(), 'uploads', relative);
  }
}
