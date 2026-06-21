const { AudioSpritePlayer: AudioSpritePlayerClass } = require('../../src');
const MOCK_MANIFEST_AUDIO = require('./audiosprite.json');

// --- Mocks ---

// Mock Web Audio API
class MockGainNode {
  context: MockAudioContext;
  gain: {
    setValueAtTime: jest.Mock;
    value: number;
    setTargetAtTime: jest.Mock;
    linearRampToValueAtTime: jest.Mock;
  };
  constructor(ctx: MockAudioContext) {
    this.context = ctx;
    this.gain = {
      setValueAtTime: jest.fn(),
      value: 1,
      setTargetAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
    };
  }
  connect = jest.fn();
}
class MockBufferSourceNode {
  context: MockAudioContext;
  buffer: null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  stop = jest.fn();
  playbackRate = { value: 1 };
  constructor(ctx: MockAudioContext) {
    this.context = ctx;
    this.buffer = null;
  }
  connect = jest.fn();
  start = jest.fn();
  disconnect = jest.fn();
}
class MockAudioContext {
  currentTime = 0;
  state = 'running';
  createBufferSource = jest.fn(() => new MockBufferSourceNode(this));
  createGain = jest.fn(() => new MockGainNode(this));
  createBuffer = jest.fn((numberOfChannels, length) => ({
    numberOfChannels,
    length,
    sampleRate: 44100,
    getChannelData: () => new Float32Array(length),
  }));
  decodeAudioData = jest.fn((_buffer, cb) =>
    cb
      ? cb({
          numberOfChannels: 2,
          length: 44100,
          sampleRate: 44100,
          getChannelData: () => new Float32Array(44100),
        })
      : Promise.resolve({
          numberOfChannels: 2,
          length: 44100,
          sampleRate: 44100,
          getChannelData: () => new Float32Array(44100),
        })
  );
  resume = jest.fn().mockResolvedValue(undefined);
  destination = 'mock-destination';
  createBufferQueueSource = jest.fn(() => new MockBufferQueueSourceNode(this));
  createStereoPanner = jest.fn(() => ({
    pan: { value: 0 },
    connect: jest.fn(),
  }));
}

class MockBufferQueueSourceNode {
  context: MockAudioContext;
  onEnded: (() => void) | null = null;
  onBufferEnded: (() => void) | null = null;
  playbackRate = { value: 1 };
  constructor(ctx: MockAudioContext) {
    this.context = ctx;
  }
  enqueueBuffer = jest.fn();
  connect = jest.fn();
  start = jest.fn();
  stop = jest.fn();
  disconnect = jest.fn();
}

// Mock fetch
const mockFetch = jest.fn();

// --- Tests ---

