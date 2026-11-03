const axios = require("axios");
const security = require("../security/cypher");

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildNpsLink(req, atendimentoId) {
  const token = security.generateNpsPublicToken(atendimentoId);
  const tokenEncoded = encodeURIComponent(token);
  const configuredBaseUrl = normalizeBaseUrl(
    process.env.APP_WEB_BASE_URL || 'http://localhost:5173'
  );

  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/nps/${tokenEncoded}`;
  }

  const host = req.get("host");
  if (!host) {
    return `/nps/${tokenEncoded}`;
  }

  return `${req.protocol}://${host}/nps/${tokenEncoded}`;
}

function getExtension(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "video/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/3gpp": "3gp",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.rar": "rar",
    "application/x-rar-compressed": "rar",
    "application/x-rar": "rar",
    "application/x-7z-compressed": "7z",
    "application/x-7zip-compressed": "7z",
    "application/acad": "dwg",
    "application/x-acad": "dwg",
    "application/autocad_dwg": "dwg",
    "application/dwg": "dwg",
    "application/x-dwg": "dwg",
    "image/vnd.dwg": "dwg",
  };
  return map[mime] || "bin";
}

function normalizeAiArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function normalizeProductRecommendations(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      nome: String(item?.nome || item?.produto || "").trim(),
      motivo: String(item?.motivo || "").trim(),
      preco_referencia:
        item?.preco_referencia === null || item?.preco_referencia === undefined
          ? null
          : Number(item.preco_referencia) || 0,
      quantidade_sugerida: Number(item?.quantidade_sugerida || 1) || 1,
      abordagem: String(item?.abordagem || "").trim(),
    }))
    .filter((item) => item.nome);
}

function normalizeQuoteItems(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      nome: String(item?.nome || item?.produto || "").trim(),
      quantidade: Number(item?.quantidade || 1) || 1,
      preco_unitario:
        item?.preco_unitario === null || item?.preco_unitario === undefined
          ? null
          : Number(item.preco_unitario) || 0,
      subtotal:
        item?.subtotal === null || item?.subtotal === undefined
          ? null
          : Number(item.subtotal) || 0,
    }))
    .filter((item) => item.nome);
}

function normalizeQuoteDraft(value) {
  if (!value || typeof value !== "object") {
    return {
      resumo: "",
      itens: [],
      total_estimado: null,
      mensagem_pronta: "",
      observacoes: [],
    };
  }

  return {
    resumo: String(value.resumo || "").trim(),
    itens: normalizeQuoteItems(value.itens),
    total_estimado:
      value.total_estimado === null || value.total_estimado === undefined
        ? null
        : Number(value.total_estimado) || 0,
    mensagem_pronta: String(value.mensagem_pronta || "").trim(),
    observacoes: normalizeAiArray(value.observacoes),
  };
}

function normalizeProductCatalog(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      id: Number(item?.id || 0) || null,
      nome: String(item?.nome || "").trim(),
      descricao: String(item?.descricao || "").trim(),
      preco_base:
        item?.preco_base === null || item?.preco_base === undefined
          ? null
          : Number(item.preco_base) || 0,
      total_imagens: Array.isArray(item?.imagens)
        ? item.imagens.length
        : item?.total_imagens === null || item?.total_imagens === undefined
          ? 0
          : Number(item.total_imagens) || 0,
      tem_documento:
        item?.tem_documento === undefined
          ? Boolean(item?.documento?.id || item?.documento?.url)
          : Boolean(item.tem_documento),
    }))
    .filter((item) => item.nome);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PRODUCT_SEARCH_STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "pra",
  "pro",
  "que",
  "se",
  "sem",
  "tem",
  "um",
  "uma",
  "uns",
  "umas",
  "vou",
]);

function tokenizeSearchTerms(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];

  return [...new Set(
    normalized
      .split(" ")
      .map((item) => item.trim())
      .filter((item) => item.length >= 3 && !PRODUCT_SEARCH_STOPWORDS.has(item))
  )];
}

function normalizeCurrentDealProducts(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      nome: String(item?.nome || item?.produto || "").trim(),
      quantidade: Number(item?.quantidade || 1) || 1,
      preco_unitario:
        item?.preco_unitario === null || item?.preco_unitario === undefined
          ? null
          : Number(item.preco_unitario) || 0,
    }))
    .filter((item) => item.nome);
}

