import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Landing } from '@/pages/Landing';
import { Auth } from '@/pages/Auth';
import { Onboarding } from '@/pages/Onboarding';
import { Dashboard } from '@/pages/Dashboard';
import { Startups } from '@/pages/Startups';
import { StartupDetail } from '@/pages/StartupDetail';
import { Hackathons } from '@/pages/Hackathons';
import { HackathonDetail } from '@/pages/HackathonDetail';
import { CreatePost } from '@/pages/CreatePost';
import { Profile } from '@/pages/Profile';

// Protected route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Public route that redirects authenticated users
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
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
            <Landing />
          </PublicRoute>
        }
      />
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/startups"
        element={
          <ProtectedRoute>
            <Startups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/startups/:id"
        element={
          <ProtectedRoute>
            <StartupDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hackathons"
        element={
          <ProtectedRoute>
            <Hackathons />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hackathons/:id"
        element={
          <ProtectedRoute>
            <HackathonDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create"
        element={
          <ProtectedRoute>
            <CreatePost />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
