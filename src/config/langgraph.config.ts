import { registerAs } from '@nestjs/config';

export default registerAs('langgraph', () => ({
  chromaDbUrl: process.env.CHROMA_DB_URL || 'http://localhost:8000',
  chromaCollection: process.env.CHROMA_COLLECTION || 'recruiter_embeddings',
}));
