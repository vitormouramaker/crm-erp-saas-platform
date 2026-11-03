import { LegalFooter } from "../LegalFooter/LegalFooter";
import React from "react";
import "./AuthLayout.css";

interface AuthLayoutProps {
  children: React.ReactNode;
  rootClassName?: string;
  formSectionClassName?: string;
  formContainerClassName?: string;
}

export function AuthLayout({
  children,
  rootClassName,
  formSectionClassName,
  formContainerClassName,
}: AuthLayoutProps) {
  const rootClasses = ["auth-layout", rootClassName].filter(Boolean).join(" ");
  const formSectionClasses = ["auth-form-section", formSectionClassName]
    .filter(Boolean)
    .join(" ");
  const formContainerClasses = ["form-container", formContainerClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses}>
      <div className={formSectionClasses}>
        <div className={formContainerClasses}>{children}<LegalFooter /></div>
      </div>
      <div className="auth-image-section" />
    </div>
  );
}
