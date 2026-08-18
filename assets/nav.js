const byId = (id) => document.getElementById(id);

byId('nav-home')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
byId('brand-home')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
byId('nav-share')?.addEventListener('click', () => byId('share-promise')?.click());
byId('nav-bible')?.addEventListener('click', () => byId('read-bible')?.click());
byId('nav-settings')?.addEventListener('click', () => byId('theme-toggle')?.click());

let audioContext;
function paperRustle() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const duration = 0.42;
    const sampleRate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const envelope = Math.sin(Math.PI * t) * (1 - t * 0.35);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.48;
    }
    const source = audioContext.createBufferSource();
    const highPass = audioContext.createBiquadFilter();
    const bandPass = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    highPass.type = 'highpass';
    highPass.frequency.value = 420;
    bandPass.type = 'bandpass';
    bandPass.frequency.value = 1850;
    bandPass.Q.value = 0.65;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    source.buffer = buffer;
    source.connect(highPass).connect(bandPass).connect(gain).connect(audioContext.destination);
    source.start();
  } catch (_) {}
}

byId('new-promise')?.addEventListener('click', (event) => {
  if (!event.currentTarget.disabled) paperRustle();
}, { passive: true });
