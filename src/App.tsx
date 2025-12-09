import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import UsersManagement from "./pages/admin/UsersManagement";
import UserLogin from "./pages/user/UserLogin";
import UserHome from "./pages/user/UserHome";
import QRConnect from "./pages/user/QRConnect";
import SendMessage from "./pages/user/SendMessage";
import MessageHistory from "./pages/user/MessageHistory";
import DisabledAccount from "./pages/user/DisabledAccount";

const queryClient = new QueryClient();

// Protected route wrapper for admin
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }
  
  return <>{children}</>;
}

// Protected route wrapper for user
function UserRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user || user.role !== 'user') {
    return <Navigate to="/user/login" replace />;
  }
  
  if (user.status === 'disabled') {
    return <Navigate to="/user/disabled" replace />;
  }
  
  return <>{children}</>;
}

// Disabled account route
function DisabledRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/user/login" replace />;
  }
  
  if (user.status !== 'disabled') {
    return <Navigate to="/user/home" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/users" element={<AdminRoute><UsersManagement /></AdminRoute>} />
      
      {/* User Routes */}
      <Route path="/user/login" element={<UserLogin />} />
      <Route path="/user/disabled" element={<DisabledRoute><DisabledAccount /></DisabledRoute>} />
      <Route path="/user/home" element={<UserRoute><UserHome /></UserRoute>} />
      <Route path="/user/qr" element={<UserRoute><QRConnect /></UserRoute>} />
      <Route path="/user/send" element={<UserRoute><SendMessage /></UserRoute>} />
      <Route path="/user/history" element={<UserRoute><MessageHistory /></UserRoute>} />
      
      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
