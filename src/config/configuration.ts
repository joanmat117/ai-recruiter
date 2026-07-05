import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  cors: process.env.NODE_ENV === 'development',
  nodeEnv: process.env.NODE_ENV || 'development',
}));
