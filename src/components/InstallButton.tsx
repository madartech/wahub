import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Check } from 'lucide-react';
import { canInstall, isAppInstalled, promptInstall } from '@/lib/pwa';

export function InstallButton() {
  const [installable, setInstallable] = useState(canInstall());
  const [installed, setInstalled] = useState(isAppInstalled());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const handleInstallable = () => setInstallable(true);
    const handleInstalled = () => {
      setInstalled(true);
      setInstallable(false);
    };

    window.addEventListener('pwainstallable', handleInstallable);
    window.addEventListener('pwainstalled', handleInstalled);

    return () => {
      window.removeEventListener('pwainstallable', handleInstallable);
      window.removeEventListener('pwainstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    const result = await promptInstall();
    setIsInstalling(false);
    
    if (result === 'accepted') {
      setInstalled(true);
      setInstallable(false);
    }
  };

  // Only show on desktop (hidden on mobile via md:flex)
  if (installed) {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 text-success text-sm">
        <Check className="h-4 w-4" />
        <span>Installed</span>
      </div>
    );
  }

  if (!installable) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleInstall}
      disabled={isInstalling}
      className="hidden md:flex gap-2"
    >
      <Download className="h-4 w-4" />
      <span>Install App</span>
    </Button>
  );
}