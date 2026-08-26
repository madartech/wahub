import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GatewayAuthProvider, useGatewayAuth } from "@/contexts/GatewayAuthContext";

import GatewayLogin from "@/pages/gateway/Login";
import Dashboard from "@/pages/gateway/Dashboard";
import Users from "@/pages/gateway/Users";
import AddUser from "@/pages/gateway/AddUser";
import UserDetails from "@/pages/gateway/UserDetails";
import Operations from "@/pages/gateway/Operations";
import GatewayLayout from "@/components/layout/GatewayLayout";
import NotFound from "@/pages/NotFound";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useGatewayAuth();
  
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  
  return <GatewayLayout>{children}</GatewayLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useGatewayAuth();
  
  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <GatewayLogin />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/new"
        element={
          <ProtectedRoute>
            <AddUser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:id"
        element={
          <ProtectedRoute>
            <UserDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/operations"
        element={
          <ProtectedRoute>
            <Operations />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <TooltipProvider>
    <BrowserRouter>
      <GatewayAuthProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </GatewayAuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
