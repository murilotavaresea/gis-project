// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./auth/Login";
import PrivateRoute from "./auth/PrivateRoute";
import WebGIS from "./pages/WebGIS";
import CadastrarUsuario from "./pages/CadastrarUsuario";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* entra direto no WebGIS */}
        <Route path="/" element={<Navigate to="/webgis" />} />

        <Route path="/login" element={<Login />} />

        <Route
          path="/webgis"
          element={
            <PrivateRoute>
              <WebGIS />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/cadastrar-usuario"
          element={
            <PrivateRoute>
              <CadastrarUsuario />
            </PrivateRoute>
          }
        />

        {/* qualquer rota inválida vai pro WebGIS durante testes */}
        <Route path="*" element={<Navigate to="/webgis" />} />
      </Routes>
    </Router>
  );
}