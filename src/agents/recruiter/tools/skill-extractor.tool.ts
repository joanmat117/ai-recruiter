import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../../modules/llm/llm.service';

export interface ExtractedSkills {
  hard: string[];
  soft: string[];
  tools: string[];
}

@Injectable()
export class SkillExtractorTool {
  private readonly logger = new Logger(SkillExtractorTool.name);

  constructor(private readonly llmService: LlmService) {}

  async extractSkills(text: string): Promise<ExtractedSkills> {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided for skill extraction');
      return { hard: [], soft: [], tools: [] };
    }

    try {
      const prompt = `Extract skills from the following CV text. Categorize them into:
- hard: Technical skills (programming languages, frameworks, technologies)
- soft: Soft skills (leadership, communication, teamwork)
- tools: Specific tools and software (IDEs, cloud platforms, databases)

Return as JSON with the structure: { hard: string[], soft: string[], tools: string[] }

CV Text:
${text.substring(0, 4000)}`;

      const result = await this.llmService.generateText(prompt);
      return this.parseSkillsResponse(result.content);
    } catch (error) {
      this.logger.error(`Skill extraction failed: ${error.message}`);
      return { hard: [], soft: [], tools: [] };
    }
  }

  private parseSkillsResponse(response: string): ExtractedSkills {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          hard: Array.isArray(parsed.hard) ? parsed.hard : [],
          soft: Array.isArray(parsed.soft) ? parsed.soft : [],
          tools: Array.isArray(parsed.tools) ? parsed.tools : [],
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to parse skills response: ${error.message}`);
    }
    return { hard: [], soft: [], tools: [] };
  }
}