describe('@audiosprites/player (Web)', () => {
  let audioContext: MockAudioContext;
  let player: typeof AudioSpritePlayerClass;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetch.mockImplementation((url) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({
          ok: true,
          url: 'http://localhost/sprite.json',
          json: () => Promise.resolve(MOCK_MANIFEST_AUDIO),
        });
      }
      if (
        url.endsWith('.mp3') ||
        url.endsWith('.ogg') ||
        url.endsWith('.m4a') ||
        url.endsWith('.ac3')
      ) {
        return Promise.resolve({
          ok: true,
          url: 'http://localhost/sprite.mp3',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    audioContext = new MockAudioContext();
    player = new AudioSpritePlayerClass({
      audioContext: audioContext as any,
      fetch: mockFetch,
      platform: 'web',
    });
  });

  it('constructor() should initialize gain nodes and mixer graph', () => {
    // Check if gain nodes are created
    expect(audioContext.createGain).toHaveBeenCalledTimes(3);

    // Get the created gain node instances
    const gainNodes = audioContext.createGain.mock.results.map((r) => r.value);
    const masterGain = gainNodes[0];
    const sfxGain = gainNodes[1];
    const musicGain = gainNodes[2];

    // Verify connections
    // Master -> Destination
    expect(masterGain.connect).toHaveBeenCalledWith(audioContext.destination);

    // Channels -> Master
    expect(sfxGain.connect).toHaveBeenCalledWith(masterGain);
    expect(musicGain.connect).toHaveBeenCalledWith(masterGain);
  });

  it('volume setters should call setTargetAtTime on gain nodes', () => {
    // Master Volume
    player.volume = 0.5;
    const masterGain = (player as any).masterGain;
    expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.5,
      expect.any(Number),
      0.02
    );

    // Music Volume
    player.setMusicVolume(0.3);
    const musicGain = (player as any).musicGain;
    expect(musicGain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.3,
      expect.any(Number),
      0.02
    );

    // SFX Volume
    player.setSFXVolume(0.8);
    const sfxGain = (player as any).sfxGain;
    expect(sfxGain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.8,
      expect.any(Number),
      0.02
    );
  });

  it('play() should route to sfx channel by default', async () => {
    await player.load('http://localhost/sprite.json');
    player.play('Sound_1');

    const sourceResult = audioContext.createBufferSource.mock.results[0];
    if (sourceResult) {
      const source = sourceResult.value;
      const sfxGain = (player as any).sfxGain;

      // Check connection to SFX gain node
      expect(source.connect).toHaveBeenCalledWith(sfxGain);
    }
  });

  it('play() should route to music channel when specified', async () => {
    await player.load('http://localhost/sprite.json');
    player.play('Sound_1', { channel: 'music' });

    const sourceResult = audioContext.createBufferSource.mock.results[0];
    if (sourceResult) {
      const source = sourceResult.value;
      const musicGain = (player as any).musicGain;

      // Check connection to Music gain node
      expect(source.connect).toHaveBeenCalledWith(musicGain);
    }
  });

  it('load() should fetch manifest and first resource', async () => {
    await player.load('http://localhost/sprite.json');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost/sprite.json');
    // It should fetch the *first* resource from the "resources" array
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost/src/__tests__/sounds/mygameaudio.ogg'
    );

    expect(audioContext.decodeAudioData).toHaveBeenCalled();
    expect(player.getManifest()).toEqual(MOCK_MANIFEST_AUDIO);
  });

  it('load() should throw if manifest format is invalid', async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ invalid: 'format' }),
      })
    );

    await expect(player.load('bad.json')).rejects.toThrow(
      'Invalid audiosprite manifest format'
    );
  });

  it('play() should calculate duration and start source with correct timings', async () => {
    await player.load('http://localhost/sprite.json');
    player.play('Sound_1');

    expect(audioContext.createBufferSource).toHaveBeenCalledTimes(1);
    const mockSourceResult = audioContext.createBufferSource.mock.results[0];
    if (mockSourceResult) {
      const mockSource = mockSourceResult.value;
      // Check that the buffer is the sprite buffer
      expect(mockSource.buffer).toBeDefined();
      // Check the 'audiosprite' format timings
      // sound.start = 0, sound.end = 1.0453514739229024
      // duration = 1.0453514739229024
      expect(mockSource.start).toHaveBeenCalledWith(0, 0, expect.any(Number));
      const duration = mockSource.start.mock.calls[0][2];
      expect(duration).toBeCloseTo(1.0453514739229024);
    }
  });

  it('play() should allow multiple overlapping sounds', async () => {
    await player.load('http://localhost/sprite.json');

    player.play('Sound_2');
    player.play('Sound_3');

    expect(audioContext.createBufferSource).toHaveBeenCalledTimes(2);

    // Check timings for 'Sound_2' (start: 39, end: 40.008684807256236)
    const source1Result = audioContext.createBufferSource.mock.results[0];
    if (source1Result) {
      const source1 = source1Result.value;
      expect(source1.buffer).toBeDefined();
      expect(source1.start).toHaveBeenCalledWith(0, 0, expect.any(Number));
      const duration = source1.start.mock.calls[0][2];
      expect(duration).toBeCloseTo(1.008684807256236);
    }

    // Check timings for 'Sound_3' (start: 42, end: 43.045351473922903)
    const source2Result = audioContext.createBufferSource.mock.results[1];
    if (source2Result) {
      const source2 = source2Result.value;
      expect(source2.buffer).toBeDefined();
      expect(source2.start).toHaveBeenCalledWith(0, 0, expect.any(Number));
      const duration = source2.start.mock.calls[0][2];
      expect(duration).toBeCloseTo(1.045351473922903);
    }
  });

  it('play() should warn if sound is not found in spritemap', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await player.load('http://localhost/sprite.json');
    player.play('not-a-sound');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Sound "not-a-sound" not found in spritemap.'
    );
    consoleWarnSpy.mockRestore();
  });

  it('play() should handle looping sounds', async () => {
    await player.load('http://localhost/sprite.json');
    player.play('bg_loop');

    expect(audioContext.createBufferSource).toHaveBeenCalledTimes(1);
    const mockSourceResult = audioContext.createBufferSource.mock.results[0];
    if (mockSourceResult) {
      const mockSource = mockSourceResult.value;
      expect(mockSource.loop).toBe(true);
      expect(mockSource.loopStart).toBe(0);
      expect(mockSource.loopEnd).toBeCloseTo(34.43947845804988);
    }
  });

  it('load() should load from a manifest object and an array buffer', async () => {
    const arrayBuffer = new ArrayBuffer(8);
    await player.load(MOCK_MANIFEST_AUDIO, arrayBuffer);

    expect(audioContext.decodeAudioData).toHaveBeenCalledWith(arrayBuffer);
    expect(player.getManifest()).toEqual(MOCK_MANIFEST_AUDIO);
  });

  it('stop() should stop the currently looping sound', async () => {
    await player.load('http://localhost/sprite.json');
    player.play('bg_loop');

    const mockSourceResult = audioContext.createBufferSource.mock.results[0];
    if (mockSourceResult) {
      const mockSource = mockSourceResult.value;
      expect(mockSource.stop).not.toHaveBeenCalled();

      player.stop();
      expect(mockSource.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('play() should support pitch, panning, and throttling options', async () => {
    await player.load('http://localhost/sprite.json');

    // 1. Test pitch
    player.play('Sound_1', { pitch: 1.5 });
    const source1 = audioContext.createBufferSource.mock.results[0]!.value;
    expect(source1.playbackRate.value).toBe(1.5);

    // 2. Test panning
    player.play('Sound_1', { pan: -0.7 });
    expect(audioContext.createStereoPanner).toHaveBeenCalledTimes(1);
    const pannerMock = audioContext.createStereoPanner.mock.results[0]!.value;
    expect(pannerMock.pan.value).toBe(-0.7);

    // 3. Test throttling
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    player.play('Sound_1', { throttleMs: 100 }); // Play at time T
    player.play('Sound_1', { throttleMs: 100 }); // Play immediately again (should be throttled)

    // We had 2 plays from previous tests, plus the first throttled play. Total = 3.
    // The second throttled play should not create a new source.
    expect(audioContext.createBufferSource).toHaveBeenCalledTimes(3);

    // Advance time by 150ms and play again
    jest.spyOn(Date, 'now').mockReturnValue(now + 150);
    player.play('Sound_1', { throttleMs: 100 });
    expect(audioContext.createBufferSource).toHaveBeenCalledTimes(4);

    jest.restoreAllMocks();
  });

  it('fadeInMusic() and fadeOutMusic() should perform volume ramp transitions', async () => {
    jest.useFakeTimers();
    await player.load('http://localhost/sprite.json');

    player.fadeInMusic('bg_loop', 1000);
    const musicGain = (player as any).musicGain;
    expect(musicGain.gain.setValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number)
    );
    expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1.0,
      expect.any(Number)
    );

    player.fadeOutMusic(1000);
    expect(musicGain.gain.setValueAtTime).toHaveBeenCalledWith(
      1.0,
      expect.any(Number)
    );
    expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number)
    );

    // Fast-forward to let the fade out setTimeout complete
    jest.advanceTimersByTime(1000);
    jest.useRealTimers();
  });
});

