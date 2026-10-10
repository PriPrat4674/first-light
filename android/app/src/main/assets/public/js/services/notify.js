// System notifications. Only shown when the app is in the background.

export const supported = () => 'Notification' in window;
export const permission = () => (supported() ? Notification.permission : 'unsupported');

export async function requestPermission() {
  if (supported() && Notification.permission === 'default') await Notification.requestPermission();
  return permission();
}

export async function notify(title, body) {
  if (!document.hidden || permission() !== 'granted') return;
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [500, 200, 500], requireInteraction: true, tag: 'first-light' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, opts); else new Notification(title, opts);
  } catch (e) { console.warn('notify', e); }
}