function scoreProductForConversation(product, searchTerms = [], highlightedNames = []) {
  const normalizedName = normalizeSearchText(product?.nome);
  const normalizedDescription = normalizeSearchText(product?.descricao);
  let score = 0;

  for (const highlightedName of highlightedNames) {
    const normalizedHighlightedName = normalizeSearchText(highlightedName);
    if (!normalizedHighlightedName) continue;

    if (normalizedName === normalizedHighlightedName) {
      score += 220;
      continue;
    }

    if (normalizedName.includes(normalizedHighlightedName)) {
      score += 140;
      continue;
    }

    const highlightedTokens = tokenizeSearchTerms(normalizedHighlightedName);
    const tokenMatches = highlightedTokens.filter((term) => normalizedName.includes(term)).length;
    if (tokenMatches > 0) {
      score += tokenMatches * 24;
    }
  }

  for (const term of searchTerms) {
    if (!term) continue;

    if (normalizedName === term) {
      score += 120;
      continue;
    }

    if (normalizedName.startsWith(term)) {
      score += 70;
      continue;
    }

    if (normalizedName.includes(term)) {
      score += 24;
    }

    if (normalizedDescription && normalizedDescription.includes(term)) {
      score += 10;
    }
  }

  if (product?.total_imagens > 0) score += 2;
  if (product?.tem_documento) score += 2;

  return score;
}

