import "./SleeknoteMaintenance.css";
import img_svg from "../../assets/Maintenance-amico.svg";
import logo from "../../assets/logo-maintenance.svg";

export function SleeknoteMaintenance() {
  return (
    <div className="sleeknote-page">
      <div className="sleeknote-card">
        {/* Logo */}
        <div className="sleeknote-logo">
          <span className="sleeknote-logo-badge">
            <img src={logo} alt="Logo" />
          </span>
        </div>

        {/* Heading */}
        <h1 className="sleeknote-title">Portal em manutenção!</h1>
        <p className="sleeknote-subtitle">
          "Estamos em manutenção para melhorar a sua experiência. Agradecemos a
          compreensão e voltamos em breve!"
        </p>

        {/* Illustration */}
        <div className="sleeknote-illustration">
          <img src={img_svg} alt="Maintenance" />
        </div>
      </div>
    </div>
  );
}
