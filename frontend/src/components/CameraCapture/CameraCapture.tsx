import { useEffect, useRef, useState } from "react";
import { FiCamera, FiRotateCcw, FiSend, FiX } from "react-icons/fi";
import "./CameraCapture.css";

interface CameraCaptureProps {
  onSend: (photoBlob: Blob) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

function getCameraErrorMessage(error: unknown) {
  const name = typeof error === "object" && error ? (error as Error).name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permita o uso da camera no navegador para capturar a foto.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Nenhuma webcam foi encontrada neste dispositivo.";
  }

  return "Nao foi possivel abrir a webcam.";
}

export function CameraCapture({
  onSend,
  onCancel,
  isSubmitting = false,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(true);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const revokePhotoUrl = () => {
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Seu navegador nao suporta acesso a webcam.");
      setIsStarting(false);
      return;
    }

    setError("");
    setIsStarting(true);
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (cameraError) {
      setError(getCameraErrorMessage(cameraError));
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      stopStream();
      revokePhotoUrl();
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("A camera ainda nao esta pronta para capturar.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Nao foi possivel preparar a captura da foto.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Nao foi possivel gerar a foto capturada.");
          return;
        }

        revokePhotoUrl();
        setPhotoBlob(blob);
        setPhotoUrl(URL.createObjectURL(blob));
        stopStream();
      },
      "image/jpeg",
      0.92
    );
  };

  const handleRetake = async () => {
    revokePhotoUrl();
    setPhotoUrl("");
    setPhotoBlob(null);
    await startCamera();
  };

  const handleSend = async () => {
    if (!photoBlob || isSubmitting) return;
    await onSend(photoBlob);
  };

  return (
    <div className="camera-capture">
      {error ? (
        <div className="camera-capture-error">
          <p>{error}</p>
          <div className="camera-capture-actions">
            <button type="button" className="camera-capture-secondary" onClick={onCancel}>
              <FiX size={18} />
              <span>Fechar</span>
            </button>
            <button type="button" className="camera-capture-primary" onClick={startCamera}>
              <FiRotateCcw size={18} />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="camera-capture-stage">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Preview da foto capturada"
                className="camera-capture-preview"
              />
            ) : (
              <video
                ref={videoRef}
                className="camera-capture-video"
                autoPlay
                muted
                playsInline
              />
            )}
          </div>

          <div className="camera-capture-status">
            {photoUrl
              ? "Revise a foto antes de enviar."
              : isStarting
                ? "Solicitando permissao da webcam..."
                : "Centralize a imagem e capture a foto."}
          </div>

          <div className="camera-capture-actions">
            <button type="button" className="camera-capture-secondary" onClick={onCancel}>
              <FiX size={18} />
              <span>Cancelar</span>
            </button>

            {photoUrl ? (
              <>
                <button
                  type="button"
                  className="camera-capture-secondary"
                  onClick={handleRetake}
                  disabled={isSubmitting}
                >
                  <FiRotateCcw size={18} />
                  <span>Refazer</span>
                </button>
                <button
                  type="button"
                  className="camera-capture-primary"
                  onClick={handleSend}
                  disabled={isSubmitting}
                >
                  <FiSend size={18} />
                  <span>{isSubmitting ? "Enviando..." : "Enviar foto"}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="camera-capture-primary"
                onClick={handleCapture}
                disabled={isStarting}
              >
                <FiCamera size={18} />
                <span>Capturar</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
