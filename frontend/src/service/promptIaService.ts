import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";

type PromptIaPayload = {
  empresa_id?: number;
  prompt_ia_atendimento?: string;
};

type PromptIaRawResponse = {
  payload?: string;
  boleano?: boolean;
  mensagem?: string;
  obj?: PromptIaPayload;
  success?: boolean;
  message?: string;
  data?: PromptIaPayload;
};

type PromptIaApiResponse = {
  boleano: boolean;
  mensagem: string;
  obj?: PromptIaPayload;
};

async function parsePromptIaResponse(
  raw: PromptIaRawResponse
): Promise<PromptIaApiResponse> {
  if (raw?.payload) {
    const decoded = await decrypt(raw.payload);
    if (decoded) {
      return {
        boleano: Boolean(decoded?.boleano),
        mensagem: String(decoded?.mensagem || ""),
        obj: decoded?.obj as PromptIaPayload | undefined,
      };
    }
  }

  return {
    boleano: raw?.boleano ?? raw?.success ?? false,
    mensagem: String(raw?.mensagem ?? raw?.message ?? ""),
    obj: raw?.obj ?? raw?.data,
  };
}

export async function getPromptIaAtendimento(
  empresaId: number
): Promise<string> {
  const payload = await encrypt({ empresa_id: empresaId });

  const response = await fetch(`${API_BASE}/user/get_prompt_ia_atendimento`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as PromptIaRawResponse;
  const body = await parsePromptIaResponse(raw);

  if (!response.ok || !body?.boleano) {
    throw new Error(body?.mensagem || "Nao foi possivel carregar o prompt da IA.");
  }

  return String(body?.obj?.prompt_ia_atendimento || "");
}

export async function savePromptIaAtendimento(params: {
  empresaId: number;
  prompt: string;
}): Promise<{ prompt: string; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    prompt_ia_atendimento: params.prompt,
  });

  const response = await fetch(`${API_BASE}/user/salvar_prompt_ia_atendimento`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as PromptIaRawResponse;
  const body = await parsePromptIaResponse(raw);

  if (!response.ok || !body?.boleano) {
    throw new Error(body?.mensagem || "Nao foi possivel salvar o prompt da IA.");
  }

  return {
    prompt: String(body?.obj?.prompt_ia_atendimento || ""),
    message: String(body?.mensagem || "Prompt salvo com sucesso."),
  };
}
