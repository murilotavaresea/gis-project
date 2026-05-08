import { useState, useEffect, useRef, useCallback } from "react";
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
  const [authed] = useState(isTokenValid);
  const [showModal, setShowModal] = useState(false);
  const timerRef = useRef(null);

  const scheduleModal = useCallback((delay) => {
    clearTimeout(timerRef.current);
    if (!isTokenValid()) {
      timerRef.current = setTimeout(() => setShowModal(true), delay);
    }
  }, []);

  useEffect(() => {
    if (!authed) scheduleModal(2000);
    return () => clearTimeout(timerRef.current);
  }, [authed, scheduleModal]);

  useEffect(() => {
    const onTourStart = () => { clearTimeout(timerRef.current); setShowModal(false); };
    const onTourEnd = () => scheduleModal(600);
    window.addEventListener("tour:start", onTourStart);
    window.addEventListener("tour:end", onTourEnd);
    return () => {
      window.removeEventListener("tour:start", onTourStart);
      window.removeEventListener("tour:end", onTourEnd);
    };
  }, [scheduleModal]);

  return (
    <>
      {children}
      {showModal && !authed && <AuthModal onSuccess={() => window.location.reload()} />}
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
