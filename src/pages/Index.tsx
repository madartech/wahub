import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">WA Gateway</span>
          </div>
          <Link to="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            WhatsApp Gateway
            <span className="text-primary"> Dashboard</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8">
            Manage your WhatsApp messaging gateway with ease. Send texts, images, and documents programmatically.
          </p>
          <Link to="/login">
            <Button size="lg" className="px-8">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="mt-8 grid sm:grid-cols-3 gap-8 text-center max-w-3xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div>
            <div className="text-3xl font-bold text-primary mb-1">API</div>
            <p className="text-sm text-muted-foreground">RESTful API Integration</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-1">QR</div>
            <p className="text-sm text-muted-foreground">Easy WhatsApp Connection</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-1">24/7</div>
            <p className="text-sm text-muted-foreground">Always Online Service</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2024 WA Gateway. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Index;
