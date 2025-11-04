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
  decodeAudioData = jest.fn((_buffer, cb) =>
    cb ? cb('mock-decoded-buffer') : Promise.resolve('mock-decoded-buffer')
  );
  resume = jest.fn().mockResolvedValue(undefined);
  destination = 'mock-destination';
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
    });
  });

  it('load() should fetch manifest and first resource', async () => {
    await player.load('http://localhost/sprite.json');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost/sprite.json');
    // It should fetch the *first* resource from the "resources" array
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost/src/__tests__/audiosprite.ogg'
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

    // Check timings for 'Sound_2' (start: 3, end: 4.008684807256236)
    const source1Result = audioContext.createBufferSource.mock.results[0];
    if (source1Result) {
      const source1 = source1Result.value;
      expect(source1.start).toHaveBeenCalledWith(0, 3, expect.any(Number));
      const duration = source1.start.mock.calls[0][2];
      expect(duration).toBeCloseTo(1.008684807256236);
    }

    // Check timings for 'Sound_3' (start: 6, end: 7.045351473922903)
    const source2Result = audioContext.createBufferSource.mock.results[1];
    if (source2Result) {
      const source2 = source2Result.value;
      expect(source2.start).toHaveBeenCalledWith(0, 6, expect.any(Number));
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
});
