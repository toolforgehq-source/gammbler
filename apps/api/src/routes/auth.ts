import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware } from '../middleware/auth';
import { getUserTier } from '../middleware/subscription';
import { TRIAL_DAYS } from '@gammbler/shared';
import { v4 as uuidv4 } from 'uuid';
import { sendWelcomeEmail, sendPasswordResetEmail, sendEmailVerificationEmail } from '../services/email';
import crypto from 'crypto';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  tos_accepted: z.boolean().refine((v) => v === true, { message: 'You must accept the Terms of Service' }),
  referral_code: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

function isAtLeast18(dob: string): boolean {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 18;
}

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

    if (!isAtLeast18(body.date_of_birth)) {
      res.status(403).json({ error: 'You must be at least 18 years old to use Gammbler' });
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
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        password_hash: passwordHash,
        username: body.username,
        date_of_birth: body.date_of_birth,
        trial_ends_at: trialEndsAt,
        tos_accepted_at: new Date(),
        referral_code: referralCode,
        referred_by: referredBy,
        email_verification_token: emailVerificationToken,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        last_active_at: new Date(),
      })
      .returning();

    const token = generateToken({ userId: user.id, email: user.email });

    // Send welcome + verification emails (fire & forget)
    sendWelcomeEmail(user.email, user.username, referralCode).catch(() => {});
    sendEmailVerificationEmail(user.email, user.username, emailVerificationToken).catch(() => {});

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
        verified_score_pass: user.verified_score_pass,
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
        verified_score_pass: users.verified_score_pass,
        email_verified: users.email_verified,
      })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const tier = getUserTier(user.subscription_status, user.trial_ends_at);
    res.json({ user: { ...user, tier } });
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

// POST /auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(users).set({
      password_reset_token: resetToken,
      password_reset_expires: resetExpires,
    }).where(eq(users.id, user.id));

    sendPasswordResetEmail(user.email, user.username, resetToken).catch(() => {});

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.password_reset_token, token))
      .limit(1);

    if (!user || !user.password_reset_expires || user.password_reset_expires < new Date()) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.update(users).set({
      password_hash: passwordHash,
      password_reset_token: null,
      password_reset_expires: null,
    }).where(eq(users.id, user.id));

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/verify-email?token=xxx
router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email_verification_token, token))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: 'Invalid verification token' });
      return;
    }

    await db.update(users).set({
      email_verified: true,
      email_verification_token: null,
    }).where(eq(users.id, user.id));

    res.json({ message: 'Email verified successfully!' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/resend-verification
router.post('/resend-verification', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.email_verified) {
      res.json({ message: 'Email already verified' });
      return;
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await db.update(users).set({ email_verification_token: newToken }).where(eq(users.id, user.id));

    sendEmailVerificationEmail(user.email, user.username, newToken).catch(() => {});
    res.json({ message: 'Verification email sent' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /auth/account — permanently delete own account
router.delete('/account', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    await db.delete(users).where(eq(users.id, userId));
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
