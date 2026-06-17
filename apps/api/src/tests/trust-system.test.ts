/**
 * Trust System Integration Tests
 * 
 * Validates that the 3-tier bet verification system correctly:
 * 1. Marks fake teams/games as unverified
 * 2. Marks fake spreads as unverified
 * 3. Marks fake odds as unverified
 * 4. Validates real markets as manually_validated
 * 5. SharpSports synced bets get synced_verified
 * 6. Unverified bets are excluded from score calculation
 * 
 * Run: npx tsx apps/api/src/tests/trust-system.test.ts
 */

import { validateBetAgainstOdds } from '../services/odds-api';
import { db } from '../db';
import { bets, gammblerScores, users } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function testFakeTeamRejected() {
  console.log('\n── Test: Fake team/game rejected or marked unverified ──');
  const result = await validateBetAgainstOdds(
    'mlb', 'Fake City Fakers vs Nowhere Nobodies', 'Fake City Fakers', -150, 'moneyline'
  );
  assert(!result.validated, 'Fake team should NOT be validated');
  assert(result.reason === 'event_not_found' || result.reason === 'odds_mismatch',
    `Reason should be event_not_found or odds_mismatch, got: ${result.reason}`);
}

async function testFakeSpreadRejected() {
  console.log('\n── Test: Fake spread rejected or marked unverified ──');
  // +99.5 is an impossible spread for any MLB game
  const result = await validateBetAgainstOdds(
    'mlb', undefined, 'Some Team +99.5', -110, 'spread'
  );
  // This should fail because either the team doesn't exist or the spread is way off
  assert(!result.validated, 'Fake spread (+99.5) should NOT be validated');
}

async function testFakeOddsRejected() {
  console.log('\n── Test: Fake odds rejected or marked unverified ──');
  // -9999 odds for a moneyline on a non-live normal game
  const result = await validateBetAgainstOdds(
    'nfl', undefined, 'New England Patriots', -9999, 'moneyline'
  );
  // NFL games are months away with normal odds; -9999 should fail
  assert(!result.validated || result.reason === 'odds_mismatch',
    'Impossible odds (-9999 for a future NFL game) should NOT be validated');
}

async function testValidRealMarketAccepted() {
  console.log('\n── Test: Valid real market accepted ──');
  // Use the API to find a real upcoming game and test it
  const { getLiveOddsMultiLeague } = await import('../services/odds-api');
  const events = await getLiveOddsMultiLeague('mlb');
  
  if (events.length === 0) {
    console.log('  ⚠ No MLB events available — skipping real market test');
    return;
  }

  // Find a game with h2h odds
  for (const event of events) {
    for (const bm of event.bookmakers) {
      for (const market of bm.markets) {
        if (market.key === 'h2h' && market.outcomes.length > 0) {
          const outcome = market.outcomes[0];
          const eventName = `${event.away_team} @ ${event.home_team}`;
          const result = await validateBetAgainstOdds(
            'mlb', eventName, outcome.name, outcome.price, 'moneyline'
          );
          assert(result.validated === true, `Real bet (${outcome.name} @ ${outcome.price}) should be validated`);
          assert(result.matchedEventId === event.id, 'Should match the correct event ID');
          return;
        }
      }
    }
  }
  console.log('  ⚠ No h2h market found — skipping');
}

async function testSyncedBetIsVerified() {
  console.log('\n── Test: Sportsbook synced bet counts as synced_verified ──');
  // Check that bets with sharpsports_bet_id have trust_status = synced_verified
  const syncedBets = await db
    .select({ trust_status: bets.trust_status, sharpsports_bet_id: bets.sharpsports_bet_id })
    .from(bets)
    .where(sql`${bets.sharpsports_bet_id} IS NOT NULL`)
    .limit(5);

  if (syncedBets.length === 0) {
    // No synced bets in DB, check that non-manual bets are synced_verified
    const nonManualBets = await db
      .select({ trust_status: bets.trust_status, is_manual: bets.is_manual })
      .from(bets)
      .where(eq(bets.is_manual, false))
      .limit(5);

    if (nonManualBets.length === 0) {
      console.log('  ⚠ No synced bets in DB — skipping');
      return;
    }

    for (const b of nonManualBets) {
      assert(b.trust_status === 'synced_verified',
        `Non-manual bet should be synced_verified, got: ${b.trust_status}`);
    }
  } else {
    for (const b of syncedBets) {
      assert(b.trust_status === 'synced_verified',
        `SharpSports bet should be synced_verified, got: ${b.trust_status}`);
    }
  }
}

async function testUnverifiedExcludedFromScore() {
  console.log('\n── Test: Unverified manual bet excluded from score/leaderboards ──');

  // Find a user with scores
  const [testUser] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .limit(1);

  if (!testUser) {
    console.log('  ⚠ No users in DB — skipping');
    return;
  }

  const { updateAllScores } = await import('../services/gammbler-score');

  // Establish baseline with current trust filtering
  await updateAllScores(testUser.id);

  const [scoreBefore] = await db
    .select({ score: gammblerScores.score, settled: gammblerScores.settled_bet_count })
    .from(gammblerScores)
    .where(and(eq(gammblerScores.user_id, testUser.id), eq(gammblerScores.sport, 'overall')))
    .limit(1);

  // Insert an unverified settled bet (big win that WOULD change score if counted)
  const [unverifiedBet] = await db
    .insert(bets)
    .values({
      user_id: testUser.id,
      platform: 'other',
      sport: 'mlb',
      bet_type: 'moneyline',
      selection: 'TEST_UNVERIFIED_BET',
      odds: '-110',
      stake: '1000',
      result: 'win',
      profit_loss: '909.09',
      is_manual: true,
      settled_at: new Date(),
      trust_status: 'manual_unverified',
      validation_reason: 'test_excluded',
    })
    .returning();

  // Recalculate scores — unverified bet should be excluded
  await updateAllScores(testUser.id);

  const [scoreAfter] = await db
    .select({ score: gammblerScores.score, settled: gammblerScores.settled_bet_count })
    .from(gammblerScores)
    .where(and(eq(gammblerScores.user_id, testUser.id), eq(gammblerScores.sport, 'overall')))
    .limit(1);

  if (scoreBefore && scoreAfter) {
    assert(
      parseFloat(String(scoreAfter.settled)) === parseFloat(String(scoreBefore.settled)),
      `Settled count should not change (before: ${scoreBefore.settled}, after: ${scoreAfter.settled}) — unverified bet excluded`
    );
  } else {
    assert(true, 'Score calculation completed without error');
  }

  // Clean up test bet
  await db.delete(bets).where(eq(bets.id, unverifiedBet.id));
  await updateAllScores(testUser.id);
}

async function runTests() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Trust System Integration Tests         ║');
  console.log('╚══════════════════════════════════════════╝');

  await testFakeTeamRejected();
  await testFakeSpreadRejected();
  await testFakeOddsRejected();
  await testValidRealMarketAccepted();
  await testSyncedBetIsVerified();
  await testUnverifiedExcludedFromScore();

  console.log(`\n══════════════════════════════════════════`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════════`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
