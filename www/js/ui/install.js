// "Install on your phone": a small card on the website only, until you install or close it.
import { refs } from '../core/util.js';
import { load, save } from '../core/storage.js';
import { ICONS } from './components.js';

export function mount(container) {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || load('install-dismissed', false)) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const panel = document.createElement('div');
  panel.className = 'card install-card';
  panel.innerHTML = `
    <div class="card-head"><h3>Install on your phone</h3><button class="icon-btn" data-ref="close" aria-label="Hide install tip">${ICONS.x}</button></div>
    <p class="small soft">${ios ? 'Safari: Share, then Add to Home Screen.' : 'Chrome: menu, then Install app.'}</p>
    <button class="btn line block hidden" data-ref="install" style="margin-top:10px">Install app</button>`;
  container.appendChild(panel);
  const r = refs(panel);
  r.close.onclick = () => { save('install-dismissed', true); panel.remove(); };

  let prompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; r.install.classList.remove('hidden'); });
  r.install.onclick = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    r.install.classList.add('hidden');
  };
}
