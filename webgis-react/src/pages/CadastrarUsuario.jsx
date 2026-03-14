import { useState } from "react";
import axios from "axios";

export default function CadastrarUsuario() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post("http://localhost:5000/auth/dev-register", {
        nome,
        email,
        senha
      });
      alert("✅ Usuário cadastrado com sucesso!");
    } catch (err) {
      console.error("Erro ao cadastrar:", err);
      if (err.response?.data?.erro) {
        alert("❌ " + err.response.data.erro);
      } else {
        alert("❌ Erro inesperado ao cadastrar usuário.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Cadastrar Usuário</h2>
      <input
        placeholder="Nome"
        value={nome}
        onChange={e => setNome(e.target.value)}
      />
      <input
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        placeholder="Senha"
        type="password"
        value={senha}
        onChange={e => setSenha(e.target.value)}
      />
      <button type="submit">Cadastrar</button>
    </form>
  );
}
