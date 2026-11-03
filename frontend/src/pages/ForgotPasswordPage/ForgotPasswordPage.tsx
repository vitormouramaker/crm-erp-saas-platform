import { Link } from 'react-router-dom';
import { useState } from 'react';
import { AuthLayout } from '../../components/common/AuthLayout/AuthLayout';
import { Input } from '../../components/common/Input/Input';
import './ForgotPasswordPage.css'; // Usaremos um CSS separado
import { decrypt,encrypt } from '../../utils/cripto'
import { API_BASE } from '../../config/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      // Criptografa o payload com o email
      const encrypted = await encrypt({ email });

      // Faz a chamada ao backend
      const response = await fetch(`${API_BASE}/web/forgot_pass`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const data = await response.json();
      const resp = await decrypt(data.payload);
      if (!resp?.boleano) {
        throw new Error("Erro na requisição!");
      }

      alert("Se este e-mail estiver cadastrado, você receberá um código e um link para redefinir a senha.");

    } catch (err) {
      console.error("Erro na recuperação de senha:", err);
      alert("Erro ao enviar solicitação de recuperação.");
    }
  };

   return (
    <AuthLayout>
      <div className="forgot-password-form">
        <header className="forgot-password-header">
          <h1>Recuperar Senha</h1>
          <p>Digite seu e-mail e enviaremos um código com o link para redefinir sua senha.</p>
        </header>
        
        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            id="email"
            placeholder="seuemail@empresa.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          
          <button type="submit" className="recover-button">
            Enviar código de recuperação
          </button>
        </form>
        
        <div className="back-to-login">
          <Link to="/">Voltar para o Login</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
