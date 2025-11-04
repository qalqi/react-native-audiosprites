const { AudioSpritePlayer } = require('../../src');

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

// Mock manifest from 'audiosprite'
const MOCK_MANIFEST = {
  resources: ['sprite.mp3', 'sprite.ogg'],
  spritemap: {
    coin: { start: 0.5, end: 1.0, loop: false },
    jump: { start: 1.2, end: 2.0, loop: false },
  },
};

// --- Tests ---

describe('@audiosprites/player (Web)', () => {
  let audioContext: MockAudioContext;
  let player: typeof AudioSpritePlayer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetch.mockImplementation((url) => {
      if (url.endsWith('.json')) {
        return Promise.resolve({
          ok: true,
          url: 'http://localhost/sprite.json',
          json: () => Promise.resolve(MOCK_MANIFEST),
        });
      }
      if (url.endsWith('.mp3') || url.endsWith('.ogg')) {
        return Promise.resolve({
          ok: true,
          url: 'http://localhost/sprite.mp3',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    audioContext = new MockAudioContext();
    player = new AudioSpritePlayer({
      audioContext: audioContext as any,
      fetch: mockFetch,
    });
  });

  it('load() should fetch manifest and first resource', async () => {
    await player.load('http://localhost/sprite.json');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost/sprite.json');
    // It should fetch the *first* resource from the "resources" array
    expect(mockFetch).toHaveBeenCalledWith('http://localhost/sprite.mp3');

    expect(audioContext.decodeAudioData).toHaveBeenCalled();
    expect(player.getManifest()).toEqual(MOCK_MANIFEST);
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
    player.play('jump');

    expect(audioContext.createBufferSource).toHaveBeenCalledTimes(1);
    const mockSourceResult = audioContext.createBufferSource.mock.results[0];
    if (mockSourceResult) {
      const mockSource = mockSourceResult.value;
      // Check the 'audiosprite' format timings
      // sound.start = 1.2, sound.end = 2.0
      // duration = 2.0 - 1.2 = 0.8
      expect(mockSource.start).toHaveBeenCalledWith(
        0, // when
        1.2, // offset (from spritemap.jump.start)
        0.8 // duration (calculated from end - start)
      );
    }
  });

  it('play() should allow multiple overlapping sounds', async () => {
    await player.load('http://localhost/sprite.json');

    player.play('coin');
    player.play('jump');

    expect(audioContext.createBufferSource).toHaveBeenCalledTimes(2);

    // Check timings for 'coin' (start: 0.5, end: 1.0)
    const source1Result = audioContext.createBufferSource.mock.results[0];
    if (source1Result) {
      const source1 = source1Result.value;
      expect(source1.start).toHaveBeenCalledWith(0, 0.5, 0.5);
    }

    // Check timings for 'jump' (start: 1.2, end: 2.0)
    const source2Result = audioContext.createBufferSource.mock.results[1];
    if (source2Result) {
      const source2 = source2Result.value;
      expect(source2.start).toHaveBeenCalledWith(0, 1.2, 0.8);
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
