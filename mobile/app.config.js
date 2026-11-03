// Completa o app.json com o que depende de cada instalacao (nada disso fica
// no repositorio):
// - google-services.json: crie um projeto Firebase proprio e salve o arquivo
//   na raiz do mobile (modelo em google-services.example.json). Sem ele o app
//   roda normalmente, so sem push no Android.
// - EAS_PROJECT_ID / EAS_OWNER: so para builds e updates pelo EAS.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const hasGoogleServices = fs.existsSync(path.join(__dirname, "google-services.json"));
  const projectId = process.env.EAS_PROJECT_ID;
  return {
    ...config,
    ...(process.env.EAS_OWNER ? { owner: process.env.EAS_OWNER } : {}),
    ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}` } } : {}),
    android: {
      ...config.android,
      ...(hasGoogleServices ? { googleServicesFile: "./google-services.json" } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
