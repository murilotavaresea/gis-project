import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import WebGIS from "./pages/WebGIS";
import AuthModal from "./auth/AuthModal";
import RedefinirSenha from "./pages/RedefinirSenha";

function isTokenValid() {
  const token = localStorage.getItem("token");
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    localStorage.removeItem("token");
    return false;
  }
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
    setAuthed(true);
    setShowModal(false);
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
        <Route path="*" element={<Navigate to="/webgis" />} />
      </Routes>
    </Router>
  );
}
