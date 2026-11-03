import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { MetaAccountSelector } from '@/components/MetaAccountSelector';
import { useTheme } from '@/store/themeStore';
import {
  atualizarWhatsAppProfile,
  getContasMeta,
  getWhatsAppProfile,
  MetaAccount,
  WhatsAppProfile,
} from '@/services/metaApi';
import type { User } from '@/types';

interface WhatsAppProfileTabProps {
  user: User;
}

interface ProfilePictureAsset {
  uri: string;
  name: string;
  mimeType?: string;
}

export function WhatsAppProfileTab({ user }: WhatsAppProfileTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [numeros, setNumeros] = useState<MetaAccount[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [profile, setProfile] = useState<WhatsAppProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pictureAsset, setPictureAsset] = useState<ProfilePictureAsset | null>(null);

  const [about, setAbout] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [websitesText, setWebsitesText] = useState('');

  useEffect(() => {
    getContasMeta(user)
      .then((data) => {
        setNumeros(data);
        setMetaParamId(data.length > 0 ? data[0].id : null);
      })
      .catch(() => setNumeros([]));
  }, [user]);

  const load = useCallback(async () => {
    if (!metaParamId) return;
    setError('');
    try {
      const data = await getWhatsAppProfile(user, metaParamId);
      setProfile(data);
      setAbout(data.about || '');
      setDescription(data.description || '');
      setAddress(data.address || '');
      setEmail(data.email || '');
      setWebsitesText((data.websites || []).join('\n'));
      setPictureAsset(null);
    } catch (err: any) {
      setProfile(null);
      setError(err?.message || 'Não foi possível carregar o perfil do WhatsApp.');
    }
  }, [user, metaParamId]);

  useEffect(() => {
    if (!metaParamId) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, metaParamId]);

  async function handlePickPicture() {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];
    const mimeType = String(asset.mimeType || '').toLowerCase();
    if (mimeType && !['image/jpeg', 'image/jpg'].includes(mimeType)) {
      Alert.alert('Atenção', 'A foto de perfil precisa estar em JPG/JPEG para a Meta aceitar o upload.');
      return;
    }
    setPictureAsset({
      uri: asset.uri,
      name: asset.fileName || `perfil_${Date.now()}.jpg`,
      mimeType: asset.mimeType,
    });
  }

  async function handleSave() {
    if (!metaParamId) return;
    setSaving(true);
    try {
      const websites = websitesText
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 2);

      const { message } = await atualizarWhatsAppProfile(
        user,
        metaParamId,
        { about, description, address, email, websites },
        pictureAsset
          ? {
              uri: pictureAsset.uri,
              name: pictureAsset.name,
              type: pictureAsset.mimeType || 'image/jpeg',
            }
          : undefined
      );
      Alert.alert('Sucesso', message || 'Perfil atualizado com sucesso.');
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Erro</Text>
        <Text style={styles.subtitle}>{error}</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.subtitle}>Nenhum número WhatsApp vinculado.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <MetaAccountSelector numeros={numeros} activeId={metaParamId} onChange={setMetaParamId} />

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          {profile.profile_picture_url ? (
            <Image source={{ uri: profile.profile_picture_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="business-outline" size={22} color={colors.muted} />
            </View>
          )}
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryName}>{profile.verified_name || profile.display_name || '-'}</Text>
            <Text style={styles.summaryPhone}>{profile.display_phone_number}</Text>
          </View>
          <Pressable onPress={load} hitSlop={8} style={styles.reloadButton}>
            <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.label}>Foto de perfil</Text>
      <Pressable style={styles.attachButton} onPress={handlePickPicture}>
        <Ionicons name="image-outline" size={16} color={colors.accent} />
        <Text style={styles.attachText} numberOfLines={1}>
          {pictureAsset?.name || 'Nenhum ficheiro selecionado'}
        </Text>
      </Pressable>
      <Text style={styles.helperText}>Envie uma imagem JPG/JPEG para trocar a foto pública do número.</Text>

      <Text style={styles.label}>Nome de exibição</Text>
      <View style={styles.readonlyBox}>
        <Text style={styles.readonlyText}>{profile.verified_name || profile.display_name || '-'}</Text>
      </View>
      <Text style={styles.helperText}>Controlado pela Meta, não pode ser alterado aqui.</Text>

      <Text style={styles.label}>Número exibido</Text>
      <View style={styles.readonlyBox}>
        <Text style={styles.readonlyText}>{profile.display_phone_number}</Text>
      </View>

      <Text style={styles.label}>Categoria / vertical</Text>
      <View style={styles.readonlyBox}>
        <Text style={styles.readonlyText}>{profile.vertical || '-'}</Text>
      </View>
      <Text style={styles.helperText}>A categoria também é definida pela Meta, não pode ser alterada aqui.</Text>

      <Text style={styles.label}>Sobre</Text>
      <TextInput
        style={styles.input}
        value={about}
        onChangeText={setAbout}
        placeholder="Texto curto abaixo da foto"
        placeholderTextColor={colors.muted}
        maxLength={139}
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="contato@empresa.com"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="Descreva a empresa como no perfil da Meta"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={512}
      />

      <Text style={styles.label}>Localização / endereço</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={address}
        onChangeText={setAddress}
        placeholder="Rua, número, bairro, cidade, estado..."
        placeholderTextColor={colors.muted}
        multiline
        maxLength={256}
      />

      <Text style={styles.label}>Sites</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={websitesText}
        onChangeText={setWebsitesText}
        placeholder="https://empresa.com"
        placeholderTextColor={colors.muted}
        multiline
        autoCapitalize="none"
      />
      <Text style={styles.helperText}>Informe até 2 links, um por linha.</Text>

      <Pressable style={[styles.saveButton, saving && styles.saveDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#141414" />
        ) : (
          <Text style={styles.saveText}>Salvar alterações</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 6,
    ...cardSurface(colors, scheme),
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryPhone: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  reloadButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attachText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  helperText: {
    fontSize: 11,
    color: colors.muted,
  },
  readonlyBox: {
    height: 44,
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readonlyText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 15,
  },
  multilineInput: {
    height: 90,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  saveButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
});
