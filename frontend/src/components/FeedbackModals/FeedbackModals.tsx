import { useState } from "react";
import { Modal } from "../common/Modal/Modal";
import { Input } from "../common/Input/Input";
import { decrypt, encrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import "./FeedbackModals.css";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "support" | "suggestion";
}

export function FeedbackModal({ isOpen, onClose, type }: FeedbackModalProps) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const title = type === "support" ? "Solicitar Suporte" : "Enviar Sugestão";
  const placeholder =
    type === "support"
      ? "Descreva seu problema detalhadamente..."
      : "Conte-nos como podemos melhorar o sistema...";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Envia os dados para o backend disparar o e-mail
      const payload = {
        usuario_id: user?.id,
        empresa_id: user?.empresa_id,
        tipo: type, // 'support' ou 'suggestion'
        assunto: subject,
        mensagem: message,
        email_usuario: user?.email,
      };

      const encrypted = await encrypt(payload);

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
        alert(decoded?.mensagem || "Mensagem enviada com sucesso! Responderemos em breve.");
        setSubject("");
        setMessage("");
        onClose();
      } else {
        alert(decoded?.mensagem || "Erro ao enviar mensagem.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="feedback-form">
        <Input
          label="Assunto"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="Ex: Erro ao cadastrar produto"
        />

        <div className="textarea-wrapper">
          <label>Mensagem</label>
          <textarea
            className="feedback-textarea"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            required
          />
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="save-button" disabled={loading}>
            {loading ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
