import React, { useEffect } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiXCircle,
  FiX,
} from "react-icons/fi";
import { type ToastMessage } from "../../contexts/ToastContext";
import "./Toast.css";

interface ToastProps {
  message: ToastMessage;
  removeToast: (id: string) => void;
}

const icons = {
  success: <FiCheckCircle size={24} />,
  error: <FiXCircle size={24} />,
  warning: <FiAlertTriangle size={24} />,
  info: <FiInfo size={24} />,
};

export const Toast: React.FC<ToastProps> = ({ message, removeToast }) => {
  const [isPaused, setIsPaused] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = React.useRef<number>(0);
  const remainingTimeRef = React.useRef<number>(message.duration || 5000);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      removeToast(message.id);
    }, remainingTimeRef.current);
  };

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current -= elapsed;
  };

  useEffect(() => {
    startTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []); // Executa apenas na montagem

  const handleMouseEnter = () => {
    setIsPaused(true);
    pauseTimer();
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimer();
  };

  return (
    <div
      className={`toast toast-${message.type}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="toast-icon">{icons[message.type]}</div>
      <div className="toast-content">
        <strong>{message.title}</strong>
        {message.description && <p>{message.description}</p>}
      </div>
      <button
        onClick={() => removeToast(message.id)}
        className="toast-close-button"
      >
        <FiX size={18} />
      </button>
      <div
        className="toast-progress-bar"
        style={{
          animationDuration: `${(message.duration || 5000) / 1000}s`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      />
    </div>
  );
};
