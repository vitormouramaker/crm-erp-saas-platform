import { getPasswordPolicyChecks } from "../../../utils/passwordPolicy";
import "./PasswordChecklist.css";

interface PasswordChecklistProps {
  password: string;
  title?: string;
  helperText?: string;
  error?: string;
  extraRuleLabel?: string;
  extraRulePassed?: boolean;
}

export function PasswordChecklist({
  password,
  title = "Sua senha precisa ter:",
  helperText,
  error,
  extraRuleLabel,
  extraRulePassed,
}: PasswordChecklistProps) {
  const checks = getPasswordPolicyChecks(password);
  const checklist = extraRuleLabel
    ? [
        ...checks,
        {
          key: "extra",
          label: extraRuleLabel,
          passed: Boolean(extraRulePassed),
        },
      ]
    : checks;

  const hasTypedPassword = password.length > 0;
  const completedCount = checklist.filter((item) => item.passed).length;

  return (
    <div className={`password-checklist${error ? " password-checklist-error" : ""}`}>
      <div className="password-checklist-header">
        <div>
          <strong>{title}</strong>
          {helperText ? <p>{helperText}</p> : null}
        </div>
        <span className="password-checklist-counter">
          {completedCount}/{checklist.length}
        </span>
      </div>

      <ul className="password-checklist-list">
        {checklist.map((item) => (
          <li
            key={item.key}
            className={`password-checklist-item${
              item.passed ? " is-complete" : hasTypedPassword ? " is-pending" : ""
            }`}
          >
            <span className="password-checklist-icon" aria-hidden="true">
              {item.passed ? "✓" : "•"}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {error ? <p className="password-checklist-feedback">{error}</p> : null}
    </div>
  );
}
