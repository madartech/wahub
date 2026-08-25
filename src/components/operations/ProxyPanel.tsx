import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Globe, ChevronDown, ChevronUp, Shuffle, ShieldAlert } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { toast } from '@/hooks/use-toast';
import { ProxyDefaults, loadProxyDefaults, saveProxyDefaults } from '@/lib/proxy';

interface Props {
  onChanged: () => void;
}

export default function ProxyPanel({ onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<ProxyDefaults>(loadProxyDefaults());
  const [passwordConfigured, setPasswordConfigured] = useState<boolean | null>(null);
  const [notDeployed, setNotDeployed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await gatewayService.getProxyDefaults();
      if (!r.ok) {
        if (r.notDeployed) setNotDeployed(true);
        return;
      }
      const d = r.data as any;
      setPasswordConfigured(Boolean(d?.passwordConfigured));
      if (d?.defaults) {
        const merged = { ...loadProxyDefaults(), ...d.defaults };
        setCfg(merged);
        saveProxyDefaults(merged);
      }
    })();
  }, []);

  const set = <K extends keyof ProxyDefaults>(k: K, v: ProxyDefaults[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setBusy(true);
    saveProxyDefaults(cfg);
    const r = await gatewayService.setProxyDefaults(cfg);
    setBusy(false);
    if (!r.ok) {
      toast({
        title: 'Save failed',
        description: r.notDeployed ? 'Proxy endpoints not deployed yet.' : r.error,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Proxy defaults saved' });
    onChanged();
  };

  const bulk = async () => {
    setBusy(true);
    const r = await gatewayService.bulkAssignProxy();
    setBusy(false);
    if (!r.ok) {
      toast({ title: 'Bulk assign failed', description: r.error, variant: 'destructive' });
      return;
    }
    const d = r.data as any;
    toast({
      title: 'Sticky IPs assigned',
      description: `${d?.count ?? 0} instances. Restart each to apply.`,
    });
    onChanged();
  };

  return (
    <Card className="p-3">
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4" /> Residential proxy
          {cfg.enabled ? (
            <Badge className="text-[10px]">ON</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">OFF</Badge>
          )}
          {notDeployed && (
            <Badge variant="outline" className="text-[10px] text-amber-600">not deployed</Badge>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {passwordConfigured === false && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>THORDATA_PROXY_PASSWORD</strong> is not set on the gateway. Add it to the
                gateway environment or proxying will be skipped.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-2">
            <div className="text-sm">Enable proxying globally</div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => set('enabled', v)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Host">
              <Input value={cfg.host} onChange={(e) => set('host', e.target.value)} className="text-xs" />
            </Field>
            <Field label="Port">
              <Input
                type="number"
                value={cfg.port}
                onChange={(e) => set('port', Number(e.target.value) || 9999)}
                className="text-xs"
              />
            </Field>
            <Field label="Username base">
              <Input
                value={cfg.usernameBase}
                onChange={(e) => set('usernameBase', e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Country code">
              <Input
                value={cfg.country}
                onChange={(e) => set('country', e.target.value.toUpperCase().slice(0, 2))}
                placeholder="OM"
                className="text-xs"
              />
            </Field>
            <Field label="Sticky minutes (max 1440)">
              <Input
                type="number"
                min={1}
                max={1440}
                value={cfg.sessTime}
                onChange={(e) => set('sessTime', Math.min(1440, Math.max(1, Number(e.target.value) || 1440)))}
                className="text-xs"
              />
            </Field>
            <Field label="Extra targeting (optional)">
              <Input
                value={cfg.extraSegments || ''}
                onChange={(e) => set('extraSegments', e.target.value)}
                placeholder="state-Muscat-city-Muscat"
                className="font-mono text-xs"
              />
            </Field>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Leave extra targeting empty for the widest IP pool. Pinning an ASN shrinks the pool and
            causes IP reuse across instances.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={busy}>Save defaults</Button>
            <Button size="sm" variant="outline" onClick={bulk} disabled={busy}>
              <Shuffle className="mr-1 h-3 w-3" /> Assign sticky IPs to all
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
