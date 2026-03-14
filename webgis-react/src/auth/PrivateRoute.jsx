// src/auth/PrivateRoute.jsx
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }) {

  const DESATIVAR_AUTENTICACAO = true; // mude para false quando quiser ativar novamente

  if (DESATIVAR_AUTENTICACAO) {
    return children;
  }

  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}