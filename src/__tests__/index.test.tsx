const { AudioSpritePlayer: AudioSpritePlayerClass } = require('../../src');
const MOCK_MANIFEST_AUDIO = require('./audiosprite.json');

// --- Mocks ---

// Mock Web Audio API
class MockGainNode {
  context: MockAudioContext;
  gain: { setValueAtTime: jest.Mock };
  constructor(ctx: MockAudioContext) {
    this.context = ctx;
    this.gain = { setValueAtTime: jest.fn() };
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
  constructor(ctx: MockAudioContext) {
    this.context = ctx;
    this.buffer = null;
  }
  connect = jest.fn();
  start = jest.fn();
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
}

class MockBufferQueueSourceNode {
  context: MockAudioContext;
  onEnded: (() => void) | null = null;
  constructor(ctx: MockAudioContext) {
    this.context = ctx;
  }
  enqueueBuffer = jest.fn();
  connect = jest.fn();
  start = jest.fn();
  stop = jest.fn();
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
    const mockSource = mockSourceResult.value;
    expect(mockSource.stop).not.toHaveBeenCalled();

    player.stop();
    expect(mockSource.stop).toHaveBeenCalledTimes(1);
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
      expect(mockSource.start).toHaveBeenCalledWith(0);
      expect(mockSource.onEnded).toBeInstanceOf(Function);

      // Simulate the onEnded callback being called
      mockSource.onEnded();

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
    const mockSource = mockSourceResult.value;
    expect(mockSource.stop).not.toHaveBeenCalled();

    player.stop();
    expect(mockSource.stop).toHaveBeenCalledTimes(1);
  });
});
