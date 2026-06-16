import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import {
  sendSubscriptionConfirmedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
} from '../services/email';

const router = Router();

function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });
}

// POST /stripe/create-checkout — create checkout session for subscription
router.post('/create-checkout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, username: user.username },
      });
      customerId = customer.id;
      await db.update(users).set({ stripe_customer_id: customerId }).where(eq(users.id, user.id));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${env.FRONTEND_URL}/dashboard?subscription=success`,
      cancel_url: `${env.FRONTEND_URL}/subscribe?cancelled=true`,
      metadata: { user_id: user.id },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /stripe/create-verified-pass-checkout — one-time payment for Verified Score Pass
router.post('/create-verified-pass-checkout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.verified_score_pass) {
      res.status(400).json({ error: 'You already have the Verified Score Pass' });
      return;
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, username: user.username },
      });
      customerId = customer.id;
      await db.update(users).set({ stripe_customer_id: customerId }).where(eq(users.id, user.id));
    }

    // Use price ID if configured, otherwise create ad-hoc price
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = env.STRIPE_VERIFIED_PASS_PRICE_ID
      ? [{ price: env.STRIPE_VERIFIED_PASS_PRICE_ID, quantity: 1 }]
      : [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Verified Score Pass',
              description: 'Connect your sportsbook, get a verified betting score, and auto-sync future bets.',
            },
            unit_amount: env.VERIFIED_PASS_PRICE_CENTS,
          },
          quantity: 1,
        }];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      success_url: `${env.FRONTEND_URL}/dashboard/settings?verified_pass=success`,
      cancel_url: `${env.FRONTEND_URL}/dashboard/settings?verified_pass=cancelled`,
      metadata: { user_id: user.id, purchase_type: 'verified_score_pass' },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Verified pass checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /stripe/create-portal — create billing portal session
router.post('/create-portal', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }

    const [user] = await db
      .select({ stripe_customer_id: users.stripe_customer_id })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user?.stripe_customer_id) {
      res.status(400).json({ error: 'No active subscription' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${env.FRONTEND_URL}/dashboard/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// POST /stripe/webhook — Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        let status: 'active' | 'trialing' | 'past_due' | 'cancelled' = 'active';
        if (subscription.status === 'trialing') status = 'trialing';
        else if (subscription.status === 'past_due') status = 'past_due';
        else if (subscription.status === 'canceled' || subscription.status === 'unpaid') status = 'cancelled';

        const [updatedUser] = await db
          .update(users)
          .set({ subscription_status: status })
          .where(eq(users.stripe_customer_id, customerId))
          .returning({ email: users.email, username: users.username });

        if (updatedUser && status === 'active' && event.type === 'customer.subscription.created') {
          sendSubscriptionConfirmedEmail(updatedUser.email, updatedUser.username).catch(() => {});
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const delSub = event.data.object as Stripe.Subscription;
        const delCustomerId = delSub.customer as string;
        const [cancelledUser] = await db
          .update(users)
          .set({ subscription_status: 'cancelled' })
          .where(eq(users.stripe_customer_id, delCustomerId))
          .returning({ email: users.email, username: users.username });

        if (cancelledUser) {
          sendSubscriptionCancelledEmail(cancelledUser.email, cancelledUser.username).catch(() => {});
        }
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object as Stripe.Invoice;
        const failedCustomerId = failedInvoice.customer as string;
        const [pastDueUser] = await db
          .update(users)
          .set({ subscription_status: 'past_due' })
          .where(eq(users.stripe_customer_id, failedCustomerId))
          .returning({ email: users.email, username: users.username });

        if (pastDueUser) {
          sendPaymentFailedEmail(pastDueUser.email, pastDueUser.username).catch(() => {});
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.purchase_type === 'verified_score_pass' && session.payment_status === 'paid') {
          const sessionCustomerId = session.customer as string;
          await db
            .update(users)
            .set({
              verified_score_pass: true,
              verified_score_pass_purchased_at: new Date(),
            })
            .where(eq(users.stripe_customer_id, sessionCustomerId));
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await db
          .update(users)
          .set({ subscription_status: 'active' })
          .where(eq(users.stripe_customer_id, customerId));
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
