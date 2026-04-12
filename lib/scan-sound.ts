export type ScanSoundKind = "success" | "error";

const SOUND_SRC: Record<ScanSoundKind, string> = {
  success: "/sounds/scan-success.wav",
  error: "/sounds/scan-error.mp3",
};

const audioCache: Partial<Record<ScanSoundKind, HTMLAudioElement>> = {};

function getAudioElement(kind: ScanSoundKind) {
  if (typeof window === "undefined") return null;

  if (!audioCache[kind]) {
    const audio = new Audio(SOUND_SRC[kind]);
    audio.preload = "auto";
    audioCache[kind] = audio;
  }

  return audioCache[kind] ?? null;
}

export async function primeScanSound() {
  const successAudio = getAudioElement("success");
  const errorAudio = getAudioElement("error");

  if (!successAudio || !errorAudio) return false;

  try {
    successAudio.load();
    errorAudio.load();
    return true;
  } catch {
    return false;
  }
}

export async function playScanSound(kind: ScanSoundKind) {
  const audio = getAudioElement(kind);
  if (!audio) return false;

  try {
    audio.pause();
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
