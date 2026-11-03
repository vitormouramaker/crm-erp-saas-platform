import { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import type { ThemeColors } from '@/constants/theme/tokens';
import { getLandingRoute } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

const REDIRECT_DELAY = 1500;

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const { user, loading } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  useEffect(() => {
    if (loading) return;
    const timeout = setTimeout(() => {
      const target = user ? getLandingRoute(user) : '/(auth)/login';
      console.log('[splash] navegando para', target, 'user?', !!user);
      router.replace(target);
    }, REDIRECT_DELAY);

    return () => clearTimeout(timeout);
  }, [loading, user]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brand, { opacity }]}>
        <Image
          source={
            scheme === 'dark'
              ? require('@/assets/images/logo-dark.png')
              : require('@/assets/images/logo-light.png')
          }
          style={styles.brandLogo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brand: {
      alignItems: 'center',
      gap: 12,
    },
    brandLogo: {
      width: 200,
      height: 56,
    },
  });
