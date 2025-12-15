import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { gatewayService } from '@/services/gateway';
import { GatewayUser } from '@/types/gateway';
import { Plus, Eye, EyeOff, Loader2, AlertCircle, RefreshCw, Trash2, Copy, Key } from 'lucide-react';
import { toast } from 'sonner';

interface UserRowProps {
  user: GatewayUser;
  navigate: (path: string) => void;
  onDelete: (userId: string, userName: string) => void;
  isDeleting: boolean;
  revealedTokens: Record<string, string>;
  onRevealToken: (userId: string) => void;
  revealingTokenId: string | null;
}

function UserRow({ user, navigate, onDelete, isDeleting, revealedTokens, onRevealToken, revealingTokenId }: UserRowProps) {
  const [showToken, setShowToken] = useState(false);
  const revealedToken = revealedTokens[user.id];
  const isRevealing = revealingTokenId === user.id;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Token copied to clipboard');
  };
  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>
        {revealedToken ? (
          <div className="flex items-center gap-1">
            <code className="rounded bg-muted px-2 py-1 text-xs max-w-[140px] truncate">
              {showToken ? revealedToken : '••••••••••••••••'}
            </code>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(revealedToken)}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ) : user.tokenMasked ? (
          <div className="flex items-center gap-1">
            <code className="rounded bg-muted px-2 py-1 text-xs">{user.tokenMasked}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onRevealToken(user.id)}
              disabled={isRevealing}
            >
              {isRevealing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {user.phoneNumber ? (
          <span className="font-mono text-sm">{user.phoneNumber}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {user.provisioned ? (
          <Badge className="bg-success text-success-foreground">Yes</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        )}
      </TableCell>
      <TableCell>
        {user.instanceId ? (
          <code className="rounded bg-muted px-2 py-1 text-sm">{user.instanceId}</code>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/users/${user.id}`)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{user.name}</strong>? This will remove the user and their WhatsApp instance. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(user.id, user.name)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function Users() {
  const [users, setUsers] = useState<GatewayUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>({});
  const [revealingTokenId, setRevealingTokenId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    const result = await gatewayService.getUsers();
    if (result.ok) {
      setUsers(result.users);
    } else {
      setError(result.error || 'Failed to fetch users');
    }
    setIsLoading(false);
  };

  const handleDelete = async (userId: string, userName: string) => {
    setIsDeleting(true);
    try {
      await gatewayService.deleteUser(userId);
      toast.success(`Deleted ${userName}`);
      // Remove revealed token for deleted user
      setRevealedTokens(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      fetchUsers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevealToken = async (userId: string) => {
    setRevealingTokenId(userId);
    try {
      const result = await gatewayService.getUserToken(userId);
      setRevealedTokens(prev => ({ ...prev, [userId]: result.token }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reveal token';
      toast.error(errorMessage);
    } finally {
      setRevealingTokenId(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage WhatsApp users and provisioning</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/users/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add WhatsApp User
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? 's' : ''} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Provisioned</TableHead>
                  <TableHead>Instance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    navigate={navigate}
                    onDelete={handleDelete}
                    isDeleting={isDeleting}
                    revealedTokens={revealedTokens}
                    onRevealToken={handleRevealToken}
                    revealingTokenId={revealingTokenId}
                  />
                ))}
                {users.length === 0 && !error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No users found. Add your first WhatsApp user.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
