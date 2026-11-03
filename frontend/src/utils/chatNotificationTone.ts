import notificationSoundUrl from "../assets/notificacao.mpeg?url";

export async function playIncomingMessageTone() {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio(notificationSoundUrl);
    audio.volume = 0.6;
    await audio.play();
  } catch (error) {
    console.warn("Nao foi possivel reproduzir o aviso sonoro da conversa:", error);
  }
}

type ToneNote = {
  frequency: number;
  start: number;
  duration: number;
  volume: number;
  wave?: OscillatorType;
};

async function playGeneratedTone(notes: ToneNote[], errorLabel: string) {
  if (typeof window === "undefined") return;

  let context: AudioContext | null = null;
  try {
    context = new AudioContext();
    if (context.state === "suspended") await context.resume();

    const baseTime = context.currentTime + 0.02;
    notes.forEach((note) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      const startsAt = baseTime + note.start;
      const endsAt = startsAt + note.duration;

      oscillator.type = note.wave || "sine";
      oscillator.frequency.setValueAtTime(note.frequency, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(note.volume, startsAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(startsAt);
      oscillator.stop(endsAt);
    });

    const totalDuration = Math.max(
      ...notes.map((note) => note.start + note.duration),
      0,
    );
    window.setTimeout(() => void context?.close(), (totalDuration + 0.2) * 1000);
  } catch (error) {
    if (context && context.state !== "closed") void context.close();
    console.warn(errorLabel, error);
  }
}

export function playIntegrationSaleBellTone() {
  return playGeneratedTone(
    [
      { frequency: 880, start: 0, duration: 0.7, volume: 0.22 },
      { frequency: 1320, start: 0.08, duration: 0.85, volume: 0.16 },
      { frequency: 1760, start: 0.16, duration: 0.9, volume: 0.1 },
    ],
    "Nao foi possivel reproduzir o sino de nova venda:",
  );
}

export function playAbandonedCartTone() {
  return playGeneratedTone(
    [
      { frequency: 520, start: 0, duration: 0.18, volume: 0.18, wave: "triangle" },
      { frequency: 390, start: 0.22, duration: 0.28, volume: 0.2, wave: "triangle" },
    ],
    "Nao foi possivel reproduzir o alerta de carrinho abandonado:",
  );
}