describe('@audiosprites/player (Mobile)', () => {
  let audioContext: MockAudioContext;
  let player: typeof AudioSpritePlayerClass;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetch.mockImplementation((url) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({
          ok: true,
          url: 'http://localhost/sprite.json',
          json: () => Promise.resolve(MOCK_MANIFEST_AUDIO),
        });
      }
      if (
        url.endsWith('.mp3') ||
        url.endsWith('.ogg') ||
        url.endsWith('.m4a') ||
        url.endsWith('.ac3')
      ) {
        return Promise.resolve({
          ok: true,
          url: 'http://localhost/sprite.mp3',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    audioContext = new MockAudioContext();
    player = new AudioSpritePlayerClass({
      audioContext: audioContext as any,
      fetch: mockFetch,
      platform: 'ios',
    });
  });

  it('play() should handle looping sounds', async () => {
    await player.load('http://localhost/sprite.json');
    player.play('bg_loop');

    expect(audioContext.createBufferQueueSource).toHaveBeenCalledTimes(1);
    const mockSourceResult =
      audioContext.createBufferQueueSource.mock.results[0];
    if (mockSourceResult) {
      const mockSource = mockSourceResult.value;
      expect(mockSource.enqueueBuffer).toHaveBeenCalledTimes(1);
      expect(mockSource.start).toHaveBeenCalledWith(0, 0);
      expect(mockSource.onBufferEnded).toBeInstanceOf(Function);

      // Simulate the onBufferEnded callback being called
      mockSource.onBufferEnded();

      // Expect enqueueBuffer and start to be called again for looping
      expect(mockSource.enqueueBuffer).toHaveBeenCalledTimes(2);
      expect(mockSource.start).toHaveBeenCalledTimes(2);
    }
  });

  it('stop() should stop the currently looping sound', async () => {
    await player.load('http://localhost/sprite.json');
    player.play('bg_loop');

    const mockSourceResult =
      audioContext.createBufferQueueSource.mock.results[0];
    if (mockSourceResult) {
      const mockSource = mockSourceResult.value;
      expect(mockSource.stop).not.toHaveBeenCalled();

      player.stop();
      expect(mockSource.stop).toHaveBeenCalledTimes(1);
    }
  });
});
