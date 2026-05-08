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

  useEffect(() => {
    if (!authed) {
      timerRef.current = setTimeout(() => setShowModal(true), 2000);
    }
    return () => clearTimeout(timerRef.current);
  }, [authed]);

  useEffect(() => {
    const onTourEnd = () => {
      if (!isTokenValid()) {
        timerRef.current = setTimeout(() => setShowModal(true), 600);
      }
    };
    window.addEventListener("tour:end", onTourEnd);
    return () => window.removeEventListener("tour:end", onTourEnd);
  }, []);

  const handleStartTour = () => {
    clearTimeout(timerRef.current);
    setShowModal(false);
    window.dispatchEvent(new Event("tour:start"));
  };

  return (
    <>
      {children}
      {showModal && !authed && <AuthModal onSuccess={() => window.location.reload()} />}
      {showModal && !authed && (
        <button
          type="button"
          onClick={handleStartTour}
          style={{
            position: "fixed",
            bottom: "16px",
            left: "16px",
            zIndex: 10000,
            height: "30px",
            padding: "0 12px",
            border: "1px solid rgba(109, 97, 104, 0.18)",
            background: "rgba(255, 255, 255, 0.9)",
            color: "#4e454b",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Tour guiado
        </button>
      )}
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
