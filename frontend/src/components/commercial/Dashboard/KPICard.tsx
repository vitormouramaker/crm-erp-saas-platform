import type { ReactNode } from "react";
import "./KPICard.css";

type KPICardProps = {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
  description?: string;
};

export function KPICard({
  title,
  value,
  icon,
  color = "blue",
  description,
}: KPICardProps) {
  return (
    <div className={`kpi-card kpi-card-${color}`}>
      <div className="kpi-icon-wrapper">{icon}</div>
      <div className="kpi-content">
        <div className="kpi-title-row">
          <span className="kpi-title">{title}</span>
          {description && (
            <div
              className="kpi-help"
              data-tooltip={description}
              aria-label={description}
              tabIndex={0}
            >
              ?
            </div>
          )}
        </div>
        <h3 className="kpi-value">{value}</h3>
      </div>
    </div>
  );
}
