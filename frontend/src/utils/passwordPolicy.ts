const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9]/;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;

export const PASSWORD_POLICY_HINT =
  "Minimo de 8 caracteres, com letra maiuscula, letra minuscula, numero e caractere especial.";

export type PasswordPolicyCheck = {
  key: string;
  label: string;
  passed: boolean;
};

export function getPasswordPolicyChecks(password: string): PasswordPolicyCheck[] {
  return [
    {
      key: "length",
      label: "Pelo menos 8 caracteres",
      passed: password.length >= 8,
    },
    {
      key: "special",
      label: "Pelo menos 1 caractere especial",
      passed: SPECIAL_CHARACTER_REGEX.test(password),
    },
    {
      key: "uppercase",
      label: "Pelo menos 1 letra maiuscula",
      passed: UPPERCASE_REGEX.test(password),
    },
    {
      key: "lowercase",
      label: "Pelo menos 1 letra minuscula",
      passed: LOWERCASE_REGEX.test(password),
    },
    {
      key: "number",
      label: "Pelo menos 1 numero",
      passed: NUMBER_REGEX.test(password),
    },
  ];
}

export function validatePasswordPolicy(password: string): string | null {
  const firstFailedCheck = getPasswordPolicyChecks(password).find((check) => !check.passed);
  if (firstFailedCheck) {
    return `A senha deve atender a regra: ${firstFailedCheck.label}.`;
  }

  return null;
}
