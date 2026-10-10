// Pip's voice: Text-to-Speech audio guide for morning routines.
import * as profile from '../features/profile.js';

let synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

export const isSupported = () => !!synth;
export const isEnabled = () => !!profile.get().pipVoiceEnabled;

export function speak(text, { pitch = 1.15, rate = 1.05, force = false } = {}) {
  if (!synth || (!isEnabled() && !force)) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text || ''));
    u.pitch = pitch;
    u.rate = rate;
    // Pick an English voice if available
    const voices = synth.getVoices?.() || [];
    const en = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Online') || v.localService));
    if (en) u.voice = en;
    synth.speak(u);
  } catch (e) {
    console.warn('Pip TTS error:', e);
  }
}

export function stop() {
  try { synth?.cancel(); } catch {}
}

export function announceAlarm(name = '') {
  const who = name ? `, ${name}` : '';
  speak(`Good morning${who}! Up you get. The day starts now!`);
}

export function announceTaskReady(taskName) {
  speak(`${taskName} is ready! Time to prove it.`);
}

export function announceCheckin() {
  speak('Check-in time! Are you still up? Tap I’m up!');
}

export function announceProven(letter = 'A', name = '') {
  const who = name ? ` ${name}` : '';
  speak(`Morning proven${who}! Your grade is ${letter}. Have an awesome day!`);
}
