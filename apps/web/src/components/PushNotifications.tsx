'use client';

import { useEffect, useState } from 'react';
import { notificationsAPI } from '@/lib/api';
import { Bell, X } from 'lucide-react';

export default function PushNotifications() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    // Don't show prompt if already decided
    const dismissed = localStorage.getItem('gammbler_push_dismissed');
    if (dismissed) return;

    // Check current permission
    if (Notification.permission === 'granted') {
      registerPush();
      return;
    }

    if (Notification.permission === 'denied') return;

    // Show prompt after a short delay (don't interrupt onboarding)
    const timer = setTimeout(() => setShowPrompt(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  async function registerPush() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidRes = await notificationsAPI.vapidKey();
      const publicKey = vapidRes.data.publicKey;
      if (!publicKey) return;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        });
      }

      await notificationsAPI.pushSubscribe(sub);
      setSubscribed(true);
    } catch {
      // push registration failed silently
    }
  }

  async function handleEnable() {
    setShowPrompt(false);
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await registerPush();
    } else {
      localStorage.setItem('gammbler_push_dismissed', '1');
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    localStorage.setItem('gammbler_push_dismissed', '1');
  }

  if (!showPrompt || subscribed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-card border border-accent/30 rounded-lg p-4 shadow-lg">
      <button onClick={handleDismiss} className="absolute top-2 right-2 text-muted-dark hover:text-white">
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="bg-accent/20 p-2 rounded-lg">
          <Bell size={20} className="text-accent" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Enable notifications?</p>
          <p className="text-xs text-muted-dark mt-1">
            Get notified about challenges, score milestones, and more — even when you&apos;re not on the site.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEnable}
              className="text-xs bg-accent text-background px-3 py-1.5 rounded font-medium hover:bg-accent-light transition-colors"
            >
              Enable
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-muted-dark hover:text-white px-3 py-1.5 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
