import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gammbler',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || '',
  STRIPE_VERIFIED_PASS_PRICE_ID: process.env.STRIPE_VERIFIED_PASS_PRICE_ID || '',
  VERIFIED_PASS_PRICE_CENTS: parseInt(process.env.VERIFIED_PASS_PRICE_CENTS || '499', 10),
  PRO_PRICE_CENTS: parseInt(process.env.PRO_PRICE_CENTS || '899', 10),
  SHARPSPORTS_API_KEY: process.env.SHARPSPORTS_API_KEY || '',
  SHARPSPORTS_WEBHOOK_SECRET: process.env.SHARPSPORTS_WEBHOOK_SECRET || '',
  ODDS_API_KEY: process.env.ODDS_API_KEY || '',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@gammbler.com',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
  VAPID_EMAIL: process.env.VAPID_EMAIL || 'mailto:noreply@gammbler.com',
};
