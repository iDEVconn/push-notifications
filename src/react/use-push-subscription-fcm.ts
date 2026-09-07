import { useCallback, useState } from 'react';

export function usePushSubscriptionFcm(opts: { firebaseConfig: object; vapidKey: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');

  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    setStatus('subscribing');
    try {
      const { initializeApp } = await import('firebase/app');
      const { getMessaging, getToken } = await import('firebase/messaging');
      const app = initializeApp(opts.firebaseConfig);
      const messaging = getMessaging(app);
      const fcmToken = await getToken(messaging, { vapidKey: opts.vapidKey });
      setToken(fcmToken);
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }, [opts.firebaseConfig, opts.vapidKey]);

  return { token, status, subscribe };
}
