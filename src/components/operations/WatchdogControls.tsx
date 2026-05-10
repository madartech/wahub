import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { gatewayService } from '@/services/gateway';
import { WatchdogUserConfig } from '@/types/gateway';
import { useToast } from '@/hooks/use-toast';
import ConfirmTypedDialog from './dialogs/ConfirmTypedDialog';
import WatchdogBadges from './WatchdogBadges';
import { GatewayUser } from '@/types/gateway';

interface Props {
  user: GatewayUser;
  cfg?: WatchdogUserConfig;
  onChanged: () => void;
  compact?: boolean;
}

export default function WatchdogControls({ user, cfg, onChanged, compact }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const apply = async (patch: { autoHeal?: boolean; autoReset?: boolean }) => {
    setBusy(true);
    const res = await gatewayService.setUserWatchdogConfig(user.id, patch);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Failed', description: res.error, variant: 'destructive' });
      return;
    }
    onChanged();
  };

  const failures = (cfg?.failures || []).length;
  const lastAction = cfg?.lastAction;

  return (
    <div className={compact ? 'space-y-1 text-xs' : 'space-y-1.5 text-xs'}>
      <label className="flex items-center gap-2">
        <Switch
          checked={cfg?.autoHeal !== false}
          disabled={busy}
          onCheckedChange={(v) => apply({ autoHeal: v })}
        />
        Auto-heal
      </label>
      <label className="flex items-center gap-2">
        <Switch
          checked={cfg?.autoReset === true}
          disabled={busy}
          onCheckedChange={(v) => {
            if (v) setConfirmReset(true);
            else apply({ autoReset: false });
          }}
        />
        Auto-reset <span className="text-amber-600">⚠</span>
      </label>
      <WatchdogBadges user={user} cfg={cfg} />
      {(failures > 0 || lastAction) && (
        <div className="text-[10px] text-muted-foreground">
          {failures > 0 && <>Failures: {failures}</>}
          {lastAction && (
            <> · {lastAction.action} {new Date(lastAction.at).toLocaleTimeString()}</>
          )}
        </div>
      )}
      <ConfirmTypedDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Enable auto-reset"
        description="Auto-reset removes the container and deletes this instance's session folder when repeated failures occur. WhatsApp will need a fresh QR scan."
        confirmWord="ENABLE"
        onConfirm={async () => { await apply({ autoReset: true }); setConfirmReset(false); }}
      />
    </div>
  );
}
