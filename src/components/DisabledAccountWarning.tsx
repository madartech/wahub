import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function DisabledAccountWarning() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Account Disabled</h1>
        <p className="text-muted-foreground mb-6">
          Your subscription is disabled. Please contact the administrator to reactivate your account.
        </p>
        <Button variant="outline" onClick={handleLogout}>
          Back to Login
        </Button>
      </div>
    </div>
  );
}
