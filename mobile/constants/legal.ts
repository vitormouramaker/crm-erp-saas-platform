// URLs das páginas legais do front web (EXPO_PUBLIC_WEB_URL). O conteúdo é
// fictício nesta versão de demonstração.
export const TERMS_URL = `${process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173'}/termos`;
export const PRIVACY_URL = `${process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:5173'}/privacidade`;

// Subir quando os termos mudarem de forma relevante: quem aceitou uma versão
// anterior precisa aceitar de novo no próximo login.
export const TERMS_VERSION = '2026-09-24';
