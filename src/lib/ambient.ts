/** Offline ambient focus sounds generated with Web Audio (no files). */
export type AmbientKind = 'off' | 'brown' | 'rain';

let ctx: AudioContext | null = null;
let nodes: AudioNode[] = [];
let gainNode: GainNode | null = null;

function noiseBuffer(ac: AudioContext, kind: Exclude<AmbientKind, 'off'>): AudioBuffer {
  const len = ac.sampleRate * 4;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  // Pink-ish filter state (Paul Kellet) for rain
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
  }
  return buf;
}

export function startAmbient(kind: AmbientKind, volume = 0.35): void {
  stopAmbient();
  if (kind === 'off') return;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = ctx ?? new AC();
  void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = kind === 'rain' ? 'highpass' : 'lowpass';
  filter.frequency.value = kind === 'rain' ? 400 : 900;
  gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5); // gentle fade-in
  src.connect(filter).connect(gainNode).connect(ctx.destination);
  src.start();
  nodes = [src, filter, gainNode];
}

export function stopAmbient(): void {
  if (ctx && gainNode) {
    const g = gainNode;
    const stopAt = ctx.currentTime + 0.6;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, stopAt);
    const old = nodes;
    window.setTimeout(() => {
      for (const n of old) {
        try {
          (n as AudioBufferSourceNode).stop?.();
        } catch {
          // already stopped
        }
        n.disconnect();
      }
    }, 700);
  }
  nodes = [];
  gainNode = null;
}
