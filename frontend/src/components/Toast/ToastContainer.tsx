import React from "react";
import type { ToastMessage } from "../../contexts/ToastContext";
import { Toast } from "./Toast";
import "./Toast.css";

interface ToastContainerProps {
  messages: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  messages,
  removeToast,
}) => {
  return (
    <div className="toast-container">
      {messages.map((message) => (
        <Toast key={message.id} message={message} removeToast={removeToast} />
      ))}
    </div>
  );
};
