/** * AUTO-GENERATED NATIVE AUDIO EXTENSIONS
 * This file provides types for react-native-audio-api without requiring it as a runtime dependency.
 */

interface BaseAudioContext {
  readonly destination: IAudioDestinationNode;
  readonly state: ContextState;
  readonly sampleRate: number;
  readonly currentTime: number;

  createRecorderAdapter(): IRecorderAdapterNode;
  createWorkletSourceNode(
    shareableWorklet: ShareableWorkletCallback,
    shouldUseUiRuntime: boolean
  ): IWorkletSourceNode;
  createWorkletNode(
    shareableWorklet: ShareableWorkletCallback,
    shouldUseUiRuntime: boolean,
    bufferLength: number,
    inputChannelCount: number
  ): IWorkletNode;
  createWorkletProcessingNode(
    shareableWorklet: ShareableWorkletCallback,
    shouldUseUiRuntime: boolean
  ): IWorkletProcessingNode;
  createOscillator(): IOscillatorNode;
  createConstantSource(): IConstantSourceNode;
  createGain(): IGainNode;
  createStereoPanner(): IStereoPannerNode;
  createBiquadFilter: () => IBiquadFilterNode;
  createBufferSource: (pitchCorrection: boolean) => IAudioBufferSourceNode;
  createBufferQueueSource: (
    pitchCorrection: boolean
  ) => IAudioBufferQueueSourceNode;
  createBuffer: (
    channels: number,
    length: number,
    sampleRate: number
  ) => IAudioBuffer;
  createPeriodicWave: (
    real: Float32Array,
    imag: Float32Array,
    disableNormalization: boolean
  ) => IPeriodicWave;
  createAnalyser: () => IAnalyserNode;
  decodeAudioDataSource: (sourcePath: string) => Promise<IAudioBuffer>;
  decodeAudioData: (arrayBuffer: ArrayBuffer) => Promise<IAudioBuffer>;
  decodePCMAudioDataInBase64: (
    b64: string,
    playbackRate: number
  ) => Promise<IAudioBuffer>;
  createStreamer: () => IStreamerNode;
}

interface AudioBufferQueueSourceNode extends IAudioBufferBaseSourceNode {
  dequeueBuffer: (bufferId: number) => void;
  clearBuffers: () => void;

  // returns bufferId
  enqueueBuffer: (audioBuffer: IAudioBuffer) => string;
  pause: () => void;
}
/**
 * Global Augmentation to merge Native methods into standard Web Audio types
 */
declare global {
  interface AudioContext extends ExtendedAudioContext {}
  interface OfflineAudioContext extends ExtendedAudioContext {}
}

interface ExtendedAudioContext {
  /**
   * Native-only: Creates a high-performance buffer queue for seamless looping and low-latency.
   * Not available in standard Browser AudioContext.
   */
  createBufferQueueSource(): AudioBufferQueueSourceNode;
}
