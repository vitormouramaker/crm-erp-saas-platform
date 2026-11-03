import { Stack } from 'expo-router';

export default function ConfiguracoesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="mensagens-rapidas" />
      <Stack.Screen name="tags" />
      <Stack.Screen name="bloqueados" />
      <Stack.Screen name="filiais" />
      <Stack.Screen name="categorias" />
      <Stack.Screen name="ia" />
      <Stack.Screen name="nps" />
      <Stack.Screen name="integracoes" />
      <Stack.Screen name="meta" />
      <Stack.Screen name="google-ads" />
      <Stack.Screen name="desenvolvedores" />
    </Stack>
  );
}
