import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { RecruiterService } from '../services/recruiter.service';
import { EvaluateCandidateDto } from '../../../common/dto/evaluate-candidate.dto';
import { CompareCandidatesDto, InterviewQuestionsDto, FeedbackDto } from '../../../common/dto/job-description.dto';

@Controller('recruiter')
export class RecruiterController {
  constructor(private readonly recruiterService: RecruiterService) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('cv', { storage: undefined, limits: { fileSize: 10 * 1024 * 1024 } }))
  async evaluateCandidate(
    @UploadedFile() file: Express.Multer.File,
    @Body('jobDescription') jobDescription: string,
    @Body('jobTitle') jobTitle?: string,
    @Body('llmProvider') llmProvider?: string,
  ) {
    if (!file) {
      throw new BadRequestException('CV file is required');
    }

    if (!jobDescription) {
      throw new BadRequestException('Job description is required');
    }

    const result = await this.recruiterService.evaluateCandidate(
      file.buffer,
      jobDescription,
      jobTitle,
      llmProvider,
    );

    return result;
  }

  @Post('evaluate-batch')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('cvs', 10, { storage: undefined, limits: { fileSize: 10 * 1024 * 1024 } }))
  async evaluateBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('jobDescription') jobDescription: string,
    @Body('jobTitle') jobTitle?: string,
    @Body('llmProvider') llmProvider?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one CV file is required');
    }

    if (!jobDescription) {
      throw new BadRequestException('Job description is required');
    }

    const buffers = files.map(f => f.buffer);
    const result = await this.recruiterService.evaluateBatch(
      buffers,
      jobDescription,
      jobTitle,
      llmProvider,
    );

    return result;
  }

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string) {
    const status = this.recruiterService.getJobStatus(jobId);
    if (!status) {
      return { message: 'Job not found', jobId };
    }
    return status;
  }

  @Post('compare')
  @HttpCode(HttpStatus.OK)
  async compareCandidates(@Body() dto: CompareCandidatesDto) {
    // In production, would fetch evaluations by IDs
    // For now, return a placeholder
    return {
      message: 'Comparison endpoint ready',
      candidateIds: dto.candidateIds,
    };
  }

  @Post('interview-questions')
  @HttpCode(HttpStatus.OK)
  async generateInterviewQuestions(@Body() dto: InterviewQuestionsDto) {
    // Placeholder - would use LLM to generate questions
    return {
      questions: [
        'Tell me about your experience with the main technologies listed in the job description.',
        'Can you describe a challenging project you worked on and how you overcame obstacles?',
        'How do you stay updated with new technologies and industry trends?',
      ],
      candidateId: dto.candidateId,
    };
  }

  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  async generateFeedback(@Body() dto: FeedbackDto) {
    // Placeholder - would use LLM to generate feedback
    return {
      feedback: 'Thank you for your application. We appreciate your interest in the position.',
      candidateId: dto.candidateId,
    };
  }
}
