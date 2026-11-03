import { Link } from "react-router-dom";
import "./LegalFooter.css";
export function LegalFooter() {
  return <footer className="legal-footer">
    <nav aria-label="Documentos legais">
      <Link to="/termos-de-uso">Termos de uso</Link>
      <Link to="/politica-de-privacidade">Política de privacidade e cookies</Link>
      <Link to="/exclusao-de-conta">Exclusão de conta</Link>
    </nav>
  </footer>;
}
