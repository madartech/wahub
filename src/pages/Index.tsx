import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Shield, User } from 'lucide-react';

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
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            WhatsApp Gateway
            <span className="text-primary"> Dashboard</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Manage your WhatsApp messaging gateway with ease. Send texts, images, and documents programmatically.
          </p>
        </div>

        {/* Login Cards */}
        <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="text-center pb-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>Admin Portal</CardTitle>
              <CardDescription>
                Manage users, API keys, and monitor system status
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/admin/login">
                <Button className="w-full" size="lg">
                  Admin Login
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="text-center pb-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-7 h-7 text-primary" />
              </div>
              <CardTitle>User Portal</CardTitle>
              <CardDescription>
                Connect WhatsApp, send messages, and manage your account
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to="/user/login">
                <Button className="w-full" variant="outline" size="lg">
                  User Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-16 grid sm:grid-cols-3 gap-8 text-center max-w-3xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
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
