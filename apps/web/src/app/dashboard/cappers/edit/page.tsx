'use client';

import { useEffect, useState } from 'react';
import { cappersAPI } from '@/lib/api';
import { Save, ArrowLeft, Image, Link2, Trophy } from 'lucide-react';
import Link from 'next/link';

const SPORTS_OPTIONS = ['NFL', 'NBA', 'MLB', 'NHL', 'CFB', 'CBB', 'Soccer', 'MMA', 'Tennis', 'Golf'];
const BETTING_STYLES = ['Spreads', 'Moneylines', 'Props', 'Parlays', 'Futures', 'DFS', 'Mixed'];

interface CapperProfile {
  display_name: string;
  bio: string;
  price_cents: number;
  banner_url: string;
  profile_photo_url: string;
  favorite_sports: string[];
  favorite_teams: string[];
  betting_style: string;
  social_links: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    website?: string;
  };
}

export default function EditCapperProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<CapperProfile>({
    display_name: '',
    bio: '',
    price_cents: 499,
    banner_url: '',
    profile_photo_url: '',
    favorite_sports: [],
    favorite_teams: [],
    betting_style: '',
    social_links: {},
  });
  const [newTeam, setNewTeam] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await cappersAPI.myEarnings();
        const data = res.data;
        if (data) {
          setProfile({
            display_name: data.display_name || '',
            bio: data.bio || '',
            price_cents: data.price_cents || 499,
            banner_url: data.banner_url || '',
            profile_photo_url: data.profile_photo_url || '',
            favorite_sports: data.favorite_sports || [],
            favorite_teams: data.favorite_teams || [],
            betting_style: data.betting_style || '',
            social_links: data.social_links || {},
          });
        }
      } catch { /* not a capper */ }
      setLoading(false);
    }
    loadProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await cappersAPI.updateProfile({
        display_name: profile.display_name,
        bio: profile.bio,
        price_cents: profile.price_cents,
        banner_url: profile.banner_url || null,
        profile_photo_url: profile.profile_photo_url || null,
        favorite_sports: profile.favorite_sports,
        favorite_teams: profile.favorite_teams,
        betting_style: profile.betting_style || null,
        social_links: profile.social_links,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to save profile');
    }
    setSaving(false);
  }

  function toggleSport(sport: string) {
    setProfile((p) => ({
      ...p,
      favorite_sports: p.favorite_sports.includes(sport)
        ? p.favorite_sports.filter((s) => s !== sport)
        : p.favorite_sports.length < 6 ? [...p.favorite_sports, sport] : p.favorite_sports,
    }));
  }

  function addTeam() {
    if (!newTeam.trim() || profile.favorite_teams.length >= 10) return;
    setProfile((p) => ({ ...p, favorite_teams: [...p.favorite_teams, newTeam.trim()] }));
    setNewTeam('');
  }

  function removeTeam(team: string) {
    setProfile((p) => ({ ...p, favorite_teams: p.favorite_teams.filter((t) => t !== team) }));
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-dark">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/cappers" className="text-muted-dark hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              EDIT CREATOR PROFILE
            </h1>
            <p className="text-muted-dark text-sm">Customize how subscribers see you</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Banner & Photo */}
      <div className="bg-card rounded-xl p-4 border border-accent/10 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Image size={16} className="text-accent" />
          Profile Images
        </h2>

        <div>
          <label className="text-xs text-muted-dark block mb-1">Banner Image URL</label>
          <input
            type="text"
            value={profile.banner_url}
            onChange={(e) => setProfile((p) => ({ ...p, banner_url: e.target.value }))}
            placeholder="https://example.com/banner.jpg"
            className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50"
          />
          {profile.banner_url && (
            <img src={profile.banner_url} alt="Banner preview" className="mt-2 h-24 w-full object-cover rounded-lg border border-accent/10" />
          )}
        </div>

        <div>
          <label className="text-xs text-muted-dark block mb-1">Profile Photo URL</label>
          <input
            type="text"
            value={profile.profile_photo_url}
            onChange={(e) => setProfile((p) => ({ ...p, profile_photo_url: e.target.value }))}
            placeholder="https://example.com/photo.jpg"
            className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50"
          />
          {profile.profile_photo_url && (
            <img src={profile.profile_photo_url} alt="Photo preview" className="mt-2 w-16 h-16 object-cover rounded-full border-2 border-accent/20" />
          )}
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-card rounded-xl p-4 border border-accent/10 space-y-4">
        <h2 className="text-sm font-semibold text-white">Basic Info</h2>

        <div>
          <label className="text-xs text-muted-dark block mb-1">Display Name</label>
          <input
            type="text"
            value={profile.display_name}
            onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
            maxLength={100}
            className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="text-xs text-muted-dark block mb-1">Bio (up to 2000 characters)</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            maxLength={2000}
            rows={4}
            placeholder="Tell subscribers about yourself, your betting philosophy, and what they can expect..."
            className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50 resize-none"
          />
          <p className="text-[10px] text-muted-dark mt-1">{profile.bio.length}/2000</p>
        </div>

        <div>
          <label className="text-xs text-muted-dark block mb-1">Subscription Price</label>
          <div className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-muted-dark">
            Free (paid subscriptions coming soon)
          </div>
        </div>
      </div>

      {/* Betting Identity */}
      <div className="bg-card rounded-xl p-4 border border-accent/10 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trophy size={16} className="text-gold" />
          Betting Identity
        </h2>

        <div>
          <label className="text-xs text-muted-dark block mb-2">Favorite Sports (select up to 6)</label>
          <div className="flex flex-wrap gap-2">
            {SPORTS_OPTIONS.map((sport) => (
              <button
                key={sport}
                onClick={() => toggleSport(sport)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  profile.favorite_sports.includes(sport)
                    ? 'bg-accent text-background'
                    : 'bg-secondary text-muted-dark hover:text-white'
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-dark block mb-2">Betting Style</label>
          <div className="flex flex-wrap gap-2">
            {BETTING_STYLES.map((style) => (
              <button
                key={style}
                onClick={() => setProfile((p) => ({ ...p, betting_style: p.betting_style === style ? '' : style }))}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  profile.betting_style === style
                    ? 'bg-gold/20 text-gold'
                    : 'bg-secondary text-muted-dark hover:text-white'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-dark block mb-2">Favorite Teams (up to 10)</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTeam()}
              placeholder="Add a team..."
              className="flex-1 bg-background border border-accent/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50"
            />
            <button
              onClick={addTeam}
              disabled={!newTeam.trim() || profile.favorite_teams.length >= 10}
              className="px-3 py-1.5 bg-accent/20 text-accent rounded-lg text-xs font-semibold hover:bg-accent/30 disabled:opacity-30"
            >
              Add
            </button>
          </div>
          {profile.favorite_teams.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.favorite_teams.map((team) => (
                <span key={team} className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-full text-xs text-white">
                  {team}
                  <button onClick={() => removeTeam(team)} className="text-muted-dark hover:text-loss ml-1">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-card rounded-xl p-4 border border-accent/10 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Link2 size={16} className="text-accent" />
          Social Links
        </h2>

        {(['twitter', 'instagram', 'youtube', 'tiktok', 'website'] as const).map((platform) => (
          <div key={platform}>
            <label className="text-xs text-muted-dark block mb-1 capitalize">{platform}</label>
            <input
              type="text"
              value={profile.social_links[platform] || ''}
              onChange={(e) => setProfile((p) => ({
                ...p,
                social_links: { ...p.social_links, [platform]: e.target.value },
              }))}
              placeholder={platform === 'website' ? 'https://yoursite.com' : `@username or URL`}
              className="w-full bg-background border border-accent/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50"
            />
          </div>
        ))}
      </div>

      {/* Save Button Bottom */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
