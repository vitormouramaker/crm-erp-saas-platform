import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/common/AuthLayout/AuthLayout";
import { Input } from "../../components/common/Input/Input";
import { PasswordChecklist } from "../../components/common/PasswordChecklist/PasswordChecklist";
import { API_BASE } from "../../config/api";
import { decrypt, encrypt } from "../../utils/cripto";
import { validatePasswordPolicy } from "../../utils/passwordPolicy";
import "./OnboardingPage.css";

type OnboardingPayload = {
  empresa_id: number;
  email: string;
  nome_responsavel: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
};

type FormState = {
  nome_responsavel: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  senha: string;
  confirmar_senha: string;
};

const EMPTY_FORM: FormState = {
  nome_responsavel: "",
  nome_fantasia: "",
  razao_social: "",
  cnpj: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  senha: "",
  confirmar_senha: "",
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search]
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("Link invalido. Solicite um novo e-mail de onboarding.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/web/onboarding_empresa?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();
        const resp = (await decrypt(data.payload)) as
          | { boleano: boolean; mensagem?: string; obj?: OnboardingPayload }
          | null;

        if (!resp?.boleano || !resp?.obj) {
          throw new Error(resp?.mensagem || "Nao foi possivel carregar o cadastro.");
        }

        const onboardingData = resp.obj;
        setEmail(onboardingData.email || "");
        setForm((prev) => ({
          ...prev,
          nome_responsavel: onboardingData.nome_responsavel || "",
          nome_fantasia: onboardingData.nome_fantasia || "",
          razao_social: onboardingData.razao_social || "",
          cnpj: onboardingData.cnpj || "",
          logradouro: onboardingData.logradouro || "",
          numero: onboardingData.numero || "",
          bairro: onboardingData.bairro || "",
          cidade: onboardingData.cidade || "",
          uf: onboardingData.uf || "",
          cep: onboardingData.cep || "",
        }));
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Falha ao carregar onboarding.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Token de onboarding ausente.");
      return;
    }

    if (!form.nome_fantasia.trim()) {
      setError("Informe o nome fantasia da empresa.");
      return;
    }

    const passwordValidationMessage = validatePasswordPolicy(form.senha.trim());
    if (!form.senha.trim() || passwordValidationMessage) {
      setError(passwordValidationMessage || "Informe uma senha valida.");
      return;
    }

    if (form.senha !== form.confirmar_senha) {
      setError("A confirmacao da senha nao confere.");
      return;
    }

    setSubmitting(true);

    try {
      const encrypted = await encrypt({
        token,
        nome_responsavel: form.nome_responsavel,
        nome_fantasia: form.nome_fantasia,
        razao_social: form.razao_social,
        cnpj: form.cnpj,
        logradouro: form.logradouro,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        cep: form.cep,
        senha: form.senha,
      });

      const response = await fetch(`${API_BASE}/web/onboarding_empresa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const data = await response.json();
      const resp = (await decrypt(data.payload)) as
        | { boleano: boolean; mensagem?: string }
        | null;

      if (!resp?.boleano) {
        throw new Error(resp?.mensagem || "Falha ao finalizar cadastro.");
      }

      setSuccess("Cadastro finalizado com sucesso. Voce ja pode entrar na plataforma.");
      setTimeout(() => navigate("/", { replace: true }), 3000);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Falha ao salvar cadastro.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout
        rootClassName="onboarding-auth-layout"
        formSectionClassName="onboarding-auth-form-section"
        formContainerClassName="onboarding-form-container"
      >
        <div className="onboarding-form">
          <h1>Finalizar cadastro</h1>
          <p>Carregando dados...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      rootClassName="onboarding-auth-layout"
      formSectionClassName="onboarding-auth-form-section"
      formContainerClassName="onboarding-form-container"
    >
      <div className="onboarding-form">
        <header className="onboarding-header">
          <h1>Finalizar cadastro</h1>
          <p>Preencha os dados faltantes para concluir o acesso da sua empresa.</p>
        </header>

        {error ? <p className="onboarding-alert onboarding-alert-error">{error}</p> : null}

        <div className="onboarding-content" key={success ? "success" : "form"}>
          {success ? (
            <section className="onboarding-success-state" aria-live="polite">
              <div className="onboarding-success-icon" aria-hidden="true">
                <span>&#10003;</span>
              </div>
              <h2>Cadastro finalizado com sucesso</h2>
              <p>Voce ja pode entrar na plataforma.</p>
              <small>Redirecionando para o login...</small>
            </section>
          ) : (
            <form onSubmit={handleSubmit}>
              <Input
                label="Email"
                id="email"
                type="email"
                value={email}
                disabled
                required
              />

              <div className="onboarding-grid onboarding-grid-two">
                <Input
                  label="Nome do responsavel"
                  id="nome_responsavel"
                  value={form.nome_responsavel}
                  onChange={(event) => setField("nome_responsavel", event.target.value)}
                  required
                />
                <Input
                  label="CNPJ"
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(event) => setField("cnpj", event.target.value)}
                />
              </div>

              <div className="onboarding-grid onboarding-grid-two">
                <Input
                  label="Nome fantasia"
                  id="nome_fantasia"
                  value={form.nome_fantasia}
                  onChange={(event) => setField("nome_fantasia", event.target.value)}
                  required
                />
                <Input
                  label="Razao social"
                  id="razao_social"
                  value={form.razao_social}
                  onChange={(event) => setField("razao_social", event.target.value)}
                />
              </div>

              <div className="onboarding-grid onboarding-grid-three onboarding-grid-cep">
                <Input
                  label="CEP"
                  id="cep"
                  value={form.cep}
                  onChange={(event) => setField("cep", event.target.value)}
                />
                <Input
                  label="Numero"
                  id="numero"
                  value={form.numero}
                  onChange={(event) => setField("numero", event.target.value)}
                />
                <Input
                  label="Bairro"
                  id="bairro"
                  value={form.bairro}
                  onChange={(event) => setField("bairro", event.target.value)}
                />
              </div>

              <div className="onboarding-grid onboarding-grid-three onboarding-grid-address-line">
                <Input
                  label="Logradouro"
                  id="logradouro"
                  value={form.logradouro}
                  onChange={(event) => setField("logradouro", event.target.value)}
                />
                <Input
                  label="Cidade"
                  id="cidade"
                  value={form.cidade}
                  onChange={(event) => setField("cidade", event.target.value)}
                />
                <Input
                  label="UF"
                  id="uf"
                  value={form.uf}
                  onChange={(event) => setField("uf", event.target.value)}
                />
              </div>

              <div className="onboarding-grid">
                <Input
                  label="Senha"
                  id="senha"
                  type="password"
                  value={form.senha}
                  onChange={(event) => setField("senha", event.target.value)}
                  required
                  minLength={8}
                />
                <Input
                  label="Confirmar senha"
                  id="confirmar_senha"
                  type="password"
                  value={form.confirmar_senha}
                  onChange={(event) => setField("confirmar_senha", event.target.value)}
                  required
                />
              </div>
              <PasswordChecklist
                password={form.senha}
                error={error && (error.toLowerCase().includes("senha") || error.toLowerCase().includes("regra")) ? error : ""}
                helperText="Use uma senha forte para concluir o primeiro acesso da empresa."
                extraRuleLabel="Confirmacao igual a senha informada"
                extraRulePassed={
                  form.confirmar_senha.length > 0 && form.senha === form.confirmar_senha
                }
              />

              <button type="submit" className="onboarding-button" disabled={submitting}>
                {submitting ? "Salvando..." : "Finalizar cadastro"}
              </button>
            </form>
          )}
        </div>

        <div className="onboarding-back">
          <Link to="/">Voltar para o login</Link>
        </div>
      </div>
    </AuthLayout>
  );
}

