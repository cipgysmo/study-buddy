const SOUNDS = {
  fanfare: "/sounds/fanfare.wav",
  encourage: "/sounds/encourage.wav",
} as const;

export type SoundName = keyof typeof SOUNDS;

let muted = false;
let ctx: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();

export function setSoundMuted(m: boolean): void {
  muted = m;
}

/** Fetch the persisted sound preference and apply it. Safe to call repeatedly. */
export async function loadSoundSetting(): Promise<void> {
  try {
    const r = await fetch("/api/settings/sound");
    if (!r.ok) return;
    const d = (await r.json()) as { sound?: string };
    muted = d.sound !== "on";
  } catch {
    /* keep current state */
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

async function getBuffer(name: SoundName): Promise<AudioBuffer | null> {
  const cached = buffers.get(name);
  if (cached) return cached;
  try {
    const r = await fetch(SOUNDS[name]);
    if (!r.ok) return null;
    const c = getCtx();
    if (!c) return null;
    const data = await r.arrayBuffer();
    const buf = await c.decodeAudioData(data);
    buffers.set(name, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Play a sound effect. No-op when muted or unsupported. Never throws. */
export async function playSound(name: SoundName): Promise<void> {
  if (muted) return;
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") await c.resume();
    const buf = await getBuffer(name);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = 0.5;
    src.connect(gain).connect(c.destination);
    src.start();
  } catch {
    /* ignore */
  }
}
