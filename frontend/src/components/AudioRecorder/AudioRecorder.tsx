import { useEffect, useState } from 'react';
import { FiMic, FiPause, FiPlay, FiX, FiSend } from 'react-icons/fi';
import { useAudioRecorder } from './useAudioRecorder';
import './AudioRecorder.css';

interface AudioRecorderProps {
    onSend: (audioBlob: Blob, duration: number) => void;
    onCancel: () => void;
    maxDuration?: number; // em segundos, padrão 300 (5min)
}

export function AudioRecorder({
    onSend,
    onCancel,
    maxDuration = 300
}: AudioRecorderProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {
        isRecording,
        isPaused,
        duration,
        audioBlob,
        audioUrl,
        error,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
        cancelRecording,
    } = useAudioRecorder({ maxDuration });

    // Auto-iniciar gravação ao montar
    useEffect(() => {
        startRecording();
        return () => {
            cancelRecording();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSend = () => {
        if (isSubmitting) return;
        if (audioBlob) {
            const blobToSend = audioBlob;
            const durationToSend = duration;
            setIsSubmitting(true);
            cancelRecording();
            onCancel();
            onSend(blobToSend, durationToSend);
        }
    };

    const handleCancel = () => {
        cancelRecording();
        onCancel();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (error) {
        return (
            <div className="audio-recorder-error">
                <div className="error-icon">⚠️</div>
                <p className="error-message">{error}</p>
                <div className="error-actions">
                    <button onClick={handleCancel} className="error-close-btn">Fechar</button>
                </div>
                <div className="error-help">
                    <p className="error-help-title">Como resolver:</p>
                    <ul>
                        <li>Verifique se há um microfone conectado</li>
                        <li>Permita o acesso ao microfone no navegador</li>
                        <li>Feche outros aplicativos que possam estar usando o microfone</li>
                        <li>Tente recarregar a página</li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div className="audio-recorder">
            {isRecording && !audioBlob && (
                <>
                    <div className="recording-indicator">
                        <div className="pulse-dot" />
                        <span>Gravando...</span>
                    </div>

                    <div className="waveform">
                        {/* Visualização de forma de onda */}
                        <div className="waveform-bars">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="bar" />
                            ))}
                        </div>
                    </div>

                    <div className="duration">{formatTime(duration)}</div>

                    <div className="controls">
                        <button
                            className="control-btn cancel"
                            onClick={handleCancel}
                            title="Cancelar"
                        >
                            <FiX size={24} />
                        </button>

                        <button
                            className="control-btn pause"
                            onClick={isPaused ? resumeRecording : pauseRecording}
                            title={isPaused ? "Retomar" : "Pausar"}
                        >
                            {isPaused ? <FiPlay size={24} /> : <FiPause size={24} />}
                        </button>

                        <button
                            className="control-btn stop"
                            onClick={stopRecording}
                            title="Parar e visualizar"
                        >
                            <FiMic size={24} />
                        </button>
                    </div>
                </>
            )}

            {audioBlob && audioUrl && (
                <>
                    <div className="audio-preview">
                        <p>Preview do áudio ({formatTime(duration)})</p>
                        <audio src={audioUrl} controls />
                    </div>

                    <div className="controls">
                        <button
                            className="control-btn cancel"
                            onClick={handleCancel}
                        >
                            <FiX size={20} />
                            <span>Cancelar</span>
                        </button>

                        <button
                            className="control-btn send"
                            onClick={handleSend}
                            disabled={isSubmitting}
                        >
                            <FiSend size={20} />
                            <span>{isSubmitting ? "Enviando..." : "Enviar"}</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

