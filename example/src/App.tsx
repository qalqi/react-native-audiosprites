import {
  StyleSheet,
  View,
  Text,
  Platform,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Switch,
} from 'react-native';
import { AudioSpritePlayer } from '../../src';
import { AudioManager, AudioContext } from 'react-native-audio-api';
import { useEffect, useState, useRef } from 'react';
import { Asset } from 'expo-asset';
import { fetch } from 'expo/fetch';
import manifest from '../assets/mygameaudio.json';
import Slider from '@react-native-community/slider';
import { Canvas, Path } from '@shopify/react-native-skia';

// Assuming the audio asset is locally available
const audioAsset = require('../assets/mygameaudio.mp3');

// --- THEME CONSTANTS ---
const COLORS = {
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  primary: '#4F46E5', // Indigo
  primaryDisabled: '#A5B4FC',
  music: '#10B981', // Emerald
  musicDisabled: '#A7F3D0',
  danger: '#EF4444',
  border: '#E5E7EB',
  canvasBg: '#111827',
};

// --- VISUALIZER COMPONENT ---
interface VisualizerProps {
  analyserRef: React.MutableRefObject<any>;
}

const Visualizer = ({ analyserRef }: VisualizerProps) => {
  const [svgPathString, setSvgPathString] = useState<string>('M 0 50 L 10 50');
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      if (analyserRef.current) {
        const { analyser, dataArray, bufferLength } = analyserRef.current;
        analyser.getByteFrequencyData(dataArray);

        const canvasHeight = 100;
        const paddingBottom = 10;
        const barWidth = 6;
        const gap = 4;
        const startX = 12;

        let pathBuilderString = '';

        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const barHeight = percent * (canvasHeight - paddingBottom * 2);

          const x = startX + i * (barWidth + gap);
          const y = canvasHeight - paddingBottom - barHeight;
          const heightComputed = Math.max(barHeight, 2);

          pathBuilderString += ` M ${x} ${y} h ${barWidth} v ${heightComputed} h -${barWidth} Z`;
        }

        if (pathBuilderString) {
          setSvgPathString(pathBuilderString);
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserRef]);

  return (
    <Canvas style={styles.visualizerCanvas}>
      <Path path={svgPathString} color={COLORS.music} />
    </Canvas>
  );
};

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [audiouri, setAudiouri] = useState<string | null>(null);
  const playerRef = useRef<AudioSpritePlayer | null>(null);

  // Advanced playback states
  const [pitch, setPitch] = useState(1.0);
  const [pan, setPan] = useState(0.0);
  const [isThrottled, setIsThrottled] = useState(false);

  // Volume states for synchronization
  const [masterVolume, setMasterVolumeState] = useState(1.0);
  const [musicVolume, setMusicVolumeState] = useState(1.0);
  const [sfxVolume, setSfxVolumeState] = useState(1.0);

  // --- VISUALIZER REFERENCE ---
  const analyserRef = useRef<any>(null);

  useEffect(() => {
    const loadAudioAsset = async () => {
      try {
        const asset = Asset.fromModule(audioAsset);
        await asset.downloadAsync();
        const audioUri = asset.localUri || asset.uri;

        if (!audioUri) {
          console.error('Failed to get audio URI.');
          return;
        }
        console.log('audioUri: ', audioUri);
        setAudiouri(audioUri);
      } catch (err) {
        console.error('Error loading asset', err);
      }
    };

    loadAudioAsset();
  }, []);

  const loadPlayer = async () => {
    console.log(
      'APP: loadPlayer called, audiouri=',
      audiouri,
      'isLoaded=',
      isLoaded
    );
    if (!audiouri || isLoaded) {
      console.warn('Audio URI not ready or player already loaded.');
      return;
    }

    if (
      Platform.OS === 'ios' &&
      AudioManager &&
      AudioManager.setAudioSessionOptions
    ) {
      try {
        await AudioManager.setAudioSessionOptions({
          iosCategory: 'playback',
          iosOptions: ['mixWithOthers', 'duckOthers'],
          iosAllowHaptics: false,
        });
        await AudioManager.setAudioSessionActivity(true);
      } catch (e) {
        console.error('Failed to configure AudioSession options:', e);
      }
    }

    const audioContext = new AudioContext();

    // Setup standard AnalyserNode
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current = { analyser, dataArray, bufferLength };

    const audioPlayer = new AudioSpritePlayer({
      audioContext,
      fetch: fetch.bind(globalThis),
      platform: Platform.OS,
      debug: true,
    });

    // Safely insert AnalyserNode into the playback routing chain
    try {
      audioPlayer.masterGain.disconnect();
      audioPlayer.masterGain.connect(analyser);
      analyser.connect(audioContext.destination);
    } catch (err) {
      console.warn('Failed to route masterGain through AnalyserNode:', err);
    }

    audioPlayer
      .load(manifest, audiouri)
      .then(() => {
        console.log('Audio sprite loaded successfully.');
        playerRef.current = audioPlayer;
        setIsLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to load audio sprite:', error);
      });
  };

  const playSound = (
    soundName: string,
    options?: { channel?: 'sfx' | 'music'; loop?: boolean }
  ) => {
    const player = playerRef.current;
    if (player && isLoaded) {
      player.play(soundName, {
        ...options,
        pitch: options?.channel === 'music' ? 1.0 : pitch,
        pan: options?.channel === 'music' ? 0.0 : pan,
        throttleMs:
          isThrottled && options?.channel !== 'music' ? 300 : undefined,
      });
    } else {
      console.warn('Player not loaded.');
    }
  };

  const stopBGM = () => playerRef.current?.stop();
  const fadeInBGM = () => playerRef.current?.fadeInMusic('bg_loop', 1500);
  const fadeOutBGM = () => playerRef.current?.fadeOutMusic(1500);

  const setMusicVolume = (val: number) => {
    playerRef.current?.setMusicVolume(val);
    setMusicVolumeState(val);
  };
  const setSFXVolume = (val: number) => {
    playerRef.current?.setSFXVolume(val);
    setSfxVolumeState(val);
  };
  const setMasterVolume = (val: number) => {
    if (playerRef.current) playerRef.current.volume = val;
    setMasterVolumeState(val);
  };

  // --- REUSABLE UI COMPONENTS ---
  const ActionButton = ({
    onPress,
    title,
    disabled,
    variant = 'primary',
    style,
  }: any) => {
    const getBgColor = () => {
      if (disabled) {
        if (variant === 'music') return COLORS.musicDisabled;
        return COLORS.primaryDisabled;
      }
      if (variant === 'music') return COLORS.music;
      if (variant === 'danger') return COLORS.danger;
      return COLORS.primary;
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        style={[styles.buttonBase, { backgroundColor: getBgColor() }, style]}
      >
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>
    );
  };

  const VolumeSlider = ({ label, onValueChange, value }: any) => (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        step={0.05}
        value={value}
        minimumTrackTintColor={COLORS.primary}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={COLORS.primary}
        onValueChange={onValueChange}
        disabled={!isLoaded}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.responsiveContainer}>
          {/* HEADER */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Example Demo</Text>
            <Text style={styles.subtitle}>react-native-audiosprites</Text>
            {Platform.OS === 'web' && (
              <Text style={styles.subtitle}>
                Suggestion: Implement the sound loading/playback based on the
                Chrome Autoplay policy guidelines detailed here:
                https://developer.chrome.com/blog/autoplay similar to this
                example.
              </Text>
            )}
          </View>

          {/* INITIALIZATION CARD */}
          {!isLoaded && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Setup</Text>
              <Text style={styles.helperText}>
                Initialize the audio engine to begin playback.
              </Text>
              <ActionButton
                title={audiouri ? 'Initialize Player' : 'Loading Assets...'}
                onPress={loadPlayer}
                disabled={!audiouri}
              />
            </View>
          )}

          {/* LIVE SPECTRUM VISUALIZER CARD */}
          {isLoaded && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Live Spectrum Visualizer</Text>
              <Visualizer analyserRef={analyserRef} />
            </View>
          )}

          {/* SOUNDBOARD CARD */}
          <View style={[styles.card, !isLoaded && styles.cardDisabled]}>
            <Text style={styles.cardTitle}>Soundboard (SFX)</Text>
            <View style={styles.gridContainer}>
              <ActionButton
                title="1"
                onPress={() => playSound('Sound_1')}
                disabled={!isLoaded}
                style={styles.gridButton}
              />
              <ActionButton
                title="2"
                onPress={() => playSound('Sound_2')}
                disabled={!isLoaded}
                style={styles.gridButton}
              />
              <ActionButton
                title="3"
                onPress={() => playSound('Sound_3')}
                disabled={!isLoaded}
                style={styles.gridButton}
              />
            </View>
          </View>

          {/* MUSIC CARD */}
          <View style={[styles.card, !isLoaded && styles.cardDisabled]}>
            <Text style={styles.cardTitle}>Background Music</Text>
            <View style={styles.rowContainer}>
              <ActionButton
                title="▶ Play Loop"
                variant="music"
                onPress={() =>
                  playSound('bg_loop', { channel: 'music', loop: true })
                }
                disabled={!isLoaded}
                style={styles.flexButton}
              />
              <ActionButton
                title="⏹ Stop"
                variant="danger"
                onPress={stopBGM}
                disabled={!isLoaded}
                style={styles.flexButton}
              />
            </View>
            <View style={[styles.rowContainer, { marginTop: 12 }]}>
              <ActionButton
                title="漸 Fade In (1.5s)"
                variant="music"
                onPress={fadeInBGM}
                disabled={!isLoaded}
                style={styles.flexButton}
              />
              <ActionButton
                title="消 Fade Out (1.5s)"
                variant="danger"
                onPress={fadeOutBGM}
                disabled={!isLoaded}
                style={styles.flexButton}
              />
            </View>
          </View>

          {/* ADVANCED PLAYBACK CONTROLS CARD */}
          <View style={[styles.card, !isLoaded && styles.cardDisabled]}>
            <Text style={styles.cardTitle}>Advanced SFX Settings</Text>

            {/* Pitch Control */}
            <View style={styles.sliderRow}>
              <View style={styles.rowSpaceBetween}>
                <Text style={styles.sliderLabel}>Pitch / Speed multiplier</Text>
                <Text style={styles.valueText}>{pitch.toFixed(2)}x</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={2.0}
                step={0.05}
                value={pitch}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.primary}
                onValueChange={setPitch}
                disabled={!isLoaded}
              />
            </View>

            {/* Pan Control */}
            <View style={styles.sliderRow}>
              <View style={styles.rowSpaceBetween}>
                <Text style={styles.sliderLabel}>
                  Stereo Pan (Left to Right)
                </Text>
                <Text style={styles.valueText}>
                  {pan === 0.0
                    ? 'Center'
                    : pan < 0.0
                      ? `${Math.abs(pan).toFixed(2)} Left`
                      : `${pan.toFixed(2)} Right`}
                </Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={-1.0}
                maximumValue={1.0}
                step={0.1}
                value={pan}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={COLORS.primary}
                onValueChange={setPan}
                disabled={!isLoaded}
              />
            </View>

            {/* Throttle Control */}
            <View style={[styles.rowSpaceBetween, { marginTop: 8 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.sliderLabel}>
                  SFX Throttle (300ms Cooldown)
                </Text>
                <Text style={styles.helperText}>Prevents rapid overlaps</Text>
              </View>
              <Switch
                value={isThrottled}
                onValueChange={setIsThrottled}
                disabled={!isLoaded}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
              />
            </View>
          </View>

          {/* MIXER CARD */}
          <View style={[styles.card, !isLoaded && styles.cardDisabled]}>
            <View style={styles.rowSpaceBetween}>
              <Text style={styles.cardTitle}>Audio Mixer</Text>
              <View style={styles.miniButtonRow}>
                <TouchableOpacity
                  onPress={() => setMasterVolume(0)}
                  disabled={!isLoaded}
                >
                  <Text style={styles.linkText}>Mute</Text>
                </TouchableOpacity>
                <Text style={{ color: COLORS.border }}> | </Text>
                <TouchableOpacity
                  onPress={() => setMasterVolume(1)}
                  disabled={!isLoaded}
                >
                  <Text style={styles.linkText}>Max</Text>
                </TouchableOpacity>
              </View>
            </View>

            <VolumeSlider
              label="Master"
              value={masterVolume}
              onValueChange={setMasterVolume}
            />
            <VolumeSlider
              label="Music"
              value={musicVolume}
              onValueChange={setMusicVolume}
            />
            <VolumeSlider
              label="SFX"
              value={sfxVolume}
              onValueChange={setSFXVolume}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  // Wrapper to ensure Web doesn't stretch too wide
  responsiveContainer: {
    width: '100%',
    maxWidth: 500,
    flexDirection: 'column',
    gap: 16,
  },
  headerContainer: {
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Card Styles
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3, // Android shadow
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  visualizerCanvas: {
    width: '100%',
    height: 100,
    backgroundColor: COLORS.canvasBg,
    borderRadius: 8,
  },
  helperText: {
    color: COLORS.textSecondary,
    marginBottom: 16,
    fontSize: 14,
  },

  // Layout Helpers
  gridContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  miniButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16, // align with title
  },

  // Buttons
  buttonBase: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gridButton: {
    flex: 1,
    aspectRatio: 1, // Makes them square
  },
  flexButton: {
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },

  // Sliders
  sliderRow: {
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  valueText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  slider: {
    width: '100%',
    height: 40,
    // Fix for web to ensure cursor works well
    cursor: 'pointer',
  } as any, // 'as any' bypasses TS check for 'cursor' on native types
});
