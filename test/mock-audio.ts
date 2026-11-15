/**
 * Lightweight Web Audio API Mock for Vitest Headless Environment
 */

class MockAudioParam {
  value: number;
  constructor(defaultValue = 0) {
    this.value = defaultValue;
  }
  setValueAtTime(v: number) { this.value = v; }
  setTargetAtTime(v: number) { this.value = v; }
  linearRampToValueAtTime(v: number) { this.value = v; }
  exponentialRampToValueAtTime(v: number) { this.value = v; }
  cancelScheduledValues(v: number) {}
}

class MockAudioNode {
  connect(dest: any) { return dest; }
  disconnect() {}
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam(440);
  detune = new MockAudioParam(0);
  start() {}
  stop() {}
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1.0);
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam(1000);
  Q = new MockAudioParam(1.0);
}

class MockStereoPannerNode extends MockAudioNode {
  pan = new MockAudioParam(0.0);
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam(-24);
  knee = new MockAudioParam(30);
  ratio = new MockAudioParam(12);
  attack = new MockAudioParam(0.003);
  release = new MockAudioParam(0.25);
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 256;
  smoothingTimeConstant = 0.8;
  frequencyBinCount = 128;
  getByteTimeDomainData(arr: Uint8Array) { arr.fill(128); }
  getByteFrequencyData(arr: Uint8Array) { arr.fill(64); }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: any = null;
  loop = false;
  start() {}
  stop() {}
}

export class MockAudioContext {
  currentTime = 0.0;
  sampleRate = 44100;
  state: 'suspended' | 'running' | 'closed' = 'running';
  destination = new MockAudioNode();

  createOscillator() { return new MockOscillatorNode(); }
  createGain() { return new MockGainNode(); }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createStereoPanner() { return new MockStereoPannerNode(); }
  createDynamicsCompressor() { return new MockDynamicsCompressorNode(); }
  createAnalyser() { return new MockAnalyserNode(); }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length)
    };
  }

  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

export function setupWebAudioMock(): void {
  if (typeof window !== 'undefined') {
    (window as any).AudioContext = MockAudioContext;
    (window as any).webkitAudioContext = MockAudioContext;
  }
}
