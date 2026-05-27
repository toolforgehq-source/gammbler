'use client';

import { useState, useRef, useEffect } from 'react';
import { betsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Upload, Plus, Check, AlertCircle, Lock, Shield, Clock } from 'lucide-react';
import UpgradeBanner from '@/components/ui/UpgradeBanner';

const SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer', 'prizepicks', 'dfs'];
const BET_TYPES = ['spread', 'moneyline', 'over_under', 'parlay', 'prop', 'player_prop', 'teaser', 'futures'];
const PLATFORMS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'espn_bet', 'pointsbet', 'prizepicks', 'underdog', 'other'];

export default function AddBetPage() {
  const { user } = useAuthStore();
  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active' && user?.subscription_status !== 'trialing');
  const [tab, setTab] = useState<'manual' | 'csv'>('manual');
  const [sport, setSport] = useState('nfl');
  const [betType, setBetType] = useState('spread');
  const [platform, setPlatform] = useState('draftkings');
  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState('');
  const [stake, setStake] = useState('');
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{ id: string; display: string; commence_time: string }>>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch upcoming events when sport changes (for free users to see game times)
  useEffect(() => {
    const shouldFetch = isFree && sport !== 'prizepicks' && sport !== 'dfs';
    let cancelled = false;

    if (shouldFetch) {
      betsAPI.upcomingEvents(sport)
        .then(res => { if (!cancelled) setUpcomingEvents(res.data.events || []); })
        .catch(() => { if (!cancelled) setUpcomingEvents([]); });
    } else {
      // Use microtask to avoid synchronous setState within effect body
      Promise.resolve().then(() => { if (!cancelled) setUpcomingEvents([]); });
    }

    return () => { cancelled = true; };
  }, [sport, isFree]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const eventDisplay = selectedEvent
        ? upcomingEvents.find(e => e.id === selectedEvent)?.display
        : undefined;

      const res = await betsAPI.create({
        sport,
        bet_type: betType,
        platform,
        selection,
        odds,
        stake,
        event_name: eventDisplay || eventName || undefined,
        result: 'pending',
      });
      const verified = res.data.pregame_verified;
      setSuccess(verified
        ? 'Bet added — Pre-Game Verified ✓'
        : 'Bet added successfully');
      setSelection('');
      setOdds('');
      setStake('');
      setEventName('');
      setSelectedEvent('');
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
      setError(errData?.error || 'Failed to add bet');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await betsAPI.csvImport(file, platform);
      setSuccess(`Imported ${res.data.imported} bets successfully`);
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setError(errData?.error || 'CSV import failed');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Tab Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('manual')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'manual' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Plus size={16} /> MANUAL ENTRY
        </button>
        <button
          onClick={() => setTab('csv')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'csv' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Upload size={16} /> CSV IMPORT
          {isFree && <Lock size={12} className="ml-1 opacity-60" />}
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className="bg-win/10 border border-win/40 rounded-lg p-3 text-sm text-win flex items-center gap-2">
          <Check size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="bg-loss/10 border border-loss/40 rounded-lg p-3 text-sm text-loss flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Platform select (shared between tabs) */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Platform
        </label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Pre-Game Lock Banner (free users only) */}
      {isFree && tab === 'manual' && (
        <div className="bg-accent/5 border border-accent/30 rounded-lg p-4 flex items-start gap-3">
          <Shield size={20} className="text-accent mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="text-accent font-semibold">Pre-Game Lock Active</p>
            <p className="text-muted-dark mt-1">
              Bets must be entered <span className="text-white font-medium">before the game starts</span> to count toward your Gammbler Score. 
              This prevents cherry-picking winners and ensures score integrity.
            </p>
            <p className="text-muted-dark mt-1">
              Want automatic bet syncing? <span className="text-accent font-medium">Upgrade to Pro</span> for SharpSports auto-sync — every bet tracked automatically, no manual entry needed.
            </p>
          </div>
        </div>
      )}

      {tab === 'manual' ? (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Sport
              </label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Bet Type
              </label>
              <select
                value={betType}
                onChange={(e) => setBetType(e.target.value)}
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
              >
                {BET_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Selection / Pick
            </label>
            <input
              type="text"
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
              className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent"
              placeholder="e.g., Patriots -3.5"
              required
            />
          </div>

          {/* Upcoming Events Selector (free users see available games) */}
          {upcomingEvents.length > 0 && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Select Game <Clock size={12} className="inline ml-1 text-accent" />
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => {
                  setSelectedEvent(e.target.value);
                  const ev = upcomingEvents.find(evt => evt.id === e.target.value);
                  if (ev) setEventName(ev.display);
                }}
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent"
              >
                <option value="">Select an upcoming game...</option>
                {upcomingEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.display} — {new Date(ev.commence_time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </option>
                ))}
              </select>
              {isFree && (
                <p className="text-xs text-muted-dark mt-1">
                  Selecting a game ensures your bet is pre-game verified for your Gammbler Score.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Event {upcomingEvents.length > 0 ? '(or type manually)' : '(Optional)'}
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent"
              placeholder="e.g., Patriots vs Bills"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Odds (American)
              </label>
              <input
                type="text"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                placeholder="-110"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Stake ($)
              </label>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full bg-card border border-accent/20 rounded-lg px-4 py-3 text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                placeholder="100"
                min="0.01"
                step="0.01"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Adding...' : 'Add Bet'}
          </button>
        </form>
      ) : isFree ? (
        <UpgradeBanner feature="CSV Bet Import" description="Bulk import your betting history from any sportsbook via CSV. Save hours of manual entry." />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-dark">
            Upload a CSV file exported from your sportsbook. We&apos;ll automatically map the columns and import your bets.
          </p>
          <div
            className="bg-card border-2 border-dashed border-accent/30 rounded-lg p-12 text-center cursor-pointer hover:border-accent/60 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={32} className="text-accent mx-auto mb-3" />
            <p className="text-sm text-white mb-1">Click to upload CSV</p>
            <p className="text-xs text-muted-dark">Supports DraftKings, FanDuel, BetMGM, and more</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
}
