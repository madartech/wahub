import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Globe, RefreshCw, Copy } from 'lucide-react';
import { GatewayUser, EffectiveProxy, EgressInfo } from '@/types/gateway';
import { gatewayService } from '@/services/gateway';
import { toast } from '@/hooks/use-toast';
import { deriveSessId, loadProxyDefaults, buildProxyUsername } from '@/lib/proxy';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: GatewayUser;
  onChanged: () => void;
}

export default function ProxyDialog({ open, onOpenChange, user, onChanged }: Props) {
  const defaults = loadProxyDefaults();
  const [enabled, setEnabled] = useState(true);
  const [sessId, setSessId] = useState(deriveSessId(user));
  const [effective, setEffective] = useState<EffectiveProxy | null>(null);
  const [egress, setEgress] = useState<EgressInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notDeployed, setNotDeployed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEgress(null);
    setNotDeployed(false);
    (async () => {
      setLoading(true);
      const r = await gatewayService.getUserProxy(user.id);
      setLoading(false);
      if (!r.ok) {
        if (r.notDeployed) setNotDeployed(true);
        return;
      }
      const d = r.data as any;
      if (d?.override) {
        setEnabled(d.override.enabled !== false);
        if (d.override.sessId) setSessId(d.override.sessId);
      }
      setEffective(d?.effective || null);
    })();
  }, [open, user.id]);

  const preview = buildProxyUsername(defaults, sessId);

  const save = async () => {
    setLoading(true);
    const r = await gatewayService.setUserProxy(user.id, { enabled, sessId });
    setLoading(false);
    if (!r.ok) {
      toast({
        title: 'Save failed',
        description: r.notDeployed ? 'Proxy endpoints not deployed yet.' : r.error,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Proxy saved', description: 'Restart or re-provision to apply.' });
    onChanged();
    onOpenChange(false);
  };

  const checkIp = async () => {
    setChecking(true);
    const r = await gatewayService.getEgressIp(user.id);
    setChecking(false);
    if (!r.ok) {
      toast({ title: 'Egress check failed', description: r.error, variant: 'destructive' });
      return;
    }
    const d = r.data as any;
    if (!d?.proxied) {
      setEgress(null);
      toast({ title: 'Not proxied', description: 'This instance uses the host IP.' });
      return;
    }
    setEgress(d.info || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> Proxy — {user.name}
          </DialogTitle>
          <DialogDescription>
            Routes this instance's WhatsApp traffic through its own sticky residential IP.
          </DialogDescription>
        </DialogHeader>

        {notDeployed && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            Proxy endpoints not deployed yet — apply <code>docs/gateway-proxy-patch.js</code> on the VPS.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Use proxy</div>
              <div className="text-xs text-muted-foreground">Off = direct host IP</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Session ID (sticky IP slot)</Label>
            <Input
              value={sessId}
              onChange={(e) => setSessId(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Derived from the instance ID so this user keeps the same IP slot across restarts.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Proxy username (password injected server-side)</Label>
            <div className="flex gap-1">
              <Input readOnly value={preview} className="font-mono text-[11px]" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(preview);
                  toast({ title: 'Copied' });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {defaults.host}:{defaults.port} · sticky {defaults.sessTime}m
            </p>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Current egress IP</span>
              <Button variant="outline" size="sm" onClick={checkIp} disabled={checking}>
                <RefreshCw className={checking ? 'mr-1 h-3 w-3 animate-spin' : 'mr-1 h-3 w-3'} /> Check
              </Button>
            </div>
            {egress ? (
              <div className="space-y-1 text-xs">
                <div className="font-mono text-sm">{egress.ip}</div>
                <div className="text-muted-foreground">
                  {[egress.city, egress.country].filter(Boolean).join(', ')} · {egress.org || egress.asn || '—'}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Not checked yet.</p>
            )}
            {effective && (
              <Badge variant="outline" className="font-mono text-[10px]">
                sessid-{effective.sessId}
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={async () => {
              await gatewayService.clearUserProxy(user.id);
              toast({ title: 'Override cleared', description: 'Falls back to global defaults.' });
              onChanged();
              onOpenChange(false);
            }}
          >
            Clear override
          </Button>
          <Button onClick={save} disabled={loading}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
