export class S3Key {
  private constructor(public readonly value: string) {}

  static from(raw: string): S3Key {
    if (!raw || !raw.startsWith('cvs/') || !raw.endsWith('.pdf')) {
      throw new Error(`Invalid S3Key format: ${raw}. Expected: cvs/<uuid>.pdf`);
    }
    return new S3Key(raw);
  }
}

export class JobDescription {
  private constructor(public readonly value: string) {}

  static from(raw: string): JobDescription {
    const trimmed = raw.trim();
    if (trimmed.length < 50) {
      throw new Error('JobDescription must be at least 50 characters');
    }
    return new JobDescription(trimmed);
  }
}

export class JobTitle {
  private constructor(public readonly value: string) {}

  static from(raw: string): JobTitle {
    return new JobTitle(raw.trim() || 'Untitled Position');
  }
}

export class EvaluationRequest {
  private constructor(
    public readonly s3Key: S3Key,
    public readonly jobDescription: JobDescription,
    public readonly jobTitle: JobTitle
  ) {}

  static from(dto: { s3Key: string; jobDescription: string; jobTitle?: string }): EvaluationRequest {
    return new EvaluationRequest(
      S3Key.from(dto.s3Key),
      JobDescription.from(dto.jobDescription),
      dto.jobTitle ? JobTitle.from(dto.jobTitle) : JobTitle.from('Untitled Position')
    );
  }
}