import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import WebGIS from "./pages/WebGIS";
import AuthModal from "./auth/AuthModal";
import RedefinirSenha from "./pages/RedefinirSenha";
import AdminDashboard from "./pages/AdminDashboard";

function decodeToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem("token");
      return null;
    }
    return payload;
  } catch {
    localStorage.removeItem("token");
    return null;
  }
}

function isTokenValid() {
  return decodeToken() !== null;
}

function AdminGuard({ children }) {
  const payload = decodeToken();
  if (!payload || payload.role !== "admin") return <Navigate to="/webgis" />;
  return children;
}

function AuthGate({ children }) {
  const [authed, setAuthed] = useState(isTokenValid);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!authed) {
      const t = setTimeout(() => setShowModal(true), 2000);
      return () => clearTimeout(t);
    }
  }, [authed]);

  const handleSuccess = () => {
    window.location.reload();
  };

  return (
    <>
      {children}
      {showModal && !authed && <AuthModal onSuccess={handleSuccess} />}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/webgis" />} />
        <Route path="/webgis" element={<AuthGate><WebGIS /></AuthGate>} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />
        <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
        <Route path="*" element={<Navigate to="/webgis" />} />
      </Routes>
    </Router>
  );
}
