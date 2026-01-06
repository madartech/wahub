import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { gatewayService } from '@/services/gateway';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function AddUser() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userName, setUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateUser = async () => {
    if (!userName.trim()) {
      setError('Please enter a user name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await gatewayService.createUser(userName.trim());
      
      toast({
        title: 'User created',
        description: `${result.name} has been created successfully`,
      });
      
      navigate('/users');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add WhatsApp User</h1>
        <p className="text-muted-foreground">Create a new WhatsApp user</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Create User</CardTitle>
          <CardDescription>Enter the user's name to create their gateway account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">User Name</Label>
            <Input
              id="name"
              placeholder="e.g., John Doe"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isCreating}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
            />
          </div>

          <Button 
            onClick={handleCreateUser} 
            disabled={isCreating || !userName.trim()}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create User'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
