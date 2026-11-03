import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

interface QuickAudioRowProps {
  uri: string;
  name: string;
  onRemove?: () => void;
}

export function QuickAudioRow({ uri, name, onRemove }: QuickAudioRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  function togglePlay() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.duration > 0 && status.currentTime >= status.duration) {
      player.seekTo(0);
    }
    player.play();
  }

  return (
    <View style={styles.row}>
      <Pressable style={styles.playButton} onPress={togglePlay} hitSlop={8}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={14} color="#141414" />
      </Pressable>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={colors.textPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.elevated,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    playButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      flex: 1,
      fontSize: 12,
      color: colors.textPrimary,
    },
  });
