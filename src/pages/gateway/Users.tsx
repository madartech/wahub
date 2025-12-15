import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { gatewayService } from '@/services/gateway';
import { GatewayUser } from '@/types/gateway';
import { useToast } from '@/hooks/use-toast';
import { Plus, Eye, Copy, Trash2 } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState<GatewayUser[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', instance: '', token: '' });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setUsers(gatewayService.getUsers());
  }, []);

  const maskToken = (token: string) => {
    if (token.length <= 10) return '***********';
    return `${token.slice(0, 6)}${'*'.repeat(10)}`;
  };

  const handleCopyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    toast({
      title: 'Copied',
      description: 'Token copied to clipboard',
    });
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.instance || !newUser.token) {
      toast({
        title: 'Error',
        description: 'All fields are required',
        variant: 'destructive',
      });
      return;
    }

    gatewayService.addUser(newUser);
    setUsers(gatewayService.getUsers());
    setNewUser({ name: '', instance: '', token: '' });
    setIsDialogOpen(false);
    toast({
      title: 'User added',
      description: `${newUser.name} has been added successfully`,
    });
  };

  const handleDeleteUser = (id: string, name: string) => {
    gatewayService.deleteUser(id);
    setUsers(gatewayService.getUsers());
    toast({
      title: 'User deleted',
      description: `${name} has been removed`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage gateway users and tokens</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new gateway user with instance and token
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">User Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., User 3"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instance">WhatsApp Instance</Label>
                <Input
                  id="instance"
                  placeholder="e.g., u3"
                  value={newUser.instance}
                  onChange={(e) => setNewUser({ ...newUser, instance: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">Gateway Token</Label>
                <Input
                  id="token"
                  placeholder="e.g., token_user3_secret"
                  value={newUser.token}
                  onChange={(e) => setNewUser({ ...newUser, token: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser}>Add User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? 's' : ''} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>WhatsApp Instance</TableHead>
                <TableHead>Gateway Token</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-sm">
                      {user.instance}
                    </code>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                      {maskToken(user.token)}
                    </code>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/users/${user.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyToken(user.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No users found. Add your first user.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