function selectRelevantProductsForConversation(produtos = [], options = {}) {
  const normalized = normalizeProductCatalog(produtos);
  if (!normalized.length) return [];

  const highlightedNames = [
    options.produto_atual,
    ...(Array.isArray(options.produtos_negocio_atual)
      ? options.produtos_negocio_atual.map((item) => item?.nome || item?.produto || "")
      : []),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const searchTerms = [
    ...tokenizeSearchTerms(options.transcricao || ""),
    ...tokenizeSearchTerms(options.cliente_nome || ""),
    ...highlightedNames.flatMap((item) => tokenizeSearchTerms(item)),
  ].slice(0, 48);

  const scored = normalized
    .map((product) => ({
      ...product,
      relevancia: scoreProductForConversation(product, searchTerms, highlightedNames),
    }))
    .sort((left, right) => {
      if (left.relevancia !== right.relevancia) {
        return right.relevancia - left.relevancia;
      }

      if (left.total_imagens !== right.total_imagens) {
        return right.total_imagens - left.total_imagens;
      }

      return String(left.nome || "").localeCompare(String(right.nome || ""), "pt-BR");
    });

  const relevantOnly = scored.filter((item) => item.relevancia > 0);
  if (relevantOnly.length) {
    return relevantOnly.slice(0, 30);
  }

  return scored.slice(0, 20);
}

function buildCurrentDealProductsPrompt(produtos = []) {
  const normalized = normalizeCurrentDealProducts(produtos);
  if (!normalized.length) {
    return "PRODUTOS_JA_NEGOCIADOS_NO_CRM: nenhum.";
  }

  return [
    "PRODUTOS_JA_NEGOCIADOS_NO_CRM:",
    ...normalized.map((item, index) =>
      `${index + 1}. ${item.nome} | quantidade=${item.quantidade} | preco_unitario=${item.preco_unitario ?? "n/d"}`
    ),
  ].join("\n");
}

function buildProductCatalogPrompt(produtos = [], options = {}) {
  const normalized = normalizeProductCatalog(produtos);
  const selected = selectRelevantProductsForConversation(normalized, options);
  if (!selected.length) {
    return "CATALOGO_COMERCIAL: indisponivel.";
  }

  return [
    `CATALOGO_COMERCIAL_TOTAL: ${normalized.length} produto(s) ativo(s) no banco da empresa.`,
    "CATALOGO_COMERCIAL_RELEVANTE_PARA_ESTA_CONVERSA:",
    ...selected.map((item, index) =>
      `${index + 1}. [ID ${item.id ?? "n/d"}] ${item.nome} | preco_base=${item.preco_base ?? "n/d"} | descricao=${item.descricao || "sem descricao"} | imagens=${item.total_imagens} | documento=${item.tem_documento ? "sim" : "nao"} | relevancia=${item.relevancia}`
    ),
  ].join("\n");
}

function normalizeContextoComercial(contexto = {}) {
  return {
    produto_servico: String(contexto.produto_servico || "").trim(),
    ticket_medio: String(contexto.ticket_medio || "").trim(),
    tipo_cliente: String(contexto.tipo_cliente || "").trim(),
    perfil_cliente_ideal: String(contexto.perfil_cliente_ideal || "").trim(),
    origem_lead: String(contexto.origem_lead || "").trim(),
    etapa_funil_entrada: String(contexto.etapa_funil_entrada || "").trim(),
    objetivo_conversa: String(contexto.objetivo_conversa || "").trim(),
  };
}

function normalizeEtapasNotas(value) {
  const base = {
    abordagem: 0,
    diagnostico: 0,
    proposta: 0,
    negociacao: 0,
    follow_up: 0,
    fechamento: 0,
    pos_venda: 0,
  };

  if (!value || typeof value !== "object") return base;

  return {
    abordagem: Number(value.abordagem || 0),
    diagnostico: Number(value.diagnostico || 0),
    proposta: Number(value.proposta || 0),
    negociacao: Number(value.negociacao || 0),
    follow_up: Number(value.follow_up || 0),
    fechamento: Number(value.fechamento || 0),
    pos_venda: Number(value.pos_venda || 0),
  };
}

function buildConversaTranscript(rows = []) {
  const messages = rows
    .filter((row) => row && row.mensagem_id && row.mensagem)
    .map((row) => {
      const sender =
        Number(row.send_by) === 1
          ? "CLIENTE"
          : Number(row.send_by) === 2
            ? "ATENDENTE"
            : Number(row.send_by) === 3
              ? "N8N IA"
              : Number(row.send_by) === 4
                ? "WHATSAPP CELULAR"
                : "SISTEMA";
      const timestamp = row.data_mensagem
        ? new Date(row.data_mensagem).toISOString()
        : "";
      return `[${timestamp}] ${sender}: ${String(row.mensagem).trim()}`;
    });

  return messages.join("\n");
}

// Conteudo ficticio de demonstracao: prompts padrao curtos e genericos. Cada
// empresa pode gravar o proprio prompt no painel (Configuracoes > IA).
const DEFAULT_PROMPT_ANALISE_ATENDIMENTO = `
Conteudo ficticio de demonstracao.
Voce revisa conversas de atendimento comercial e devolve uma avaliacao objetiva para o gestor.
Avalie cada etapa do funil (abordagem, diagnostico, proposta, negociacao, follow_up, fechamento, pos_venda) de 0 a 10.
Aponte o principal gargalo, o risco de perda e a proxima etapa recomendada.
Sugira treinamento apenas quando a nota final for menor que 8.
`.trim();

const DEFAULT_PROMPT_ASSISTENTE_CONVERSAO = `
Conteudo ficticio de demonstracao.
Voce ajuda o atendente a conduzir a conversa atual com clareza e a propor o proximo passo.
`.trim();

const ANALISE_RESPONSE_FORMAT_PROMPT = `
Regra para esta integracao:
- NAO bloqueie a analise por ausencia de contexto comercial.
- Ignore a exigencia de bloco de contexto minimo quando ele nao for enviado.
- Sempre produza auditoria tecnica com base na conversa disponivel.
- Campo precisa_contexto_minimo deve ser false nesta integracao.
- Campo solicitacao_contexto deve vir vazio quando nao houver necessidade operacional.

FORMATO OBRIGATORIO DE RESPOSTA:
Retorne APENAS JSON valido, sem markdown, com os campos:
{
  "precisa_contexto_minimo": boolean,
  "solicitacao_contexto": string,
  "notas_por_etapa": {
    "abordagem": number,
    "diagnostico": number,
    "proposta": number,
    "negociacao": number,
    "follow_up": number,
    "fechamento": number,
    "pos_venda": number
  },
  "nota_final": number,
  "kpis_comerciais": [string],
  "diagnostico_gargalos": [string],
  "risco_perda": string,
  "probabilidade_avanco": string,
  "proxima_etapa_recomendada": string,
  "ajustes_finos": [string],
  "boas_praticas_reforcar": [string],
  "script_sugestao_imediato": [string],
  "script_completo_nota_10": [string]
}
`.trim();

const ASSISTENTE_RESPONSE_FORMAT_PROMPT = `
Modo da resposta: suporte de conversao para atendimento ativo.
Retorne APENAS JSON valido, sem markdown.

Regras extras:
- Quando houver catalogo comercial, recomende somente produtos plausiveis para contexto da conversa.
- Nao invente nome de produto fora do catalogo se o catalogo foi enviado.
- Use o nome do produto exatamente como ele aparece no catalogo consultado.
- Priorize os produtos do bloco CATALOGO_COMERCIAL_RELEVANTE_PARA_ESTA_CONVERSA.
- Se nenhum produto do catalogo fizer sentido para a conversa, retorne "produtos_recomendados": [].
- Se faltar informacao para fechar valor exato, monte rascunho de orcamento com sinalizacao clara.

JSON obrigatorio:
{
  "resumo_situacao": "string",
  "estagio_funil_atual": "string",
  "dor_principal_cliente": "string",
  "objetivo_imediato_atendente": "string",
  "proxima_melhor_acao": "string",
  "mensagens_sugeridas": ["string"],
  "perguntas_estrategicas": ["string"],
  "objecoes_provaveis": ["string"],
  "respostas_recomendadas_objecoes": ["string"],
  "cta_recomendado": "string",
  "riscos_de_perda": ["string"],
  "produtos_recomendados": [
    {
      "nome": "string",
      "motivo": "string",
      "preco_referencia": number,
      "quantidade_sugerida": number,
      "abordagem": "string"
    }
  ],
  "rascunho_orcamento": {
    "resumo": "string",
    "itens": [
      {
        "nome": "string",
        "quantidade": number,
        "preco_unitario": number,
        "subtotal": number
      }
    ],
    "total_estimado": number,
    "mensagem_pronta": "string",
    "observacoes": ["string"]
  }
}
`.trim();

const CORRECAO_TEXTO_CHAT_RESPONSE_FORMAT_PROMPT = `
Modo da resposta: correcao sob demanda de texto digitado pelo atendente.
Retorne APENAS JSON valido, sem markdown.

JSON obrigatorio:
{
  "corrected_text": "string",
  "changed": boolean
}
`.trim();

function buildPromptConfigEmpresa(promptEmpresa, modo) {
  const prompt = String(promptEmpresa || "").trim();
  if (prompt) return prompt;
  return modo === "assistente"
    ? DEFAULT_PROMPT_ASSISTENTE_CONVERSAO
    : DEFAULT_PROMPT_ANALISE_ATENDIMENTO;
}

function getDefaultPromptAnaliseAtendimento() {
  return DEFAULT_PROMPT_ANALISE_ATENDIMENTO;
}

async function gerarAnaliseAtendimentoComOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada no ambiente.");
  }

  const model = process.env.OPENAI_ATENDIMENTO_MODEL || "gpt-4.1-mini";

  const systemPrompt = [
    buildPromptConfigEmpresa(payload.prompt_empresa, "analise"),
    ANALISE_RESPONSE_FORMAT_PROMPT,
  ].join("\n\n");

  const contextoComercial = normalizeContextoComercial(payload.contexto_comercial || {});

  const userPrompt = [
    "BLOCO DE CONTEXTO COMERCIAL:",
    JSON.stringify(contextoComercial, null, 2),
    `Cliente: ${payload.cliente_nome || "Nao informado"} (${payload.cliente_telefone || "Sem telefone"})`,
    `Atendente: ${payload.atendente_nome || "Nao identificado"}`,
    "Transcricao:",
    payload.transcricao || "Sem mensagens para analisar.",
  ].join("\n");

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const content = response?.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("A OpenAI nao retornou conteudo para a analise.");
  }

  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Nao foi possivel interpretar a resposta da OpenAI.");
  }

  return {
    precisa_contexto_minimo: false,
    solicitacao_contexto: "",
    notas_por_etapa: normalizeEtapasNotas(parsed.notas_por_etapa),
    nota_final: Number(parsed.nota_final || 0),
    kpis_comerciais: normalizeAiArray(parsed.kpis_comerciais),
    diagnostico_gargalos: normalizeAiArray(parsed.diagnostico_gargalos),
    risco_perda: String(parsed.risco_perda || "").trim() || "Nao informado.",
    probabilidade_avanco:
      String(parsed.probabilidade_avanco || "").trim() || "Nao informado.",
    proxima_etapa_recomendada:
      String(parsed.proxima_etapa_recomendada || "").trim() ||
      "Sem proxima etapa recomendada.",
    ajustes_finos: normalizeAiArray(parsed.ajustes_finos),
    boas_praticas_reforcar: normalizeAiArray(parsed.boas_praticas_reforcar),
    script_sugestao_imediato: normalizeAiArray(parsed.script_sugestao_imediato),
    script_completo_nota_10: normalizeAiArray(parsed.script_completo_nota_10),
  };
}

async function gerarAssistenciaConversaoComOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada no ambiente.");
  }

  const model = process.env.OPENAI_ATENDIMENTO_MODEL || "gpt-4.1-mini";

  const systemPrompt = [
    buildPromptConfigEmpresa(payload.prompt_empresa, "assistente"),
    ASSISTENTE_RESPONSE_FORMAT_PROMPT,
  ].join("\n\n");

  const userPrompt = [
    `Cliente: ${payload.cliente_nome || "Nao informado"} (${payload.cliente_telefone || "Sem telefone"})`,
    `Atendente: ${payload.atendente_nome || "Nao identificado"}`,
    `CRM atual: ${payload.crm_nome || "Nao informado"} | Etapa atual: ${payload.etapa_nome || "Nao informada"}`,
    `Produto atual no CRM: ${payload.produto_atual || "Nao definido"}`,
    buildCurrentDealProductsPrompt(payload.produtos_negocio_atual || []),
    "Conversa ativa em andamento. Gere orientacao para conversao imediata.",
    buildProductCatalogPrompt(payload.produtos_catalogo || [], {
      transcricao: payload.transcricao || "",
      cliente_nome: payload.cliente_nome || "",
      produto_atual: payload.produto_atual || "",
      produtos_negocio_atual: payload.produtos_negocio_atual || [],
    }),
    "Transcricao:",
    payload.transcricao || "Sem mensagens para analisar.",
  ].join("\n");

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const content = response?.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("A OpenAI nao retornou conteudo para a assistencia.");
  }

  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Nao foi possivel interpretar a resposta da OpenAI.");
  }

  return {
    resumo_situacao:
      String(parsed.resumo_situacao || "").trim() || "Sem resumo da situacao.",
    estagio_funil_atual:
      String(parsed.estagio_funil_atual || "").trim() || "Nao identificado.",
    dor_principal_cliente:
      String(parsed.dor_principal_cliente || "").trim() || "Nao identificada.",
    objetivo_imediato_atendente:
      String(parsed.objetivo_imediato_atendente || "").trim() ||
      "Conduzir para proxima etapa com CTA claro.",
    proxima_melhor_acao:
      String(parsed.proxima_melhor_acao || "").trim() || "Sem acao sugerida.",
    mensagens_sugeridas: normalizeAiArray(parsed.mensagens_sugeridas),
    perguntas_estrategicas: normalizeAiArray(parsed.perguntas_estrategicas),
    objecoes_provaveis: normalizeAiArray(parsed.objecoes_provaveis),
    respostas_recomendadas_objecoes: normalizeAiArray(
      parsed.respostas_recomendadas_objecoes
    ),
    cta_recomendado:
      String(parsed.cta_recomendado || "").trim() || "Sem CTA recomendado.",
    riscos_de_perda: normalizeAiArray(parsed.riscos_de_perda),
    produtos_recomendados: normalizeProductRecommendations(
      parsed.produtos_recomendados
    ),
    rascunho_orcamento: normalizeQuoteDraft(parsed.rascunho_orcamento),
  };
}

