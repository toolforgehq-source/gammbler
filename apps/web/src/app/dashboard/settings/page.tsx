'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { profileAPI, connectionsAPI, stripeAPI, authAPI } from '@/lib/api';
import { Link2, Unlink, ExternalLink, CreditCard, LogOut, Shield, ShieldCheck, Trash2, Camera, X as XIcon } from 'lucide-react';
import VerifiedScorePassModal from '@/components/ui/VerifiedScorePassModal';

const PLATFORMS = [
  { key: 'draftkings', name: 'DraftKings', logo: '🟢' },
  { key: 'fanduel', name: 'FanDuel', logo: '🔵' },
  { key: 'betmgm', name: 'BetMGM', logo: '🟡' },
  { key: 'caesars', name: 'Caesars', logo: '🔴' },
  { key: 'espn_bet', name: 'ESPN Bet', logo: '🟤' },
  { key: 'pointsbet', name: 'PointsBet', logo: '⚫' },
  { key: 'prizepicks', name: 'PrizePicks', logo: '🟣' },
  { key: 'underdog', name: 'Underdog', logo: '🟠' },
];

interface Connection {
  platform: string;
  connected_at: string;
  last_synced_at: string | null;
}

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPro = user?.tier === 'pro' || user?.subscription_status === 'active' || user?.subscription_status === 'trialing';
  const hasVerifiedPass = user?.verified_score_pass || false;
  const canConnectSportsbook = isPro || hasVerifiedPass;

  useEffect(() => {
    connectionsAPI.list().then((res) => setConnections(res.data.connections || [])).catch(() => {});

    // Check for verified_pass success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified_pass') === 'success') {
      // Refresh user data to get updated verified_score_pass
      authAPI.me().then((res) => {
        if (res.data.user) {
          updateUser(res.data.user);
        }
      }).catch(() => {});
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/settings');
    }
  }, [updateUser]);

  const toggleProfile = async () => {
    setSaving(true);
    try {
      const newVal = !isPublic;
      await profileAPI.update({ is_profile_public: newVal });
      setIsPublic(newVal);
      updateUser({ is_profile_public: newVal } as any);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const connectPlatform = async (platform: string) => {
    if (!canConnectSportsbook) {
      setShowPassModal(true);
      return;
    }
    try {
      const res = await connectionsAPI.initiate(platform);
      window.open(res.data.url, '_blank');
    } catch {
      alert('Failed to initiate connection. Make sure SharpSports is configured.');
    }
  };

  const disconnectPlatform = async (platform: string) => {
    try {
      await connectionsAPI.disconnect(platform);
      setConnections((prev) => prev.filter((c) => c.platform !== platform));
    } catch {
      // ignore
    }
  };

  const syncPlatform = async (platform: string) => {
    try {
      const res = await connectionsAPI.sync(platform);
      alert(`Synced ${res.data.imported} new bets`);
    } catch {
      // ignore
    }
  };

  const currentAvatarUrl = user?.avatar_url || null;
  useEffect(() => {
    setAvatarUrl(currentAvatarUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAvatarUrl]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    setUploadingAvatar(true);
    try {
      const res = await profileAPI.uploadAvatar(file);
      setAvatarUrl(res.data.avatar_url);
      updateUser({ avatar_url: res.data.avatar_url });
    } catch {
      alert('Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await profileAPI.removeAvatar();
      setAvatarUrl(null);
      updateUser({ avatar_url: null });
    } catch {
      alert('Failed to remove photo');
    }
  };

  const manageBilling = async () => {
    try {
      const res = await stripeAPI.createPortal();
      window.location.href = res.data.url;
    } catch {
      // might need to create checkout instead
      try {
        const res = await stripeAPI.createCheckout();
        window.location.href = res.data.url;
      } catch {
        alert('Billing not configured');
      }
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await authAPI.deleteAccount();
      logout();
    } catch {
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Profile Photo */}
      <section className="bg-card border border-accent/20 rounded-lg p-6">
        <h2 className="text-lg uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Profile Photo
        </h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-2xl overflow-hidden" style={{ fontFamily: 'var(--font-display)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.username?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            {avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                className="absolute -top-1 -right-1 w-5 h-5 bg-loss rounded-full flex items-center justify-center"
                title="Remove photo"
              >
                <XIcon size={12} className="text-white" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors text-sm font-semibold disabled:opacity-50"
            >
              <Camera size={16} />
              {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
            </button>
            <p className="text-xs text-muted-dark">JPEG, PNG, or WebP · Max 2MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="bg-card border border-accent/20 rounded-lg p-6">
        <h2 className="text-lg uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Account
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-dark">Email</span>
            <span className="text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-dark">Username</span>
            <span className="text-white">@{user?.username}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-dark">Subscription</span>
            <span className={`capitalize ${
              user?.subscription_status === 'active' ? 'text-win' :
              user?.subscription_status === 'trialing' ? 'text-accent' :
              'text-loss'
            }`}>
              {user?.subscription_status || 'trialing'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-dark">Verified Score Pass</span>
            {hasVerifiedPass || isPro ? (
              <span className="inline-flex items-center gap-1 text-accent text-sm font-semibold">
                <ShieldCheck size={14} />
                {isPro ? 'Included with Pro' : 'Active'}
              </span>
            ) : (
              <button
                onClick={() => setShowPassModal(true)}
                className="text-xs bg-accent/20 text-accent px-3 py-1 rounded hover:bg-accent/30 transition-colors font-semibold"
              >
                Get Verified — $4.99
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-card border border-accent/20 rounded-lg p-6">
        <h2 className="text-lg uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          <Shield size={18} className="inline mr-2" />Privacy
        </h2>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-white">Public Profile</p>
            <p className="text-xs text-muted-dark">When on, others can see your full stats and score breakdown</p>
          </div>
          <button
            onClick={toggleProfile}
            disabled={saving}
            className={`w-12 h-6 rounded-full transition-colors relative ${isPublic ? 'bg-accent' : 'bg-secondary'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${isPublic ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </section>

      {/* Sportsbook Connections */}
      <section className="bg-card border border-accent/20 rounded-lg p-6">
        <h2 className="text-lg uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          <Link2 size={18} className="inline mr-2" />Sportsbook Connections
        </h2>
        <div className="space-y-3">
          {PLATFORMS.map((p) => {
            const isConnected = connectedPlatforms.has(p.key);
            const conn = connections.find((c) => c.platform === p.key);
            return (
              <div key={p.key} className="flex items-center justify-between py-3 border-b border-accent/10 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{p.logo}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    {isConnected && conn?.last_synced_at && (
                      <p className="text-xs text-muted-dark">
                        Last synced: {new Date(conn.last_synced_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {isConnected ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => syncPlatform(p.key)}
                      className="text-xs text-accent hover:text-accent-light px-3 py-1.5 border border-accent/20 rounded"
                    >
                      Sync
                    </button>
                    <button
                      onClick={() => disconnectPlatform(p.key)}
                      className="text-xs text-loss hover:text-red-400 px-3 py-1.5 border border-loss/20 rounded"
                    >
                      <Unlink size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => connectPlatform(p.key)}
                    className="text-xs bg-accent/20 text-accent px-4 py-1.5 rounded hover:bg-accent/30 transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Billing */}
      <section className="bg-card border border-accent/20 rounded-lg p-6">
        <h2 className="text-lg uppercase tracking-wider font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          <CreditCard size={18} className="inline mr-2" />Billing
        </h2>
        <button
          onClick={manageBilling}
          className="flex items-center gap-2 text-sm bg-accent/20 text-accent px-4 py-2 rounded-lg hover:bg-accent/30 transition-colors"
        >
          Manage Subscription <ExternalLink size={14} />
        </button>
      </section>

      {/* Sign Out & Delete */}
      <div className="flex items-center justify-between">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-loss hover:text-red-400 transition-colors"
        >
          <LogOut size={16} /> Sign Out
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 text-sm text-muted-dark hover:text-loss transition-colors"
        >
          <Trash2 size={16} /> Delete Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-accent/20 rounded-lg p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              Delete Account
            </h3>
            <p className="text-sm text-muted-dark">
              This action is permanent and cannot be undone. All your data, bets, scores, and badges will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-sm border border-accent/20 rounded-lg text-white hover:bg-accent/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm bg-loss text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      <VerifiedScorePassModal
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        onCsvUpload={() => router.push('/dashboard/add-bet')}
      />
    </div>
  );
}
