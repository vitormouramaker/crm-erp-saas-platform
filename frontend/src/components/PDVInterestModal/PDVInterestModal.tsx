import { useState } from "react";
import { Modal } from "../common/Modal/Modal";
import { Input } from "../common/Input/Input";
import { decrypt, encrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import "./PDVInterestModal.css";

interface PDVInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PDVInterestModal({ isOpen, onClose }: PDVInterestModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Estado do formulário
  const [formData, setFormData] = useState({
    companyName: "",
    ceoName: "",
    phone: "",
    revenue: "",
    employees: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        usuario_id: user?.id,
        empresa_id: user?.empresa_id,
        tipo: "pdv_interest", // Identificador para o backend saber que é lead de PDV
        email_usuario: user?.email,
        dados_formulario: formData,
        assunto: "Interesse no Módulo PDV Integrado",
      };

      const encrypted = await encrypt(payload);

      // Reutilizamos a rota de feedback/email, o backend deve tratar o tipo 'pdv_interest'
      const response = await fetch(`${API_BASE}/web/enviar_feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const responseData = await response.json();
      const decoded = responseData?.payload
        ? ((await decrypt(responseData.payload)) as
            | { boleano?: boolean; mensagem?: string }
            | null)
        : null;

      if (response.ok && decoded?.boleano) {
        alert(
          decoded?.mensagem ||
            "Solicitação enviada! Nossa equipe de implantação entrará em contato em breve."
        );
        setFormData({
          companyName: "",
          ceoName: "",
          phone: "",
          revenue: "",
          employees: "",
        });
        onClose();
      } else {
        alert(decoded?.mensagem || "Erro ao enviar solicitação.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Interesse no PDV Integrado">
      <form onSubmit={handleSubmit} className="pdv-interest-form">
        <p className="modal-description">
          Preencha os dados abaixo para analisarmos a melhor forma de implantar
          o PDV no seu negócio.
        </p>

        <Input
          label="Nome da Empresa"
          name="companyName"
          value={formData.companyName}
          onChange={handleChange}
          required
          placeholder="Ex: Mercado do João Ltda."
        />

        <div className="form-row">
          <Input
            label="Nome do Responsável/CEO"
            name="ceoName"
            value={formData.ceoName}
            onChange={handleChange}
            required
            placeholder="Ex: João Silva"
          />
          <Input
            label="Telefone / WhatsApp"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            placeholder="(XX) 9XXXX-XXXX"
          />
        </div>

        <div className="form-row">
          <div className="select-wrapper">
            <label>Faturamento Mensal (Estimado)</label>
            <select
              name="revenue"
              value={formData.revenue}
              onChange={handleChange}
              required
              className="input-field"
            >
              <option value="" disabled>
                Selecione...
              </option>
              <option value="ate_10k">Até R$ 10.000</option>
              <option value="10k_50k">R$ 10.000 a R$ 50.000</option>
              <option value="50k_100k">R$ 50.000 a R$ 100.000</option>
              <option value="acima_100k">Acima de R$ 100.000</option>
            </select>
          </div>

          <div className="select-wrapper">
            <label>Quantidade de Funcionários</label>
            <select
              name="employees"
              value={formData.employees}
              onChange={handleChange}
              required
              className="input-field"
            >
              <option value="" disabled>
                Selecione...
              </option>
              <option value="1_5">1 a 5</option>
              <option value="6_15">6 a 15</option>
              <option value="16_50">16 a 50</option>
              <option value="acima_50">Acima de 50</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="save-button" disabled={loading}>
            {loading ? "Enviando..." : "Solicitar Implantação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
