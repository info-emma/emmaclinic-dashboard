import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore(s => s.user);
  const initialized = useAuthStore(s => s.initialized);
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-emma-white">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emma-gold border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
