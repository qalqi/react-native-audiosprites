import { StyleSheet, View, Text, Button } from 'react-native';
import { AudioSpritePlayer } from 'react-native-audiosprites';
import { AudioContext } from 'react-native-audio-api';
import manifest from '../assets/audiosprite.json';
import { useEffect, useState } from 'react';

// In a real app, you would want to resolve the asset path in a more robust way.
// For this example, we are assuming the packager is running at the default port.
const audio = 'http://localhost:8081/assets/src/__tests__/audiosprite.mp3';

export default function App() {
  const [player, setPlayer] = useState<AudioSpritePlayer | null>(null);

  useEffect(() => {
    const audioContext = new AudioContext();
    const audioPlayer = new AudioSpritePlayer({
      audioContext,
      fetch: fetch,
    });

    audioPlayer.load(manifest, audio).then(() => {
      console.log('Audio sprite loaded successfully.');
      setPlayer(audioPlayer);
    });
  }, []);

  const playSound = (soundName: string) => {
    if (player) {
      player.play(soundName);
    }
  };

  return (
    <View style={styles.container}>
      <Text>AudioSprite Player Example</Text>
      <Button title="Play Sound 1" onPress={() => playSound('Sound_1')} />
      <Button title="Play Sound 2" onPress={() => playSound('Sound_2')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});