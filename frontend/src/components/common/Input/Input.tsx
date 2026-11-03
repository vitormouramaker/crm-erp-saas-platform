import React from 'react';
import './Input.css';

// Usamos Omit para herdar todos os atributos de um input HTML, exceto 'size' que pode conflitar
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, ...props }: InputProps) {
  return (
    <div className="input-wrapper">
      <label htmlFor={props.id || props.name}>{label}</label>
      <input className="input-field" {...props} />
    </div>
  );
}