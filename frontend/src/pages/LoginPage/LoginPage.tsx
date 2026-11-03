import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { AuthLayout } from "../../components/common/AuthLayout/AuthLayout";
import { Input } from "../../components/common/Input/Input";
import { useAuth } from "../../contexts/AuthContext";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import { getDefaultRouteForUser } from "../../utils/getDefaultRoute";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isAuthReady, user } = useAuth();
  const handledReloginStateRef = useRef(false);


  const [email, setEmail] = useState(() => localStorage.getItem("rememberedEmail") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("rememberedEmail"));
  const [securityNotice, setSecurityNotice] = useState("");

  useEffect(() => {
    if (handledReloginStateRef.current) return;

    const state = (location.state || {}) as {
      forceReloginMessage?: string;
      prefillEmail?: string;
    };

    if (state.prefillEmail) {
      setEmail(state.prefillEmail);
    }

    if (state.forceReloginMessage) {
      setSecurityNotice(state.forceReloginMessage);
    }

    handledReloginStateRef.current = true;
  }, [location.state]);

  useEffect(() => {
    if (!isAuthReady) return;

    if (isAuthenticated && user) {
      navigate(getDefaultRouteForUser(user), { replace: true });
    }
  }, [isAuthenticated, isAuthReady, user, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const encrypted = await encrypt({
        user: email,
        pass: password,
      });

      const response = await fetch(`${API_BASE}/web/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const data = await response.json();
      const resp = (await decrypt(data.payload)) as {
        boleano: boolean;
        obj: any;
      };
      if (!resp?.boleano) {
        throw new Error("Erro ao fazer login");
      }

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      localStorage.removeItem("rememberedPassword");

      await login(data.payload);
    } catch (err) {
      console.error("Erro no login:", err);
      alert("Email ou senha incorretos.");
    }
  };

  return (
    <AuthLayout>
      <div className="login-form">
        <header className="login-header">
          <h1>Bem-vindo de volta!</h1>
          <p>Faca login para acessar a plataforma.</p>
        </header>

        {securityNotice ? (
          <p style={{ color: "#b91c1c", marginBottom: "0.8rem", fontSize: "0.92rem" }}>
            {securityNotice}
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            id="email"
            placeholder="seuemail@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="login-password-field">
            <label htmlFor="password">Senha</label>
            <div className="login-password-input">
              <input
                className="input-field"
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <div className="login-options">
            <div className="remember-me">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember">Lembrar e-mail</label>
            </div>

            <Link to="/recuperar-senha" className="forgot-password-link">
              Esqueceu a senha?
            </Link>
          </div>

          <button type="submit" className="login-button">
            Entrar
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}

