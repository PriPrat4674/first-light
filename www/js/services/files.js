// Getting a file out of the app: Android's share sheet in the app, the system share sheet on
// phones that support it, otherwise a normal download.
import * as native from './native.js';

export async function saveOrShare(blob, name, { title = 'Share', preferShare = false } = {}) {
  if (native.isNative()) return (await native.shareFile(blob, name, title)).ok ? 'shared' : 'failed';
  const file = new File([blob], name, { type: blob.type });
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const u = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: u, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
  return 'saved';
}
