import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { gatewayService } from '@/services/gateway';
import { useToast } from '@/hooks/use-toast';
import { Activity, Users, RefreshCw, ArrowRight, Link, Copy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
export default function Dashboard() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const gatewayUrl = gatewayService.getGatewayUrl();

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(gatewayUrl);
    toast({
      title: 'Copied',
      description: 'Gateway URL copied to clipboard',
    });
  };
  const checkHealth = async () => {
    setIsChecking(true);
    const result = await gatewayService.checkHealth();
    setIsOnline(result.ok);
    setIsChecking(false);
  };
  const fetchUsersCount = async () => {
    const result = await gatewayService.getUsers();
    if (result.ok) {
      setUsersCount(result.users.length);
      setUsersError(null);
    } else {
      setUsersError(result.error || 'Failed to load users');
    }
  };
  useEffect(() => {
    checkHealth();
    fetchUsersCount();
  }, []);
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Gateway status and overview</p>
      </div>

      {/* Gateway URL Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg font-medium">Gateway URL</CardTitle>
            <CardDescription>Endpoint for sending WhatsApp messages</CardDescription>
          </div>
          <Link className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
              {gatewayUrl}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Health Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-medium">Gateway Status</CardTitle>
              <CardDescription>Backend health check</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOnline === null ? <Badge variant="secondary">Checking...</Badge> : isOnline ? <Badge className="bg-success text-success-foreground">Online</Badge> : <Badge variant="destructive">Offline</Badge>}
                <span className="text-sm text-muted-foreground">
                  {isOnline === null ? 'Checking gateway...' : isOnline ? 'Gateway is responding' : 'Gateway is not responding'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={checkHealth} disabled={isChecking}>
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg font-medium">Users</CardTitle>
              <CardDescription>Provisioned WhatsApp users</CardDescription>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                {usersError ? <p className="text-sm text-destructive">{usersError}</p> : usersCount === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-9 w-12" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ) : <>
                    <div className="text-3xl font-bold">{usersCount}</div>
                    <p className="text-sm text-muted-foreground">Registered users</p>
                  </>}
              </div>
              <Button onClick={() => navigate('/users')} className="w-full lg:w-auto">
                View Users
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
}