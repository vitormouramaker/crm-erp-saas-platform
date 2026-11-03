const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Armazenamento de arquivos (Bunny Storage). As credenciais vem do ambiente.
// Sem BUNNY_STORAGE_ACCESS_KEY os arquivos ficam em disco local
// (LOCAL_MEDIA_DIR) e sao servidos pela propria API em /media-local, para o
// projeto rodar sem nenhuma conta externa.
const LOCAL_MEDIA_DIR = path.resolve(
  process.env.LOCAL_MEDIA_DIR || path.join(__dirname, "..", "..", ".runtime", "media")
);

function resolveLocalPath(filePath) {
  const target = path.resolve(LOCAL_MEDIA_DIR, String(filePath || "").replace(/^\/+/, ""));
  if (!target.startsWith(LOCAL_MEDIA_DIR + path.sep)) {
    throw new Error("Caminho de arquivo invalido.");
  }
  return target;
}

function localPublicBaseUrl() {
  const base = String(process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4444}`);
  return base.replace(/\/+$/, "") + "/media-local";
}

const bunny = {
  host: process.env.BUNNY_STORAGE_HOST || "storage.bunnycdn.com",
  zone: process.env.BUNNY_STORAGE_ZONE || "",
  token: process.env.BUNNY_STORAGE_ACCESS_KEY || "",
  hostGet: process.env.BUNNY_CDN_HOST || "cdn.example.com",
  localMediaDir: LOCAL_MEDIA_DIR,

  isRemoteEnabled() {
    return Boolean(this.token && this.zone);
  },

  generateFileName(originalName, userId) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    const baseName = String(originalName || "file");
    const nome = baseName.replace(/\.[^/.]+$/, "");
    const ext = (baseName.split(".").pop() || "bin").toLowerCase();
    const safeUser = String(userId || "meta").replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeNome = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "arquivo";

    const fileName = `media/${safeUser}_${safeNome}_${timestamp}.${ext}`;

    return fileName;
  },

  async uploadFile(filePath, fileBuffer) {
    if (!this.isRemoteEnabled()) {
      const target = resolveLocalPath(filePath);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, Buffer.from(fileBuffer));
      return { success: true, file: encodeURI(`${localPublicBaseUrl()}/${filePath}`) };
    }
    try {
      const url = `https://${this.host}/${this.zone}/${filePath}`;

      const response = await axios.put(url, fileBuffer, {
        headers: {
          AccessKey: this.token,
          "Content-Type": "application/octet-stream",
        },
        timeout: 30000,
      });
      if (response.status === 201) {
        return { success: true, file: encodeURI(`https://${this.hostGet}/${filePath}`) };
      }

      throw new Error(`Status inesperado: ${response.status}`);
    } catch (error) {
      console.error("❌ Erro no upload:", error.message);
      throw error;
    }
  },

  async deleteFile(filePath) {
    if (!this.isRemoteEnabled()) {
      try {
        await fs.promises.unlink(resolveLocalPath(filePath));
        return { success: true };
      } catch (error) {
        return { success: false };
      }
    }
    try {
      const url = `https://${this.host}/${this.zone}/${filePath}`;
      await axios.delete(url, {
        headers: { AccessKey: this.token },
        timeout: 15000,
      });

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },

  async downloadFile(filePath) {
    if (!this.isRemoteEnabled()) {
      try {
        return { success: true, data: await fs.promises.readFile(resolveLocalPath(filePath)) };
      } catch (error) {
        throw new Error("Arquivo não encontrado");
      }
    }
    try {
      const url = `https://${this.host}/${this.zone}/${filePath}`;

      const response = await axios.get(url, {
        headers: { AccessKey: this.token },
        responseType: "arraybuffer",
        timeout: 30000,
      });

      if (response.status === 200) {
        return { success: true, data: response.data };
      }
      throw new Error(`Status inesperado: ${response.status}`);
    } catch (error) {
      console.error("❌ Erro no download:", error.message);
      throw new Error("Arquivo não encontrado");
    }
  },
};

module.exports = bunny;
