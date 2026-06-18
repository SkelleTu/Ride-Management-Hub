let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine",
  fadeOut = true,
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(gain, startTime);
  if (fadeOut) {
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  }
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export type SoundType =
  | "newRideRequest"
  | "offerReceived"
  | "rideAccepted"
  | "driverArriving"
  | "tripStarted"
  | "tripCompleted"
  | "rideCancelled"
  | "notification";

export function playSound(type: SoundType) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const t = ctx.currentTime;

    switch (type) {
      case "newRideRequest": {
        // Driver: pulsing alert — 3 ascending beeps, attention-grabbing
        playTone(ctx, 440, t,        0.12, 0.4, "square");
        playTone(ctx, 554, t + 0.16, 0.12, 0.4, "square");
        playTone(ctx, 659, t + 0.32, 0.20, 0.5, "square");
        // A brief pause then repeat once for urgency
        playTone(ctx, 440, t + 0.62, 0.10, 0.3, "square");
        playTone(ctx, 659, t + 0.76, 0.18, 0.45, "square");
        break;
      }

      case "offerReceived": {
        // Passenger: soft double-chime "ding-ding" — new driver proposal
        playTone(ctx, 880, t,        0.25, 0.3, "sine");
        playTone(ctx, 1100, t + 0.30, 0.25, 0.28, "sine");
        break;
      }

      case "rideAccepted": {
        // Passenger: ascending 3-note success chime — motorista aceito!
        playTone(ctx, 523, t,        0.18, 0.35, "sine");
        playTone(ctx, 659, t + 0.20, 0.18, 0.35, "sine");
        playTone(ctx, 784, t + 0.40, 0.30, 0.4,  "sine");
        break;
      }

      case "driverArriving": {
        // Passenger: urgent melodic alert — motorista chegando!
        playTone(ctx, 660, t,        0.15, 0.45, "triangle");
        playTone(ctx, 880, t + 0.18, 0.15, 0.45, "triangle");
        playTone(ctx, 660, t + 0.36, 0.15, 0.4,  "triangle");
        playTone(ctx, 880, t + 0.54, 0.25, 0.5,  "triangle");
        break;
      }

      case "tripStarted": {
        // Both: upbeat two-tone start "ready to go"
        playTone(ctx, 523, t,        0.15, 0.35, "sine");
        playTone(ctx, 784, t + 0.18, 0.30, 0.4,  "sine");
        break;
      }

      case "tripCompleted": {
        // Both: celebratory 4-note ascending fanfare
        playTone(ctx, 523, t,        0.15, 0.3, "sine");
        playTone(ctx, 659, t + 0.18, 0.15, 0.3, "sine");
        playTone(ctx, 784, t + 0.36, 0.15, 0.3, "sine");
        playTone(ctx, 1047,t + 0.54, 0.40, 0.5, "sine");
        break;
      }

      case "rideCancelled": {
        // Both: descending two-tone warning
        playTone(ctx, 440, t,        0.20, 0.4, "triangle");
        playTone(ctx, 330, t + 0.25, 0.30, 0.45, "triangle");
        break;
      }

      case "notification": {
        // Generic: single soft ding
        playTone(ctx, 880, t, 0.25, 0.3, "sine");
        break;
      }
    }
  } catch {
    // Audio not available — silently ignore
  }
}
