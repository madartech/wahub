// PWA Install Prompt Handler

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstalled = false;

// Check if app is already installed
if (window.matchMedia('(display-mode: standalone)').matches) {
  isInstalled = true;
}

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  // Dispatch custom event to notify React components
  window.dispatchEvent(new CustomEvent('pwainstallable'));
});

// Listen for successful installation
window.addEventListener('appinstalled', () => {
  isInstalled = true;
  deferredPrompt = null;
  window.dispatchEvent(new CustomEvent('pwainstalled'));
});

export function canInstall(): boolean {
  return deferredPrompt !== null && !isInstalled;
}

export function isAppInstalled(): boolean {
  return isInstalled;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    return 'unavailable';
  }

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    isInstalled = true;
    deferredPrompt = null;
  }
  
  return outcome;
}