import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { GatewayUser, getConnectionState, UserConnectionState } from '@/types/gateway';
import { Plus, Eye, Loader2, AlertCircle, RefreshCw, Trash2, Pencil, Check, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface UserItemProps {
  user: GatewayUser;
  connectionState: UserConnectionState;
  navigate: (path: string) => void;
  onDelete: (userId: string, userName: string) => void;
  onUpdateName: (userId: string, newName: string) => Promise<void>;
  isDeleting: boolean;
}

function getStatusBadge(state: UserConnectionState) {
  switch (state) {
    case 'connected':
      return <Badge className="bg-success text-success-foreground">Connected</Badge>;
    case 'scan_qr':
      return <Badge className="bg-warning text-warning-foreground">Scan QR</Badge>;
    case 'provisioning':
      return <Badge variant="secondary">Provisioning...</Badge>;
    case 'not_provisioned':
    default:
      return <Badge variant="secondary">Not Provisioned</Badge>;
  }
}

function EditableName({ 
  name, 
  userId, 
  onUpdateName 
}: { 
  name: string; 
  userId: string; 
  onUpdateName: (userId: string, newName: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editValue.trim() || editValue.trim() === name) {
      setIsEditing(false);
      setEditValue(name);
      return;
    }
    
    setIsSaving(true);
    try {
      await onUpdateName(userId, editValue.trim());
      setIsEditing(false);
    } catch {
      setEditValue(name);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-32 text-sm"
          autoFocus
          disabled={isSaving}
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6" 
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span className="font-medium">{name}</span>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}

function UserCard({ user, connectionState, navigate, onDelete, onUpdateName, isDeleting }: UserItemProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <EditableName name={user.name} userId={user.id} onUpdateName={onUpdateName} />
          {user.phoneNumber && (
            <p className="font-mono text-sm text-muted-foreground">{user.phoneNumber}</p>
          )}
        </div>
        {getStatusBadge(connectionState)}
      </div>

      <div className="space-y-2 text-sm">
        {user.instanceId && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Instance:</span>
            <code className="rounded bg-muted px-2 py-0.5 text-xs">{user.instanceId}</code>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
        <Button variant="outline" size="sm" onClick={() => navigate(`/users/${user.id}`)}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive border-destructive/30">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
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
    </Card>
  );
}

function UserRow({ user, connectionState, navigate, onDelete, onUpdateName, isDeleting }: UserItemProps) {
  return (
    <TableRow>
      <TableCell>
        <EditableName name={user.name} userId={user.id} onUpdateName={onUpdateName} />
      </TableCell>
      <TableCell>
        {user.phoneNumber ? (
          <span className="font-mono text-sm">{user.phoneNumber}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {getStatusBadge(connectionState)}
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/users/${user.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
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
  const navigate = useNavigate();

  const fetchUsersWithStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // First get the users list
    const result = await gatewayService.getUsers();
    if (!result.ok) {
      setError(result.error || 'Failed to fetch users');
      setIsLoading(false);
      return;
    }

    // Then fetch status for each user in parallel
    const usersWithStatus = await Promise.all(
      result.users.map(async (user) => {
        try {
          const statusResult = await gatewayService.getUserStatus(user.id);
          return {
            ...user,
            sessionStatus: statusResult.session?.status || 'UNKNOWN',
            phoneNumber: statusResult.phoneNumber || user.phoneNumber,
            me: statusResult.me,
          } as GatewayUser;
        } catch {
          return {
            ...user,
            sessionStatus: 'UNKNOWN',
          } as GatewayUser;
        }
      })
    );

    setUsers(usersWithStatus);
    setIsLoading(false);
  }, []);

  const handleDelete = async (userId: string, userName: string) => {
    setIsDeleting(true);
    try {
      await gatewayService.deleteUser(userId);
      toast.success(`Deleted ${userName}`);
      fetchUsersWithStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateName = async (userId: string, newName: string) => {
    try {
      await gatewayService.updateUser(userId, newName);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: newName } : u));
      toast.success('Name updated');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update name';
      toast.error(errorMessage);
      throw err;
    }
  };

  useEffect(() => {
    fetchUsersWithStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchUsersWithStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchUsersWithStatus]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage WhatsApp users and provisioning</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsersWithStatus} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-2">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => navigate('/users/new')}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Add User</span>
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
            <>
              {/* Mobile Card Skeleton */}
              <div className="md:hidden space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-5 w-28" />
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-18" />
                    </div>
                  </Card>
                ))}
              </div>
              {/* Desktop Table Skeleton */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Instance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : users.length === 0 && !error ? (
            <div className="text-center text-muted-foreground py-8">
              No users found. Add your first WhatsApp user.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {users.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    connectionState={getConnectionState(user.sessionStatus)}
                    navigate={navigate}
                    onDelete={handleDelete}
                    onUpdateName={handleUpdateName}
                    isDeleting={isDeleting}
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Instance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        connectionState={getConnectionState(user.sessionStatus)}
                        navigate={navigate}
                        onDelete={handleDelete}
                        onUpdateName={handleUpdateName}
                        isDeleting={isDeleting}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
