import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/common/AuthLayout/AuthLayout";
import { Input } from "../../components/common/Input/Input";
import { PasswordChecklist } from "../../components/common/PasswordChecklist/PasswordChecklist";
import { API_BASE } from "../../config/api";
import { decrypt, encrypt } from "../../utils/cripto";
import { validatePasswordPolicy } from "../../utils/passwordPolicy";
import "./ResetPasswordPage.css";

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromQuery = useMemo(
    () => new URLSearchParams(location.search).get("email") || "",
    [location.search],
  );

  const [email, setEmail] = useState(emailFromQuery);
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedCode = String(codigo || "").trim();

    if (!normalizedEmail) {
      setError("Informe o e-mail da conta.");
      return;
    }

    if (!normalizedCode) {
      setError("Informe o código recebido por e-mail.");
      return;
    }

    const passwordValidationMessage = validatePasswordPolicy(senha.trim());
    if (!senha.trim() || passwordValidationMessage) {
      setError(passwordValidationMessage || "Informe uma senha válida.");
      return;
    }

    if (senha !== confirmarSenha) {
      setError("A confirmação da senha não confere.");
      return;
    }

    setSubmitting(true);

    try {
      const encrypted = await encrypt({
        email: normalizedEmail,
        codigo: normalizedCode,
        senha,
      });

      const response = await fetch(`${API_BASE}/web/new_pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const data = await response.json();
      const resp = (await decrypt(data.payload)) as {
        boleano: boolean;
        mensagem?: string;
        msg?: string;
      } | null;

      if (!resp?.boleano) {
        throw new Error(
          resp?.mensagem || resp?.msg || "Falha ao redefinir senha.",
        );
      }

      setSuccess(
        "Senha redefinida com sucesso. Redirecionando para o login...",
      );
      setTimeout(() => {
        navigate("/", {
          replace: true,
          state: {
            prefillEmail: normalizedEmail,
            forceReloginMessage:
              "Sua senha foi redefinida. Entre com a nova senha.",
          },
        });
      }, 1800);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Falha ao redefinir senha.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="reset-password-form">
        <header className="reset-password-header">
          <h1>Redefinir senha</h1>
          <p>
            Use o código recebido por e-mail para cadastrar uma nova senha de
            acesso.
          </p>
        </header>

        {error ? (
          <p className="reset-password-alert reset-password-alert-error">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="reset-password-alert reset-password-alert-success">
            {success}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <Input
            label="E-mail"
            type="email"
            id="reset-email"
            placeholder="seuemail@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Código de verificação"
            type="text"
            id="reset-code"
            placeholder="Digite o código recebido"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
          />

          <Input
            label="Nova senha"
            type="password"
            id="reset-password"
            placeholder="Digite sua nova senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <Input
            label="Confirmar nova senha"
            type="password"
            id="reset-password-confirm"
            placeholder="Repita sua nova senha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            required
          />

          <PasswordChecklist
            password={senha}
            error={error && error.toLowerCase().includes("senha") ? error : ""}
            helperText="O código recebido por e-mail não funciona como login. Ele apenas autoriza a troca da senha."
            extraRuleLabel="Confirmação igual à senha informada"
            extraRulePassed={
              confirmarSenha.length > 0 && confirmarSenha === senha
            }
          />

          <button
            type="submit"
            className="reset-password-button"
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <div className="reset-password-links">
          <Link to="/">Voltar para o login</Link>
          <Link to="/recuperar-senha">Solicitar outro código</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
