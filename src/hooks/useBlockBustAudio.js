import { useEffect, useEffectEvent, useRef } from 'react';

const TONE_MAP = {
  select: [320, 0.06, 0.03, 'triangle'],
  place: [220, 0.08, 0.05, 'square'],
  clear: [470, 0.11, 0.04, 'triangle'],
  perfect: [720, 0.18, 0.05, 'sine'],
  over: [145, 0.2, 0.045, 'sawtooth'],
  levelup: [660, 0.16, 0.045, 'sine'],
  undo: [180, 0.07, 0.03, 'triangle'],
  combo: [540, 0.09, 0.035, 'triangle'],
};

export function useBlockBustAudio(enabled) {
  const audioCtxRef = useRef(null);

  useEffect(() => () => {
    const ctx = audioCtxRef.current;
    if (ctx?.close) {
      ctx.close().catch(() => {});
    }
  }, []);

  return useEffectEvent((type, comboLevel = 0) => {
    if (!enabled) return;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;

    try {
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const tone = TONE_MAP[type] || [240, 0.05, 0.02, 'triangle'];

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = tone[3];
      osc.frequency.setValueAtTime(
        tone[0] + (type === 'combo' ? Math.min(comboLevel, 6) * 60 : 0),
        now,
      );
      gain.gain.setValueAtTime(tone[2], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone[1]);

      osc.start(now);
      osc.stop(now + tone[1]);
    } catch {}
  });
}

export default useBlockBustAudio;
