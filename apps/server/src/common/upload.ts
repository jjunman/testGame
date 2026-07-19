import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';

export const uploadDirectory = resolve(process.env.UPLOAD_DIR?.trim() || 'uploads');

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const audioMimeTypes = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
]);

function storage() {
  return diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  });
}

function filter(allowed: Set<string>, label: string) {
  return (_req: Express.Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    if (!allowed.has(file.mimetype.toLowerCase())) {
      callback(new BadRequestException(`지원하지 않는 ${label} 파일 형식입니다.`), false);
      return;
    }
    callback(null, true);
  };
}

export const imageUploadOptions = {
  storage: storage(),
  fileFilter: filter(imageMimeTypes, '이미지'),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
};

export const audioUploadOptions = {
  storage: storage(),
  fileFilter: filter(audioMimeTypes, '오디오'),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
};
