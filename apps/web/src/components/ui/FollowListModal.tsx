'use client';

import { useEffect, useState } from 'react';
import { X, Users } from 'lucide-react';
import { profileAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface FollowUser {
  id: string;
  username: string;
  avatar_url: string | null;
  followed_at: string;
}

interface FollowListModalProps {
  username: string;
  type: 'followers' | 'following';
  onClose: () => void;
}

export default function FollowListModal({ username, type, onClose }: FollowListModalProps) {
  const router = useRouter();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = type === 'followers'
          ? await profileAPI.followers(username)
          : await profileAPI.following(username);
        setUsers(type === 'followers' ? res.data.followers : res.data.following);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [username, type]);

  const handleUserClick = (clickedUsername: string) => {
    onClose();
    router.push(`/dashboard/profile/${clickedUsername}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-card border border-accent/20 rounded-lg w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-accent/10">
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {type === 'followers' ? 'Followers' : 'Following'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent/10 text-muted hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-dark">
              <Users size={24} className="mb-2 opacity-50" />
              <p className="text-sm">No {type} yet</p>
            </div>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleUserClick(u.username)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/10 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0 overflow-hidden">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    u.username[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">@{u.username}</p>
                  <p className="text-xs text-muted-dark">
                    {type === 'followers' ? 'Followed' : 'Following since'}{' '}
                    {new Date(u.followed_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
