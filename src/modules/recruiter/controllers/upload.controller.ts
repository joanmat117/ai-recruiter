import { Controller, Post, Body, BadRequestException, Inject } from '@nestjs/common';
import type { IFileStorage } from '../interfaces/file-storage.interface';
import { FILE_STORAGE } from '../interfaces/file-storage.interface';
import { randomUUID } from 'crypto';

@Controller('recruiter')
export class UploadController {
  constructor(@Inject(FILE_STORAGE) private readonly fileStorage: IFileStorage) {}

  @Post('upload/presigned')
  async getPresignedPost(
    @Body('filename') filename: string,
    @Body('contentType') contentType: string,
  ) {
    if (contentType !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }
    const key = `cvs/${randomUUID()}.pdf`;
    const presigned = await this.fileStorage.getPresignedPOST(key, { expirySeconds: 3600 });
    return { url: presigned.url, fields: presigned.fields, key, expiresIn: 3600 };
  }
}