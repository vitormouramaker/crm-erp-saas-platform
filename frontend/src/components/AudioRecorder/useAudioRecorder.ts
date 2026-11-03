import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderOptions {
    maxDuration?: number; // segundos
}

export function useAudioRecorder({ maxDuration = 300 }: UseAudioRecorderOptions = {}) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isMountedRef = useRef(true);
    const startRequestIdRef = useRef(0);

    const stopCurrentStream = useCallback(() => {
        const recorderStream = mediaRecorderRef.current?.stream;
        if (recorderStream) {
            recorderStream.getTracks().forEach((track) => track.stop());
        }

        if (!streamRef.current) return;
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Timer
    useEffect(() => {
        if (isRecording && !isPaused) {
            timerRef.current = window.setInterval(() => {
                setDuration(prev => {
                    if (prev >= maxDuration) {
                        stopRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isRecording, isPaused, maxDuration]);

    const startRecording = useCallback(async () => {
        const requestId = ++startRequestIdRef.current;
        let stream: MediaStream | null = null;
        try {
            // Verificar se a API está disponível
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setError('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge.');
                return;
            }

            stopCurrentStream();
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Proteção contra corrida assíncrona (unmount/StrictMode/restart rápido)
            if (!isMountedRef.current || requestId !== startRequestIdRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
            });

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));

                // Limpar stream
                stopCurrentStream();
            };

            mediaRecorder.start();
            setIsRecording(true);
            setError(null);
        } catch (err: any) {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
            stopCurrentStream();
            console.error('Erro ao acessar microfone:', err);

            // Mensagens de erro específicas
            if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError('Nenhum microfone encontrado. Verifique se há um microfone conectado ao computador.');
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Permissão negada. Clique no ícone de cadeado na barra de endereço e permita o acesso ao microfone.');
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setError('Microfone em uso por outro aplicativo. Feche outros programas que possam estar usando o microfone.');
            } else if (err.name === 'OverconstrainedError') {
                setError('Configuração de áudio não suportada pelo seu microfone.');
            } else if (err.name === 'TypeError') {
                setError('Erro de configuração. Tente recarregar a página.');
            } else {
                setError(`Erro ao acessar microfone: ${err.message || 'Erro desconhecido'}`);
            }
        }
    }, [stopCurrentStream]);

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
        }
    }, [isRecording]);

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && isPaused) {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
        }
    }, [isPaused]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
        }
    }, [isRecording]);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        stopCurrentStream();
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }

        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
        setAudioBlob(null);
        setAudioUrl(null);
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
    }, [audioUrl, stopCurrentStream]);

    const resetRecording = useCallback(() => {
        cancelRecording();
    }, [cancelRecording]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            stopCurrentStream();
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl, stopCurrentStream]);

    return {
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
        resetRecording,
    };
}
