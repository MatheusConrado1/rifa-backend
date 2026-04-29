import { Navigate, Outlet } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';

export function ProtectedRoute() {
  const {
    auth: { token },
  } = useAppState();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
