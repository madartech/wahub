import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { gatewayService } from '@/services/gateway';
import { Activity, Users, RefreshCw, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [usersCount, setUsersCount] = useState(0);
  const navigate = useNavigate();

  const checkHealth = async () => {
    setIsChecking(true);
    const result = await gatewayService.checkHealth();
    setIsOnline(result.ok);
    setIsChecking(false);
  };

  useEffect(() => {
    checkHealth();
    setUsersCount(gatewayService.getUsers().length);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Gateway status and overview</p>
      </div>

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
                {isOnline === null ? (
                  <Badge variant="secondary">Checking...</Badge>
                ) : isOnline ? (
                  <Badge className="bg-success text-success-foreground">Online</Badge>
                ) : (
                  <Badge variant="destructive">Offline</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {isOnline === null 
                    ? 'Checking gateway...' 
                    : isOnline 
                      ? 'Gateway is responding' 
                      : 'Gateway is not responding'}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={checkHealth}
                disabled={isChecking}
              >
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
              <CardDescription>Registered gateway users</CardDescription>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{usersCount}</div>
                <p className="text-sm text-muted-foreground">Active users</p>
              </div>
              <Button onClick={() => navigate('/users')}>
                View Users
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
