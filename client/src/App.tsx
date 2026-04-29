import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LobbyPage } from './pages/LobbyPage';
import { TablePage } from './pages/TablePage';
import { ProtectedRoute } from './components/ProtectedRoute';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lobby" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/mesa/:mesaId" element={<TablePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