async function corrigirTextoChatComOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada no ambiente.");
  }

  const inputText = String(payload?.texto || payload?.text || "").trim();
  if (!inputText) {
    throw new Error("Informe um texto para corrigir.");
  }

  const model = process.env.OPENAI_ATENDIMENTO_MODEL || "gpt-4.1-mini";
  const systemPrompt = [
    "Voce corrige mensagens de WhatsApp em portugues do Brasil.",
    "Corrija apenas ortografia, acentuacao, pontuacao, caixa e concordancia quando necessario.",
    "Preserve a intencao original, o tom comercial, nomes proprios, links, numeros, emojis, comandos iniciados por / e variaveis como {{nome}}.",
    "Nao invente informacoes, nao resuma e nao acrescente texto novo.",
    "Se o texto ja estiver adequado, devolva o mesmo texto.",
    CORRECAO_TEXTO_CHAT_RESPONSE_FORMAT_PROMPT,
  ].join("\n\n");

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Texto para corrigir:\n${inputText}`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const content = response?.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("A OpenAI nao retornou conteudo para a correcao.");
  }

  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Nao foi possivel interpretar a resposta da OpenAI.");
  }

  const correctedText =
    String(parsed.corrected_text || parsed.texto_corrigido || inputText).trim() ||
    inputText;

  return {
    corrected_text: correctedText,
    changed: correctedText !== inputText,
  };
}

module.exports = {
  buildNpsLink,
  getExtension,
  getDefaultPromptAnaliseAtendimento,
  buildConversaTranscript,
  gerarAnaliseAtendimentoComOpenAI,
  gerarAssistenciaConversaoComOpenAI,
  corrigirTextoChatComOpenAI,
  selectRelevantProductsForConversation,
};
