import { useCallback, useState } from 'react';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function usePushSubscription(opts: { vapidPublicKey: string; swPath: string }) {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');

  const subscribe = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      setStatus('error');
      return;
    }
    setStatus('subscribing');
    try {
      const registration = await navigator.serviceWorker.register(opts.swPath);
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(opts.vapidPublicKey),
      });
      setSubscription(sub as unknown as PushSubscription);
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }, [opts.swPath, opts.vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    setSubscription(null);
    setStatus('idle');
  }, []);

  return { subscription, status, subscribe, unsubscribe };
}
