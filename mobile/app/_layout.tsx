import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useCommercialRealtime } from '@/hooks/useCommercialRealtime';
import { useOtaUpdates } from '@/hooks/useOtaUpdates';
import { usePushNotificationTapListener } from '@/hooks/usePushNotifications';
import { AuthProvider } from '@/providers/AuthProvider';
import { AppThemeProvider } from '@/providers/ThemeProvider';
import { useTheme } from '@/store/themeStore';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(auth)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppThemeProvider>
          <RootLayoutNav />
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { scheme } = useTheme();
  useOtaUpdates();
  usePushNotificationTapListener();

  return (
    <AuthProvider>
      <RealtimeBridge />
      <NavigationThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="configuracoes" options={{ headerShown: false }} />
          <Stack.Screen name="planos" options={{ headerShown: false }} />
          <Stack.Screen name="perfil" options={{ headerShown: false }} />
          <Stack.Screen name="relatorio-nps" options={{ headerShown: false }} />
          <Stack.Screen name="conversa/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </NavigationThemeProvider>
    </AuthProvider>
  );
}

// Precisa ficar dentro do AuthProvider pra ler o usuário logado. Mantém o
// socket da empresa vivo e dispara notificação local a cada venda recebida.
function RealtimeBridge() {
  useCommercialRealtime();
  return null;
}
