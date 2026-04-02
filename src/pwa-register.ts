import { registerSW } from 'virtual:pwa-register';

const BANNER_ID = 'cubedex-pwa-update-banner';

function removeUpdateBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

function showUpdateBanner(updateSW: (reloadPage?: boolean) => Promise<void>): void {
  if (document.getElementById(BANNER_ID)) return;

  const darkMode = isDarkMode();

  const bar = document.createElement('div');
  bar.id = BANNER_ID;
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  Object.assign(bar.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '60',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
    borderBottom: darkMode ? '1px solid #374151' : '1px solid #e5e7eb',
    background: darkMode ? '#1f2937' : '#ffffff',
    color: darkMode ? '#ffffff' : '#111827',
  });

  const msg = document.createElement('p');
  msg.textContent = 'A new version of Cubedex is available. Refresh now?';
  Object.assign(msg.style, {
    margin: '0',
    textAlign: 'center',
    fontSize: '0.95rem',
  });

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    flexShrink: '0',
    gap: '0.5rem',
  });

  const later = document.createElement('button');
  later.type = 'button';
  later.textContent = 'Later';
  later.addEventListener('click', removeUpdateBanner);
  Object.assign(later.style, {
    fontWeight: '700',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '0',
    cursor: 'pointer',
    background: darkMode ? '#4b5563' : '#e5e7eb',
    color: darkMode ? '#ffffff' : '#111827',
  });

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh';
  refresh.addEventListener('click', () => {
    void updateSW(true);
  });
  Object.assign(refresh.style, {
    fontWeight: '700',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '0',
    cursor: 'pointer',
    background: '#3b82f6',
    color: '#ffffff',
  });

  actions.append(later, refresh);
  bar.append(msg, actions);
  document.body.append(bar);
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdateBanner(updateSW);
  },
  onOfflineReady() {},
  onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
    void registration?.update();
  },
});

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.ready.then((reg) => {
    if (reg.waiting) {
      showUpdateBanner(updateSW);
    }
    reg.addEventListener('updatefound', () => {
      const inst = reg.installing;
      if (!inst) return;
      inst.addEventListener('statechange', () => {
        if (inst.state === 'installed' && navigator.serviceWorker.controller && reg.waiting) {
          showUpdateBanner(updateSW);
        }
      });
    });
  });
}
