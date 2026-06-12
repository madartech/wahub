import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { statusCache } from '@/services/statusCache';

import { GatewayUser, getConnectionState, UserConnectionState } from '@/types/gateway';
import { Plus, Eye, Loader2, AlertCircle, RefreshCw, Trash2, Pencil, Check, X, Unplug, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { PullToRefresh } from '@/components/PullToRefresh';
import EmergencyResetDialog from '@/components/gateway/EmergencyResetDialog';

interface UserItemProps {
  user: GatewayUser;
  index: number;
  connectionState: UserConnectionState;
  navigate: (path: string) => void;
  onDelete: (userId: string, userName: string) => void;
  onDisconnect: (userId: string, userName: string) => void;
  onReset: (userId: string, userName: string) => void;
  onUpdateName: (userId: string, newName: string) => Promise<void>;
  isDeleting: boolean;
  isDisconnecting: boolean;
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

  // Sync editValue when name prop changes (e.g., after refresh applies localStorage)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(name);
    }
  }, [name, isEditing]);

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
        className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 transition-opacity" 
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}

function UserCard({ user, index, connectionState, navigate, onDelete, onDisconnect, onReset, onUpdateName, isDeleting, isDisconnecting }: UserItemProps) {
  const isConnected = connectionState === 'connected';
  
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-mono">#{index}</span>
            <EditableName name={user.name} userId={user.id} onUpdateName={onUpdateName} />
          </div>
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

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate(`/users/${user.id}`)}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        
        {isConnected && (
          <Button 
            variant="outline" 
            size="sm" 
            className="text-warning hover:text-warning border-warning/30"
            onClick={() => onDisconnect(user.id, user.name)}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unplug className="h-4 w-4 mr-1" />}
            Disconnect
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          className="text-destructive hover:text-destructive border-destructive/30"
          onClick={() => onReset(user.id, user.name)}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
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

function UserRow({ user, index, connectionState, navigate, onDelete, onDisconnect, onReset, onUpdateName, isDeleting, isDisconnecting }: UserItemProps) {
  const isConnected = connectionState === 'connected';
  
  return (
    <TableRow className="h-10">
      <TableCell className="text-muted-foreground font-mono text-xs w-10 py-1.5">{index}</TableCell>
      <TableCell className="py-1.5">
        <EditableName name={user.name} userId={user.id} onUpdateName={onUpdateName} />
      </TableCell>
      <TableCell className="py-1.5">
        {user.phoneNumber ? (
          <span className="font-mono text-xs">{user.phoneNumber}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-1.5">
        {getStatusBadge(connectionState)}
      </TableCell>
      <TableCell className="py-1.5">
        {user.instanceId ? (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{user.instanceId}</code>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right py-1.5">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/users/${user.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          
          {isConnected && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-warning hover:text-warning" 
              onClick={() => onDisconnect(user.id, user.name)}
              disabled={isDisconnecting}
              title="Disconnect"
            >
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:text-destructive" 
            onClick={() => onReset(user.id, user.name)}
            title="Reset + Reconnect"
          >
            <RotateCcw className="h-4 w-4" />
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

const DISPLAY_NAMES_KEY = 'gateway_user_display_names';
const LAST_PHONES_KEY = 'gateway_user_last_phones';

function getStoredDisplayNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISPLAY_NAMES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveDisplayName(userId: string, name: string) {
  const stored = getStoredDisplayNames();
  stored[userId] = name;
  localStorage.setItem(DISPLAY_NAMES_KEY, JSON.stringify(stored));
}

function getStoredLastPhones(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_PHONES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLastPhone(userId: string, phone?: string | null) {
  if (!phone) return;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return;
  const stored = getStoredLastPhones();
  if (stored[userId] === digits) return;
  stored[userId] = digits;
  localStorage.setItem(LAST_PHONES_KEY, JSON.stringify(stored));
}


export default function Users() {
  const [users, setUsers] = useState<GatewayUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Scroll to top when page changes (especially helpful on mobile)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);
  const navigate = useNavigate();
  
  // Reset dialog state
  const [resetTarget, setResetTarget] = useState<{ userId: string; userName: string } | null>(null);
  
  // Track the current fetch operation to prevent race conditions
  const fetchIdRef = useRef(0);

  const fetchUsersWithStatus = useCallback(async (isAutoRefresh = false) => {
    const currentFetchId = ++fetchIdRef.current;
    
    if (!isAutoRefresh) {
      setIsLoading(true);
    }
    setError(null);

    const result = await gatewayService.getUsers();
    
    if (currentFetchId !== fetchIdRef.current) return;
    
    if (!result.ok) {
      setError(result.error || 'Failed to fetch users');
      setIsLoading(false);
      return;
    }

    const storedNames = getStoredDisplayNames();
    const storedPhones = getStoredLastPhones();
    setUsers((prev) => {
      const prevById = new Map(prev.map((u) => [u.id, u] as const));
      return result.users.map((user) => {
        const prevUser = prevById.get(user.id);
        const phone =
          prevUser?.phoneNumber ??
          (user as GatewayUser).phoneNumber ??
          storedPhones[user.id] ??
          null;
        saveLastPhone(user.id, phone);
        return {
          ...user,
          name: storedNames[user.id] || user.name,
          sessionStatus: prevUser?.sessionStatus ?? user.sessionStatus ?? 'UNKNOWN',
          phoneNumber: phone,
          me: prevUser?.me ?? (user as GatewayUser).me ?? null,
        } as GatewayUser;
      });
    });

    setIsLoading(false);

    void (async () => {
      const usersToFetch = [...result.users];
      const concurrency = 4;
      let index = 0;

      await Promise.all(
        Array.from({ length: Math.min(concurrency, usersToFetch.length) }, async () => {
          while (index < usersToFetch.length) {
            if (currentFetchId !== fetchIdRef.current) return;
            
            const user = usersToFetch[index++];
            try {
              const statusResult = await gatewayService.getUserStatus(user.id);
              
              if (currentFetchId !== fetchIdRef.current) return;
              
              const newStatus = statusResult.session?.status || 'UNKNOWN';
              statusCache.set(user.id, newStatus);
              saveLastPhone(user.id, statusResult.phoneNumber || statusResult.me?.id);
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === user.id
                    ? {
                        ...u,
                        sessionStatus: newStatus,
                        phoneNumber: statusResult.phoneNumber || u.phoneNumber,
                        me: statusResult.me,
                      }
                    : u
                )
              );
            } catch {
              // keep existing status/phone
            }

          }
        })
      );
    })();
  }, []);


  const handleDelete = async (userId: string, userName: string) => {
    setIsDeleting(true);
    try {
      await gatewayService.deleteUser(userId);
      toast.success(`Deleted ${userName}`);
      fetchUsersWithStatus(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDisconnect = async (userId: string, userName: string) => {
    setIsDisconnecting(true);
    try {
      // Consolidated: use Operations endpoint (stops Docker container)
      const op = await gatewayService.stopInstance(userId);
      if (!op.ok) {
        throw new Error(op.error || 'Failed to disconnect');
      }
      toast.success(`Disconnected ${userName}`);
      // Auto-refresh status after 5s (container takedown propagation)
      setTimeout(() => fetchUsersWithStatus(true), 5000);
      fetchUsersWithStatus(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      toast.error(errorMessage);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReset = (userId: string, userName: string) => {
    setResetTarget({ userId, userName });
  };

  const handleUpdateName = async (userId: string, newName: string) => {
    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: newName } : u));
    
    try {
      await gatewayService.updateUser(userId, newName);
      // Remove localStorage override since backend now has the correct name
      const stored = getStoredDisplayNames();
      delete stored[userId];
      localStorage.setItem(DISPLAY_NAMES_KEY, JSON.stringify(stored));
      toast.success('Display name updated');
    } catch {
      // Fallback to localStorage if backend doesn't support it
      saveDisplayName(userId, newName);
      toast.success('Display name updated locally');
    }
  };

  useEffect(() => {
    fetchUsersWithStatus(false);
  }, [fetchUsersWithStatus]);

  const handlePullRefresh = useCallback(async () => {
    await fetchUsersWithStatus(true);
    toast.success('Refreshed');
  }, [fetchUsersWithStatus]);

  const lastPhones = useMemo(() => getStoredLastPhones(), [users]);

  const filteredUsers = users.filter((user) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    if (user.name.toLowerCase().includes(q)) return true;
    const currentPhone = (user.phoneNumber || '').toLowerCase();
    if (currentPhone && currentPhone.includes(q)) return true;
    if (qDigits) {
      const currentDigits = currentPhone.replace(/\D/g, '');
      if (currentDigits && currentDigits.includes(qDigits)) return true;
      const lastDigits = lastPhones[user.id];
      if (lastDigits && lastDigits.includes(qDigits)) return true;
    }
    return false;
  });


  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  return (
    <>
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-sm text-muted-foreground">Manage WhatsApp users and provisioning</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchUsersWithStatus(false)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/users/new')}>
              <Plus className="h-4 w-4" />
              <span className="ml-2">Add User</span>
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
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between" />
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
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
            ) : filteredUsers.length === 0 && !error ? (
              <div className="text-center text-muted-foreground py-8">
                {users.length === 0 ? 'No users found. Add your first WhatsApp user.' : 'No users match your search.'}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {paginatedUsers.map((user, idx) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      index={(safeCurrentPage - 1) * PAGE_SIZE + idx + 1}
                      connectionState={getConnectionState(user.sessionStatus)}
                      navigate={navigate}
                      onDelete={handleDelete}
                      onDisconnect={handleDisconnect}
                      onReset={handleReset}
                      onUpdateName={handleUpdateName}
                      isDeleting={isDeleting}
                      isDisconnecting={isDisconnecting}
                    />
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-9">
                        <TableHead className="w-10 py-1.5">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Instance</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((user, idx) => (
                        <UserRow
                          key={user.id}
                          user={user}
                          index={(safeCurrentPage - 1) * PAGE_SIZE + idx + 1}
                          connectionState={getConnectionState(user.sessionStatus)}
                          navigate={navigate}
                          onDelete={handleDelete}
                          onDisconnect={handleDisconnect}
                          onReset={handleReset}
                          onUpdateName={handleUpdateName}
                          isDeleting={isDeleting}
                          isDisconnecting={isDisconnecting}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <p className="text-sm text-muted-foreground">
                      {(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={safeCurrentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={page === safeCurrentPage ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8 text-xs"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={safeCurrentPage >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PullToRefresh>

    {/* Reset + Reconnect Dialog */}
    {resetTarget && (
      <EmergencyResetDialog
        open={!!resetTarget}
        onOpenChange={(open) => { if (!open) setResetTarget(null); }}
        userId={resetTarget.userId}
        userName={resetTarget.userName}
        onSuccess={() => fetchUsersWithStatus(true)}
      />
    )}
    </>
  );
}
