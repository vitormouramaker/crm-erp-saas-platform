import { API_BASE } from "../config/api";
import { encrypt, decrypt } from "../utils/cripto";
import { readStoredSession } from "../utils/authSession";

export type MyProfile = {
  id: number;
  empresa_id: number;
  name: string;
  email: string;
  telefone?: string | null;
  foto_perfil_url?: string | null;
  foto_perfil_nome_arquivo?: string | null;
  foto_perfil_mime_type?: string | null;
  foto_perfil_tamanho_bytes?: number | null;
};

type ApiEnvelope<T> = {
  boleano?: boolean;
  obj?: T;
  mensagem?: string;
  msg?: string;
};

type SessionContext = {
  empresaId: number;
  userId: number;
};

async function getSessionContext(): Promise<SessionContext> {
  const session = await readStoredSession();
  if (!session?.user?.empresa_id || !session?.user?.id) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  return {
    empresaId: Number(session.user.empresa_id),
    userId: Number(session.user.id),
  };
}

async function decodeResponse<T>(response: Response): Promise<{
  envelope: ApiEnvelope<T>;
  sessionToken: string;
}> {
  const raw = await response.json();
  const sessionToken = String(raw?.payload || "");
  if (!sessionToken) {
    throw new Error("Resposta invalida do servidor.");
  }

  const envelope = (await decrypt(sessionToken)) as ApiEnvelope<T> | null;
  if (!envelope) {
    throw new Error("Nao foi possivel validar a resposta do servidor.");
  }

  return {
    envelope,
    sessionToken,
  };
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const { empresaId, userId } = await getSessionContext();
  const payload = await encrypt({
    empresa_id: empresaId,
    usuario_id: userId,
  });

  const response = await fetch(`${API_BASE}/user/meu_perfil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });

  const { envelope } = await decodeResponse<MyProfile>(response);
  if (!envelope?.boleano || !envelope.obj) {
    throw new Error(String(envelope?.mensagem || envelope?.msg || "Nao foi possivel carregar o perfil."));
  }

  return envelope.obj;
}

export async function saveMyProfile(input: {
  name: string;
  email: string;
  telefone?: string;
}) {
  const { empresaId, userId } = await getSessionContext();
  const payload = await encrypt({
    empresa_id: empresaId,
    usuario_id: userId,
    name: input.name,
    email: input.email,
    telefone: input.telefone || "",
  });

  const response = await fetch(`${API_BASE}/user/salvar_meu_perfil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });

  const { envelope, sessionToken } = await decodeResponse(response);
  if (!envelope?.boleano) {
    throw new Error(String(envelope?.mensagem || envelope?.msg || "Nao foi possivel salvar o perfil."));
  }

  return {
    sessionToken,
    message: String(envelope?.mensagem || "Perfil atualizado com sucesso."),
  };
}

export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const { empresaId, userId } = await getSessionContext();
  const payload = await encrypt({
    empresa_id: empresaId,
    usuario_id: userId,
    current_password: input.currentPassword,
    new_password: input.newPassword,
  });

  const response = await fetch(`${API_BASE}/user/alterar_minha_senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });

  const { envelope, sessionToken } = await decodeResponse(response);
  if (!envelope?.boleano) {
    throw new Error(String(envelope?.mensagem || envelope?.msg || "Nao foi possivel atualizar a senha."));
  }

  return {
    sessionToken,
    message: String(envelope?.mensagem || "Senha atualizada com sucesso."),
  };
}

export async function deleteMyAccount(currentPassword: string) {
  const { empresaId, userId } = await getSessionContext();
  const payload = await encrypt({
    empresa_id: empresaId,
    usuario_id: userId,
    current_password: currentPassword,
  });
  const response = await fetch(`${API_BASE}/user/excluir_minha_conta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  const { envelope } = await decodeResponse(response);
  if (!envelope?.boleano) {
    throw new Error(String(envelope?.mensagem || envelope?.msg || "Nao foi possivel excluir a conta."));
  }
  return { message: String(envelope?.mensagem || "Conta excluida com sucesso.") };
}

export async function uploadMyProfilePhoto(file: File) {
  const { empresaId, userId } = await getSessionContext();
  const payload = await encrypt({
    empresa_id: empresaId,
    usuario_id: userId,
  });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("payload", payload);

  const response = await fetch(`${API_BASE}/user/upload_minha_foto_perfil`, {
    method: "POST",
    body: formData,
  });

  const { envelope, sessionToken } = await decodeResponse(response);
  if (!envelope?.boleano) {
    throw new Error(
      String(envelope?.mensagem || envelope?.msg || "Nao foi possivel enviar a foto de perfil.")
    );
  }

  return {
    sessionToken,
    message: String(envelope?.mensagem || "Foto de perfil atualizada com sucesso."),
  };
}

export async function removeMyProfilePhoto() {
  const { empresaId, userId } = await getSessionContext();
  const payload = await encrypt({
    empresa_id: empresaId,
    usuario_id: userId,
  });

  const response = await fetch(`${API_BASE}/user/remover_minha_foto_perfil`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });

  const { envelope, sessionToken } = await decodeResponse(response);
  if (!envelope?.boleano) {
    throw new Error(
      String(envelope?.mensagem || envelope?.msg || "Nao foi possivel remover a foto de perfil.")
    );
  }

  return {
    sessionToken,
    message: String(envelope?.mensagem || "Foto de perfil removida com sucesso."),
  };
}
