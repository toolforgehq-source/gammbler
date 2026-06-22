'use client';

import { useState, useRef, useEffect } from 'react';
import { betsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Upload, Check, AlertCircle, Shield, Clock,
  Search, Timer,
} from 'lucide-react';

const SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer'];
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
  const preferred = ['draftkings', 'fanduel', 'betmgm', 'caesars'];
  for (const pref of preferred) {
    const book = game.bookmakers.find(b => b.key === pref);
    if (book) {
      const market = book.markets.find(m => m.key === marketKey);
      if (market) return market;
    }
  }
  for (const book of game.bookmakers) {
    const market = book.markets.find(m => m.key === marketKey);
    if (market) return market;
  }
  return null;
}

function calculatePayout(odds: number, stake: number): number {
  if (odds > 0) {
    return stake + (stake * odds / 100);
  } else {
    return stake + (stake * 100 / Math.abs(odds));
  }
}

export default function AddBetPage() {
  const { user } = useAuthStore();
  // CSV import is available to all users (no trial/pro gate)
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
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch games with odds when sport changes
  useEffect(() => {
    const loadGames = async () => {
      setGamesLoading(true);
      try {
        const res = await betsAPI.gamesWithOdds(sport);
        setGames(res.data.games || []);
      } catch {
        setGames([]);
      } finally {
        setGamesLoading(false);
      }
    };
    loadGames();
  }, [sport]);

  function selectOutcome(game: GameEvent, outcome: OddsOutcome, marketKey: string) {
    if (hasGameStarted(game.commence_time)) return;
    setSelectedGame(game);
    setSelectedOutcome(outcome);
    setEventName(`${game.away_team} @ ${game.home_team}`);
    setOdds(String(outcome.price));

    if (marketKey === 'h2h') setBetType('moneyline');
    else if (marketKey === 'spreads') setBetType('spread');
    else if (marketKey === 'totals') setBetType('over_under');

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

  async function submitBet() {
    if (!selectedGame || !selectedOutcome || !stake) return;
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
        odds_api_event_id: selectedGame.id,
        event_start_time: selectedGame.commence_time,
      });
      setSuccess('Bet locked in — will auto-settle when the game ends');
      setSelection('');
      setOdds('');
      setStake('');
      setEventName('');
      setSelectedGame(null);
      setSelectedOutcome(null);
      setShowConfirmation(false);
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
      setError(errData?.error || 'Failed to place bet');
      setShowConfirmation(false);
    } finally {
      setLoading(false);
    }
  }

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

  // Filter games by search + only show upcoming (not started)
  const upcomingGames = games.filter(g => !hasGameStarted(g.commence_time));
  const filteredGames = upcomingGames.filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.home_team.toLowerCase().includes(q) || g.away_team.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          PICK A GAME
        </h1>
        <p className="text-muted-dark text-sm mt-1">Select a game, pick your side, and your bet will auto-settle when it ends</p>
      </div>

      {/* Auto-settle info banner */}
      <div className="bg-accent/5 border border-accent/30 rounded-lg p-4 flex items-start gap-3">
        <Timer size={20} className="text-accent mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="text-accent font-semibold">Auto-Settle Enabled</p>
          <p className="text-muted-dark mt-1">
            All bets are tied to real games and <span className="text-white font-medium">settled automatically</span> when the game ends. No manual entry — no lying.
          </p>
        </div>
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

      {/* Sport selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {SPORTS.map(s => (
          <button
            key={s}
            onClick={() => { setSport(s); setSelectedGame(null); setSelectedOutcome(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              sport === s ? 'bg-accent text-background' : 'bg-card text-muted border border-accent/20 hover:border-accent/40'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {s.toUpperCase()}
          </button>
        ))}
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
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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
            const market = getConsensusOdds(game, selectedMarket);
            const isSelected = selectedGame?.id === game.id;

            return (
              <div
                key={game.id}
                className={`bg-card border rounded-lg p-4 transition-all ${
                  isSelected ? 'border-accent' : 'border-accent/20 hover:border-accent/40'
                }`}
              >
                {/* Game header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-accent">
                      {formatGameTime(game.commence_time)}
                    </span>
                  </div>
                  <span className="text-[10px] text-accent/60 uppercase tracking-wider flex items-center gap-1">
                    <Timer size={10} /> Auto-Settle
                  </span>
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
                                onClick={() => selectOutcome(game, outcome, selectedMarket)}
                                className={`px-3 py-2 rounded-lg text-center min-w-[80px] transition-all ${
                                  selectedOutcome?.name === outcome.name && selectedGame?.id === game.id
                                    ? 'bg-accent text-background ring-2 ring-accent'
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
                              onClick={() => selectOutcome(game, outcome, selectedMarket)}
                              className={`px-4 py-2 rounded-lg font-bold text-sm min-w-[72px] transition-all ${
                                selectedOutcome?.name === outcome.name && selectedGame?.id === game.id
                                  ? 'bg-accent text-background ring-2 ring-accent'
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
            onClick={() => setShowConfirmation(true)}
            disabled={!stake || parseFloat(stake) <= 0 || loading}
            className="w-full bg-accent text-background font-bold py-3 rounded-lg uppercase tracking-wider hover:bg-accent-light transition-colors disabled:opacity-50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Placing...' : 'CONFIRM BET'}
          </button>

          <div className="flex items-center gap-2 mt-2 text-xs text-accent">
            <Shield size={12} /> Pre-Game Verified — Auto-settles when game ends
          </div>
        </div>
      )}

      {/* CSV Import Section — available to all users */}
      <div className="border-t border-accent/10 pt-6 mt-6">
        <button
          onClick={() => setShowCsvUpload(!showCsvUpload)}
          className="flex items-center gap-2 text-sm text-muted-dark hover:text-accent transition-colors"
        >
          <Upload size={16} />
          <span>Import bets from CSV</span>
        </button>

        {showCsvUpload && (
          <div className="mt-4 space-y-3">
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
            <div
              className="bg-card border-2 border-dashed border-accent/30 rounded-lg p-8 text-center cursor-pointer hover:border-accent/60 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={32} className="text-accent mx-auto mb-3" />
              <p className="text-sm text-white mb-1">Click to upload CSV from your sportsbook</p>
              <p className="text-xs text-muted-dark">Supports DraftKings, FanDuel, BetMGM exports</p>
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

      {/* ═══ CONFIRMATION MODAL ═══ */}
      {showConfirmation && selectedGame && selectedOutcome && (
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
              <div className="flex justify-between">
                <span className="text-muted-dark text-sm">Game</span>
                <span className="text-white text-sm">{eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-dark text-sm">Kickoff</span>
                <span className="text-white text-sm">{formatGameTime(selectedGame.commence_time)}</span>
              </div>
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

            <div className="flex items-center gap-2 mb-4 p-2 bg-accent/10 rounded-lg">
              <Timer size={14} className="text-accent" />
              <span className="text-xs text-accent">Result will be settled automatically when the game ends</span>
            </div>

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
