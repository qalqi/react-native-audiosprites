# RNAS Audio Features Todo List

This list outlines the DSP audio effects and playback features inspired by AudioMass/audio-editor to be added to the `AudioSpritePlayer` engine at runtime.

- [ ] **1. Equalizer & Filters (BiquadFilterNode)**
  - [ ] Support `lowpass`, `highpass`, `bandpass`, and `peaking` filters.
  - [ ] Expose filter frequency, Q factor, and gain configuration dynamically during `.play()`.

- [ ] **2. Feedback Delay & Echo (DelayNode)**
  - [ ] Implement feedback delay loop using a delay node and a gain feedback node.
  - [ ] Expose `delayTime` (seconds) and `feedback` (0.0 to 1.0) parameters.

- [ ] **3. Distortion & Overdrive (WaveShaperNode)**
  - [ ] Generate sigmoid/distortion curves for native/web WaveShaperNodes.
  - [ ] Expose distortion `amount` settings.

- [ ] **4. Dynamics Compressor (DynamicsCompressorNode)**
  - [ ] Add dynamics compressor to master or channel gains to prevent clipping.
  - [ ] Expose `threshold`, `knee`, `ratio`, `attack`, and `release` controls.

- [ ] **5. Reverb Effect (ConvolverNode / Algorithmic Reverb)**
  - [ ] Support impulse response loading for convolution-based reverb.
  - [ ] Implement an algorithmic fallback for platforms without convolver asset loading.

- [ ] **6. Reverse Playback (Buffer Reversing)**
  - [ ] Implement on-the-fly reverse buffer generation for the requested sprite.
  - [ ] Add `reverse: boolean` parameter to `PlayOptions`.

- [ ] **7. Mixer Effects Chain Architecture**
  - [ ] Refactor the internal node graph to allow piping nodes dynamically:
    `Source -> [Pitch/PlaybackRate] -> [Reverse] -> [StereoPanner] -> [Filters/EQ] -> [Delay] -> [Distortion] -> [Compressor] -> [Reverb] -> Mixer Channel Gain -> Master Out`
