import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware } from '../middleware/auth';
import { TRIAL_DAYS } from '@gammbler/shared';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  tos_accepted: z.boolean().refine((v) => v === true, { message: 'You must accept the Terms of Service' }),
  referral_code: z.string().optional(),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/signup
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = signupSchema.parse(req.body);

    // Check existing email
    const existingEmail = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (existingEmail.length > 0) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    // Check existing username
    const existingUsername = await db.select().from(users).where(eq(users.username, body.username)).limit(1);
    if (existingUsername.length > 0) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    // Handle referral bonus
    let referredBy: string | undefined;
    if (body.referral_code) {
      const referrer = await db.select().from(users).where(eq(users.referral_code, body.referral_code)).limit(1);
      if (referrer.length > 0) {
        referredBy = referrer[0].id;
        // Add bonus days to both
        trialEndsAt.setDate(trialEndsAt.getDate() + 3);
        const referrerTrialEnd = new Date(referrer[0].trial_ends_at);
        referrerTrialEnd.setDate(referrerTrialEnd.getDate() + 3);
        await db.update(users).set({ trial_ends_at: referrerTrialEnd }).where(eq(users.id, referrer[0].id));
      }
    }

    const referralCode = uuidv4().slice(0, 8).toUpperCase();

    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        password_hash: passwordHash,
        username: body.username,
        trial_ends_at: trialEndsAt,
        tos_accepted_at: new Date(),
        referral_code: referralCode,
        referred_by: referredBy,
      })
      .returning();

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        trial_ends_at: user.trial_ends_at,
        subscription_status: user.subscription_status,
        referral_code: user.referral_code,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/signin
router.post('/signin', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = signinSchema.parse(req.body);

    const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(body.password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        trial_ends_at: user.trial_ends_at,
        subscription_status: user.subscription_status,
        referral_code: user.referral_code,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        avatar_url: users.avatar_url,
        created_at: users.created_at,
        trial_ends_at: users.trial_ends_at,
        subscription_status: users.subscription_status,
        is_profile_public: users.is_profile_public,
        referral_code: users.referral_code,
        notification_preferences: users.notification_preferences,
      })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/check-username
router.post('/check-username', async (req: Request, res: Response): Promise<void> => {
  const { username } = req.body;
  if (!username || username.length < 3) {
    res.json({ available: false, reason: 'Username must be at least 3 characters' });
    return;
  }

  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  res.json({ available: existing.length === 0 });
});

export default router;
