'use client';

import { useState, useRef, useEffect } from 'react';
import { betsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Upload, Plus, Check, AlertCircle, Shield, Clock, Camera, Loader2,
  Search, Lock, Zap, AlertTriangle, ShieldCheck, ShieldAlert,
} from 'lucide-react';

const SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer'];
const BET_TYPES = ['spread', 'moneyline', 'over_under', 'parlay', 'prop', 'player_prop', 'teaser', 'futures'];
const PLATFORMS = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'espn_bet', 'pointsbet', 'prizepicks', 'underdog', 'other'];

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface Market {
  key: string;
  outcomes: OddsOutcome[];
}

interface GameEvent {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Market[];
  }>;
}

function formatOddsDisplay(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
}

function formatGameTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${timeStr}`;
}

function hasGameStarted(commenceTime: string): boolean {
  return new Date(commenceTime) <= new Date();
}

function getConsensusOdds(game: GameEvent, marketKey: string): Market | null {
  // Get odds from first available bookmaker (prefer DraftKings, FanDuel)
  const preferred = ['draftkings', 'fanduel', 'betmgm', 'caesars'];
  for (const pref of preferred) {
    const book = game.bookmakers.find(b => b.key === pref);
    if (book) {
      const market = book.markets.find(m => m.key === marketKey);
      if (market) return market;
    }
  }
  // Fallback to any bookmaker
  for (const book of game.bookmakers) {
    const market = book.markets.find(m => m.key === marketKey);
    if (market) return market;
  }
  return null;
}

export default function AddBetPage() {
  const { user } = useAuthStore();
  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active' && user?.subscription_status !== 'trialing');
  const [tab, setTab] = useState<'games' | 'manual' | 'screenshot' | 'csv'>('games');
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
  const [games, setGames] = useState<GameEvent[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameEvent | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<'h2h' | 'spreads' | 'totals'>('h2h');
  const [selectedOutcome, setSelectedOutcome] = useState<{ name: string; price: number; point?: number } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseMessage, setParseMessage] = useState('');
  const [gamesError, setGamesError] = useState('');
  const [sportCounts, setSportCounts] = useState<Record<string, number>>({});
  const [lastTrustStatus, setLastTrustStatus] = useState<string | null>(null);

  // On mount, detect which sports have games and auto-select
  useEffect(() => {
    const detectActiveSport = async () => {
      try {
        const res = await betsAPI.activeSports();
        const sports: Array<{ sport: string; gameCount: number }> = res.data.sports || [];
        const counts: Record<string, number> = {};
        for (const s of sports) counts[s.sport] = s.gameCount;
        setSportCounts(counts);

        // Auto-select first sport with games (prefer MLB, NHL, NBA, NFL in that order for seasonality)
        const preferred = ['mlb', 'nba', 'nhl', 'soccer', 'nfl', 'cfb', 'cbb'];
        const active = preferred.find(s => (counts[s] || 0) > 0);
        if (active) setSport(active);
      } catch {
        // Silently fail — user can still pick manually
      }
    };
    detectActiveSport();
  }, []);

  // Fetch games with odds when sport changes
  useEffect(() => {
    if (tab === 'games') {
      const loadGames = async () => {
        setGamesLoading(true);
        setGamesError('');
        try {
          const res = await betsAPI.gamesWithOdds(sport);
          setGames(res.data.games || []);
          if ((res.data.games || []).length === 0) {
            setGamesError(`No upcoming games for ${sport.toUpperCase()}. This sport may be in the offseason.`);
          }
        } catch (err: unknown) {
          setGames([]);
          const errData = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
          if (errData?.code === 'ODDS_API_ERROR') {
            setGamesError('Failed to load games from the odds provider. Please try again in a moment.');
          } else {
            setGamesError('Unable to load games. Check your connection and try again.');
          }
        } finally {
          setGamesLoading(false);
        }
      };
      loadGames();
    }
  }, [sport, tab]);

  function selectOutcome(game: GameEvent, outcome: OddsOutcome, marketKey: string) {
    if (hasGameStarted(game.commence_time)) return;
    setSelectedGame(game);
    setSelectedOutcome(outcome);
    setEventName(`${game.away_team} @ ${game.home_team}`);
    setOdds(String(outcome.price));

    // Determine bet type from market
    if (marketKey === 'h2h') setBetType('moneyline');
    else if (marketKey === 'spreads') setBetType('spread');
    else if (marketKey === 'totals') setBetType('over_under');

    // Build selection string
    let selStr = outcome.name;
    if (outcome.point !== undefined) {
      if (marketKey === 'spreads') {
        selStr = `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point}`;
      } else if (marketKey === 'totals') {
        selStr = `${outcome.name} ${outcome.point}`;
      }
    }
    setSelection(selStr);
  }

  function handleConfirmBet() {
    setShowConfirmation(true);
  }

  async function submitBet() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await betsAPI.create({
        sport,
        bet_type: betType,
        platform,
        selection,
        odds: parseFloat(odds),
        stake: parseFloat(stake),
        event_name: eventName || undefined,
        result: 'pending',
      });
      const trustStatus = res.data.trust_status;
      setLastTrustStatus(trustStatus);
      if (trustStatus === 'manually_validated') {
        setSuccess('Bet locked in — Validated against real odds ✓');
      } else if (trustStatus === 'manual_unverified') {
        setSuccess('Bet saved for personal tracking — marked UNVERIFIED (does not count toward verified score)');
      } else {
        setSuccess('Bet added successfully');
      }
      // Reset
      setSelection('');
      setOdds('');
      setStake('');
      setEventName('');
      setSelectedGame(null);
      setSelectedOutcome(null);
      setShowConfirmation(false);
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
      setError(errData?.error || 'Failed to add bet');
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stake || !odds || !selection) return;
    handleConfirmBet();
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

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setError('');
    setSuccess('');
    setParseMessage('');

    try {
      const res = await betsAPI.parseScreenshot(file);
      const parsed = res.data.parsed;
      setParseMessage(res.data.message);

      if (parsed.sport && SPORTS.includes(parsed.sport)) setSport(parsed.sport);
      if (parsed.bet_type && BET_TYPES.includes(parsed.bet_type)) setBetType(parsed.bet_type);
      if (parsed.platform && PLATFORMS.includes(parsed.platform)) setPlatform(parsed.platform);
      if (parsed.selection) setSelection(parsed.selection);
      if (parsed.odds) setOdds(parsed.odds);
      if (parsed.stake) setStake(parsed.stake);
      if (parsed.event_name) setEventName(parsed.event_name);

      setTab('manual');
      setSuccess('Screenshot parsed — review the fields below and submit');
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setError(errData?.error || 'Failed to parse screenshot');
    } finally {
      setParsing(false);
      if (screenshotRef.current) screenshotRef.current.value = '';
    }
  };

  // Filter games by search
  const filteredGames = games.filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.home_team.toLowerCase().includes(q) || g.away_team.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          ADD BET
        </h1>
        <p className="text-muted-dark text-sm mt-1">Pick from live games or enter manually</p>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab('games')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'games' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Zap size={16} /> PICK A GAME
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'manual' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Plus size={16} /> MANUAL
        </button>
        <button
          onClick={() => setTab('screenshot')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'screenshot' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Camera size={16} /> SCREENSHOT
        </button>
        <button
          onClick={() => setTab('csv')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'csv' ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Upload size={16} /> CSV <span className="text-[10px] text-gold">(Pro)</span>
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className={`border rounded-lg p-3 text-sm flex items-center gap-2 ${
          lastTrustStatus === 'manual_unverified'
            ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
            : 'bg-win/10 border-win/40 text-win'
        }`}>
          {lastTrustStatus === 'manual_unverified' ? <ShieldAlert size={16} /> : lastTrustStatus === 'manually_validated' ? <ShieldCheck size={16} /> : <Check size={16} />}
          {success}
        </div>
      )}
      {error && (
        <div className="bg-loss/10 border border-loss/40 rounded-lg p-3 text-sm text-loss flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ═══ GAMES TAB — Pick from real games ═══ */}
      {tab === 'games' && (
        <div className="space-y-4">
          {/* Sport selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {SPORTS.map(s => {
              const count = sportCounts[s];
              return (
                <button
                  key={s}
                  onClick={() => { setSport(s); setSelectedGame(null); setSelectedOutcome(null); setGamesError(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors relative ${
                    sport === s ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20 hover:border-accent/40'
                  }`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {s.toUpperCase()}
                  {count !== undefined && count > 0 && (
                    <span className={`ml-1.5 text-[10px] font-normal ${sport === s ? 'text-background/70' : 'text-accent/60'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search games */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-dark" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams..."
              className="w-full bg-card border border-accent/20 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-muted-dark focus:outline-none focus:border-accent"
            />
          </div>

          {/* Market selector */}
          <div className="flex gap-2">
            {(['h2h', 'spreads', 'totals'] as const).map(m => (
              <button
                key={m}
                onClick={() => setSelectedMarket(m)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  selectedMarket === m ? 'bg-accent/20 text-accent border border-accent/40' : 'bg-card text-muted-dark border border-accent/10'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {m === 'h2h' ? 'MONEYLINE' : m === 'spreads' ? 'SPREAD' : 'TOTALS'}
              </button>
            ))}
          </div>

          {/* Games list */}
          {gamesLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <Loader2 size={32} className="text-accent mx-auto mb-3 animate-spin" />
                <p className="text-sm text-muted-dark">Loading {sport.toUpperCase()} games...</p>
                <p className="text-xs text-muted-dark mt-1">Fetching live odds from sportsbooks</p>
              </div>
            </div>
          ) : gamesError ? (
            <div className="bg-card border border-loss/20 rounded-lg p-8 text-center">
              <AlertTriangle size={32} className="mx-auto text-loss mb-3" />
              <p className="text-loss font-medium">{gamesError}</p>
              <p className="text-xs text-muted-dark mt-2">Try another sport{sportCounts && Object.entries(sportCounts).some(([, c]) => c > 0) ? ` — ${Object.entries(sportCounts).filter(([, c]) => c > 0).map(([s, c]) => `${s.toUpperCase()} (${c})`).join(', ')} have games` : ''}</p>
              <button
                onClick={() => { setGamesError(''); const loadRetry = async () => { setGamesLoading(true); try { const r = await betsAPI.gamesWithOdds(sport); setGames(r.data.games || []); } catch { setGamesError('Still unable to load games.'); } finally { setGamesLoading(false); } }; loadRetry(); }}
                className="mt-3 px-4 py-2 text-sm bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="bg-card border border-accent/20 rounded-lg p-8 text-center">
              <Clock size={32} className="mx-auto text-muted-dark mb-3" />
              <p className="text-muted-dark">No upcoming games for {sport.toUpperCase()}</p>
              <p className="text-xs text-muted-dark mt-1">Try a different sport or check back later</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGames.map(game => {
                const started = hasGameStarted(game.commence_time);
                const market = getConsensusOdds(game, selectedMarket);
                const isSelected = selectedGame?.id === game.id;

                return (
                  <div
                    key={game.id}
                    className={`bg-card border rounded-lg p-4 transition-all ${
                      started ? 'border-loss/20 opacity-60' : isSelected ? 'border-accent' : 'border-accent/20 hover:border-accent/40'
                    }`}
                  >
                    {/* Game header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${started ? 'text-loss' : 'text-accent'}`}>
                          {started ? (
                            <span className="flex items-center gap-1"><Lock size={10} /> STARTED</span>
                          ) : (
                            formatGameTime(game.commence_time)
                          )}
                        </span>
                      </div>
                      {started && (
                        <span className="text-[10px] text-loss/60 uppercase tracking-wider">Locked</span>
                      )}
                    </div>

                    {/* Teams & Odds */}
                    <div className="space-y-2">
                      {market ? (
                        <>
                          {selectedMarket === 'totals' ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 text-sm text-white font-medium">
                                {game.away_team} @ {game.home_team}
                              </div>
                              <div className="flex gap-2">
                                {market.outcomes.map((outcome, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => !started && selectOutcome(game, outcome, selectedMarket)}
                                    disabled={started}
                                    className={`px-3 py-2 rounded-lg text-center min-w-[80px] transition-all ${
                                      selectedOutcome?.name === outcome.name && selectedGame?.id === game.id
                                        ? 'bg-accent text-background ring-2 ring-accent'
                                        : started
                                          ? 'bg-background/50 text-muted-dark cursor-not-allowed'
                                          : 'bg-background border border-accent/20 hover:border-accent/60 cursor-pointer'
                                    }`}
                                  >
                                    <div className="text-[10px] text-muted-dark uppercase">{outcome.name}</div>
                                    <div className="text-xs font-bold" style={{ fontFamily: 'var(--font-number)' }}>
                                      {outcome.point}
                                    </div>
                                    <div className={`text-xs font-bold mt-0.5 ${
                                      selectedOutcome?.name === outcome.name && selectedGame?.id === game.id ? 'text-background' : 'text-accent'
                                    }`} style={{ fontFamily: 'var(--font-number)' }}>
                                      {formatOddsDisplay(outcome.price)}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            market.outcomes.map((outcome, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="flex-1 text-sm text-white font-medium">
                                  {outcome.name}
                                  {outcome.point !== undefined && selectedMarket === 'spreads' && (
                                    <span className="ml-2 text-muted-dark text-xs">
                                      ({outcome.point > 0 ? '+' : ''}{outcome.point})
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => !started && selectOutcome(game, outcome, selectedMarket)}
                                  disabled={started}
                                  className={`px-4 py-2 rounded-lg font-bold text-sm min-w-[72px] transition-all ${
                                    selectedOutcome?.name === outcome.name && selectedGame?.id === game.id
                                      ? 'bg-accent text-background ring-2 ring-accent'
                                      : started
                                        ? 'bg-background/50 text-muted-dark cursor-not-allowed'
                                        : 'bg-background border border-accent/20 hover:border-accent/60 cursor-pointer'
                                  }`}
                                  style={{ fontFamily: 'var(--font-number)' }}
                                >
                                  {formatOddsDisplay(outcome.price)}
                                </button>
                              </div>
                            ))
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white">{game.away_team} @ {game.home_team}</span>
                          <span className="text-xs text-muted-dark">No odds available</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bet slip / stake entry when selection made */}
          {selectedOutcome && selectedGame && (
            <div className="sticky bottom-4 bg-card border-2 border-accent rounded-xl p-5 shadow-xl shadow-accent/10">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>YOUR PICK</p>
                  <p className="text-white font-bold text-lg">{selection}</p>
                  <p className="text-sm text-muted-dark">{eventName}</p>
                </div>
                <div className="text-right">
                  <p className="text-accent font-bold text-xl" style={{ fontFamily: 'var(--font-number)' }}>
                    {formatOddsDisplay(selectedOutcome.price)}
                  </p>
                  <p className="text-xs text-muted-dark">{selectedMarket === 'h2h' ? 'Moneyline' : selectedMarket === 'spreads' ? 'Spread' : 'Total'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-muted-dark mb-1">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-dark mb-1">Stake ($)</label>
                  <input
                    type="number"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-dark focus:outline-none focus:border-accent"
                    placeholder="100"
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>

              {stake && (
                <div className="flex items-center justify-between mb-3 px-3 py-2 bg-background rounded-lg">
                  <span className="text-xs text-muted-dark">Potential Payout</span>
                  <span className="text-win font-bold" style={{ fontFamily: 'var(--font-number)' }}>
                    ${calculatePayout(selectedOutcome.price, parseFloat(stake) || 0).toFixed(2)}
                  </span>
                </div>
              )}

              <button
                onClick={handleConfirmBet}
                disabled={!stake || parseFloat(stake) <= 0 || loading}
                className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {loading ? 'Placing...' : 'CONFIRM BET'}
              </button>

              {isFree && (
                <div className="flex items-center gap-2 mt-2 text-xs text-accent">
                  <Shield size={12} /> Pre-Game Verified — entered before kickoff
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ MANUAL TAB ═══ */}
      {tab === 'manual' && (
        <div className="space-y-4">
          {/* Platform select */}
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

          {/* Trust System Banner */}
          <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
            <ShieldAlert size={20} className="text-yellow-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-yellow-400 font-semibold">Manual Bet Verification</p>
              <p className="text-muted-dark mt-1">
                Manual bets are checked against <span className="text-white font-medium">real sportsbook odds</span>.
                Bets that match real lines are <span className="text-accent font-medium">Validated</span> and count toward your score.
                Unverified bets are saved for personal tracking only.
              </p>
            </div>
          </div>

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

            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-dark mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Event (Optional)
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
              {loading ? 'Adding...' : 'REVIEW BET'}
            </button>
          </form>
        </div>
      )}

      {/* ═══ SCREENSHOT TAB ═══ */}
      {tab === 'screenshot' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-dark">
            Upload a screenshot of your sportsbook bet slip. We&apos;ll use AI to read it and pre-fill the form for you.
          </p>
          <div
            className={`bg-card border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              parsing ? 'border-accent/60' : 'border-accent/30 cursor-pointer hover:border-accent/60'
            }`}
            onClick={() => !parsing && screenshotRef.current?.click()}
          >
            {parsing ? (
              <>
                <Loader2 size={32} className="text-accent mx-auto mb-3 animate-spin" />
                <p className="text-sm text-white mb-1">Analyzing your bet slip...</p>
                <p className="text-xs text-muted-dark">This usually takes a few seconds</p>
              </>
            ) : (
              <>
                <Camera size={32} className="text-accent mx-auto mb-3" />
                <p className="text-sm text-white mb-1">Click to upload a bet slip screenshot</p>
                <p className="text-xs text-muted-dark">Works with DraftKings, FanDuel, BetMGM, and any sportsbook</p>
              </>
            )}
            <input
              ref={screenshotRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleScreenshotUpload}
              className="hidden"
            />
          </div>
          {parseMessage && (
            <p className="text-xs text-accent">{parseMessage}</p>
          )}
        </div>
      )}

      {/* ═══ CSV TAB ═══ */}
      {tab === 'csv' && (
        <div className="space-y-4">
          {/* Platform select */}
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
          <p className="text-sm text-muted-dark">
            Upload a CSV file exported from your sportsbook. We&apos;ll automatically map the columns and import your bets.
          </p>
          <p className="text-xs text-gold font-semibold">CSV import is a Pro feature. Upgrade to Pro to use this feature.</p>
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

      {/* ═══ CONFIRMATION MODAL ═══ */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirmation(false)}>
          <div className="bg-card border border-accent/30 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              CONFIRM YOUR BET
            </h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-dark text-sm">Selection</span>
                <span className="text-white font-medium text-sm">{selection}</span>
              </div>
              {eventName && (
                <div className="flex justify-between">
                  <span className="text-muted-dark text-sm">Event</span>
                  <span className="text-white text-sm">{eventName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-dark text-sm">Odds</span>
                <span className="text-accent font-bold text-sm" style={{ fontFamily: 'var(--font-number)' }}>
                  {formatOddsDisplay(parseFloat(odds))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-dark text-sm">Stake</span>
                <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-number)' }}>${parseFloat(stake).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-dark text-sm">Platform</span>
                <span className="text-white text-sm">{platform.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
              </div>
              <hr className="border-accent/10" />
              <div className="flex justify-between">
                <span className="text-muted-dark text-sm">Potential Payout</span>
                <span className="text-win font-bold" style={{ fontFamily: 'var(--font-number)' }}>
                  ${calculatePayout(parseFloat(odds), parseFloat(stake) || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {tab === 'games' && (
              <div className="flex items-center gap-2 mb-4 p-2 bg-accent/10 rounded-lg">
                <ShieldCheck size={14} className="text-accent" />
                <span className="text-xs text-accent">This bet will be Validated — picked from real odds</span>
              </div>
            )}
            {tab === 'manual' && (
              <div className="flex items-center gap-2 mb-4 p-2 bg-yellow-500/10 rounded-lg">
                <ShieldAlert size={14} className="text-yellow-400" />
                <span className="text-xs text-yellow-400">Manual bets are checked against real odds. Unverified bets won&apos;t count toward your verified score.</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 py-3 border border-accent/20 text-muted rounded-lg font-semibold hover:border-accent/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitBet}
                disabled={loading}
                className="flex-1 py-3 bg-accent text-background font-bold rounded-lg uppercase hover:bg-accent-light transition-colors disabled:opacity-50"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {loading ? 'Placing...' : 'LOCK IT IN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculatePayout(odds: number, stake: number): number {
  if (odds > 0) {
    return stake + (stake * odds / 100);
  } else {
    return stake + (stake * 100 / Math.abs(odds));
  }
}
