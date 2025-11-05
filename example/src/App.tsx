import {
  StyleSheet,
  View,
  Text,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { AudioSpritePlayer } from '../../src';
// Assuming the configuration tool is AudioManager or AudioSession
import { AudioManager, AudioContext } from 'react-native-audio-api';
import { useEffect, useState, useRef } from 'react';
import { Asset } from 'expo-asset';
import { fetch } from 'expo/fetch';
import manifest from '../assets/mygameaudio.json';

// Import the audio asset using require, which gives an Asset object/reference
const audioAsset = require('../assets/mygameaudio.mp3');

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [audiouri, setAudiouri] = useState<string | null>(null);
  // 🚨 CHANGE 1: Use useRef to store the player instance, bypassing useState instability
  const playerRef = useRef<AudioSpritePlayer | null>(null);

  // const audioContextRef = useRef<AudioContext | null>(null);
  // if (!audioContextRef.current) {
  //   audioContextRef.current = new AudioContext();
  // }

  useEffect(() => {
    const loadAudioAsset = async () => {
      const asset = Asset.fromModule(audioAsset);
      await asset.downloadAsync();
      const audioUri = asset.localUri || asset.uri;

      if (!audioUri) {
        console.error('Failed to get audio URI.');
        return;
      }
      console.log('audioUri: ', audioUri);
      setAudiouri(audioUri);
    };

    loadAudioAsset();
  }, []);

  const loadPlayer = async () => {
    if (!audiouri || isLoaded) {
      console.warn('Audio URI not ready or player already loaded.');
      return;
    }

    // 🚨 IOS FIX: Configure AudioManager (essential for mute bypass)
    if (
      Platform.OS === 'ios' &&
      AudioManager &&
      AudioManager.setAudioSessionOptions
    ) {
      try {
        await AudioManager.setAudioSessionOptions({
          iosCategory: 'playback',
          iosOptions: ['mixWithOthers', 'defaultToSpeaker', 'duckOthers'],
          iosAllowHaptics: false,
        });
        // 🚨 CRITICAL: Activate the session immediately after configuring
        await AudioManager.setAudioSessionActivity(true);
        console.log('iOS Audio session configured and activated.');
      } catch (e) {
        console.error('Failed to configure AudioSession options:', e);
      }
    }
    // --------------------------------------------------------------------------

    // 2. Initialize and load the AudioSpritePlayer
    const audioContext = new AudioContext();
    const audioPlayer = new AudioSpritePlayer({
      audioContext,
      fetch: fetch.bind(globalThis),
      platform: Platform.OS,
    });

    // Pass the *URI* to the load function
    audioPlayer
      .load(manifest, audiouri)
      .then(() => {
        // WARMUP PLAY: Activates the audio route on iOS (essential for first play)
        //audioPlayer.play('Sound_1');

        console.log(
          'Audio sprite loaded successfully and played warmup sound.'
        );
        // 🚨 CHANGE 2: Store player in ref and update simple state flag
        playerRef.current = audioPlayer;
        setIsLoaded(true);
      })
      .catch((error) => {
        console.error('Failed to load audio sprite:', error);
      });
  };

  // 🚨 CHANGE 3: Use the ref to access the stable player instance
  const playSound = (soundName: string) => {
    const player = playerRef.current;
    if (player && isLoaded) {
      // The buffer should now be stable inside the ref-managed instance.
      player.play(soundName);

      console.log(`Playing sound: ${soundName}`);
    } else {
      console.warn('Player not loaded. Press "Load Player" first.');
    }
  };

  const stopBGM = () => {
    const player = playerRef.current;
    if (player) {
      player.stop();
    }
  };

  return (
    <View style={styles.container}>
      <Text>Initialize with explicit user input - Autoplay Policy</Text>
      <TouchableOpacity
        onPress={() => loadPlayer()}
        style={!audiouri ? styles.buttonDisabled : styles.button}
        disabled={!audiouri}
      >
        <Text style={styles.buttonText}>Load Player</Text>
      </TouchableOpacity>
      <Text style={{ paddingVertical: 3 }}>AudioSprite Player Example</Text>

      <TouchableOpacity
        onPress={() => playSound('Sound_1')}
        style={isLoaded ? styles.button : styles.buttonDisabled}
        disabled={!isLoaded}
      >
        <Text style={styles.buttonText}>Play Sound 1</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => playSound('Sound_2')}
        style={isLoaded ? styles.button : styles.buttonDisabled}
        disabled={!isLoaded}
      >
        <Text style={styles.buttonText}>Play Sound 2</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => playSound('Sound_3')}
        style={isLoaded ? styles.button : styles.buttonDisabled}
        disabled={!isLoaded}
      >
        <Text style={styles.buttonText}>Play Sound 3</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => playSound('bg_loop')}
        style={isLoaded ? styles.button : styles.buttonDisabled}
        disabled={!isLoaded}
      >
        <Text style={styles.buttonText}>Play Background Loop</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={stopBGM}
        style={isLoaded ? styles.button : styles.buttonDisabled}
        disabled={!isLoaded}
      >
        <Text style={styles.buttonText}>Stop BGM</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#8a9ddbff',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
  },
  buttonDisabled: {
    backgroundColor: '#6c6c6cff',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    userSelect: 'none',
  },
  buttonText: {
    color: '#000000',
    textAlign: 'center',
  },
});
