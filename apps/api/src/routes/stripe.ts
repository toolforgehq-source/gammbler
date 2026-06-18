import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import rateLimit from 'express-rate-limit';
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

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please try again later.' },
});

function getStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });
}

// POST /stripe/create-checkout — create checkout session for subscription
router.post('/create-checkout', paymentLimiter, authMiddleware, async (req: Request, res: Response): Promise<void> => {
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

    // Use price ID if configured, otherwise create ad-hoc price
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = env.STRIPE_PRICE_ID
      ? [{ price: env.STRIPE_PRICE_ID, quantity: 1 }]
      : [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Gammbler Pro',
              description: 'Pro subscription — sportsbook sync, CSV import, and all premium features.',
            },
            unit_amount: env.PRO_PRICE_CENTS,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: lineItems,
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
router.post('/create-verified-pass-checkout', paymentLimiter, authMiddleware, async (req: Request, res: Response): Promise<void> => {
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
router.post('/create-portal', paymentLimiter, authMiddleware, async (req: Request, res: Response): Promise<void> => {
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

        const updateData: Record<string, unknown> = { subscription_status: status };
        if (status === 'active' || status === 'trialing') {
          updateData.past_due_since = null;
        } else if (status === 'past_due') {
          updateData.past_due_since = new Date();
        }

        const [updatedUser] = await db
          .update(users)
          .set(updateData)
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
          .set({ subscription_status: 'cancelled', past_due_since: null })
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
          .set({
            subscription_status: 'past_due',
            past_due_since: new Date(),
          })
          .where(eq(users.stripe_customer_id, failedCustomerId))
          .returning({ email: users.email, username: users.username });

        if (pastDueUser) {
          sendPaymentFailedEmail(pastDueUser.email, pastDueUser.username).catch(() => {});
        }
        console.log(`[Stripe] Payment failed for customer ${failedCustomerId}`);
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
          console.log(`[Stripe] Verified Score Pass granted for customer ${sessionCustomerId}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        await db
          .update(users)
          .set({
            subscription_status: 'active',
            past_due_since: null,
          })
          .where(eq(users.stripe_customer_id, customerId));
        console.log(`[Stripe] Payment succeeded for customer ${customerId}`);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const refundCustomerId = charge.customer as string;
        const metadata = charge.metadata || {};

        console.log(`[Stripe] Refund processed for customer ${refundCustomerId}`, {
          amount: charge.amount_refunded,
          metadata,
        });

        // If this was a Verified Score Pass refund, revoke the pass
        if (metadata.purchase_type === 'verified_score_pass') {
          await db
            .update(users)
            .set({ verified_score_pass: false })
            .where(eq(users.stripe_customer_id, refundCustomerId));
          console.log(`[Stripe] Verified Score Pass revoked due to refund for customer ${refundCustomerId}`);
        }
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        const disputeCharge = typeof dispute.charge === 'string' ? dispute.charge : (dispute.charge as Stripe.Charge)?.id;
        console.warn(`[Stripe] DISPUTE CREATED — charge: ${disputeCharge}, reason: ${dispute.reason}, amount: ${dispute.amount}`);

        // Get customer ID from the charge object
        const disputeChargeObj = typeof dispute.charge === 'object' ? dispute.charge as Stripe.Charge : null;
        const disputeCustomerId = disputeChargeObj?.customer
          ? (typeof disputeChargeObj.customer === 'string' ? disputeChargeObj.customer : disputeChargeObj.customer.id)
          : null;

        if (disputeCustomerId) {
          const [disputedUser] = await db
            .update(users)
            .set({
              subscription_status: 'cancelled',
              verified_score_pass: false,
              past_due_since: null,
              payment_flags: { disputed: true, dispute_reason: dispute.reason, dispute_date: new Date().toISOString() },
            })
            .where(eq(users.stripe_customer_id, disputeCustomerId))
            .returning({ email: users.email, username: users.username });

          if (disputedUser) {
            console.warn(`[Stripe] Account flagged and access revoked for ${disputedUser.username} due to dispute`);
          }
        }
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
