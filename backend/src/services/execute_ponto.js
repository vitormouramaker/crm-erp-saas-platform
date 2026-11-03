const models = require("../models/models_ponto");
const { postgres } = require("../server/connect");
const net = require("node:net");

function parseDateInput(value, endOfDay = false) {
  if (!value) {
    const now = new Date();
    if (endOfDay) {
      now.setHours(23, 59, 59, 999);
    } else {
      now.setHours(0, 0, 0, 0);
    }
    return now;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data informada inválida.");
  }

  return date;
}

function toDateOnly(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function enumerateDates(startValue, endValue) {
  const dates = [];
  const current = new Date(startValue);
  const end = new Date(endValue);

  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current.getTime() <= end.getTime()) {
    dates.push(toDateOnly(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function isDateOnlyString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildLocalDateFromDateOnly(value, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Data informada inválida.");
  }

  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseDateInput(value, endOfDay = false) {
  if (!value) {
    const now = new Date();
    if (endOfDay) {
      now.setHours(23, 59, 59, 999);
    } else {
      now.setHours(0, 0, 0, 0);
    }
    return now;
  }

  if (isDateOnlyString(value)) {
    return buildLocalDateFromDateOnly(value, endOfDay);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data informada inválida.");
  }

  return date;
}

function toDateOnly(value) {
  if (isDateOnlyString(value)) {
    return value;
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function enumerateDates(startValue, endValue) {
  const dates = [];
  const current = parseDateInput(startValue);
  const end = parseDateInput(endValue);

  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current.getTime() <= end.getTime()) {
    dates.push(toDateOnly(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function toMinutes(timeValue) {
  if (!timeValue) return null;
  const raw = String(timeValue).slice(0, 8);
  const [hour, minute] = raw.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function normalizeDiaSemana(value) {
  const dia = Number(value);

  if (!Number.isInteger(dia) || dia < 0 || dia > 7) {
    throw new Error("dia_semana inválido. Use valores entre 1 e 7.");
  }

  return dia === 0 ? 7 : dia;
}

function normalizeTimeValue(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const raw = String(value).trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    throw new Error(`Campo ${fieldName} inválido. Use o formato HH:mm ou HH:mm:ss.`);
  }

  return raw.length === 5 ? `${raw}:00` : raw;
}

function parseBooleanValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return Boolean(value);
}

function parseOptionalNumber(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Campo ${fieldName} invalido.`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`Campo ${fieldName} invalido.`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`Campo ${fieldName} invalido.`);
  }

  return parsed;
}

function parseOptionalInteger(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Campo ${fieldName} invalido.`);
  }

  return parsed;
}

function normalizeOptionalString(value, maxLength = 255) {
  if (value === undefined || value === null) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  return normalized.slice(0, maxLength);
}

function normalizeRequestIp(value) {
  const normalized = normalizeOptionalString(value, 120);
  if (!normalized) return null;

  let ip = normalized.split(",")[0].trim();
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  if (ip === "::1") {
    return "127.0.0.1";
  }

  return net.isIP(ip) ? ip : null;
}

function expandIpv6(ip) {
  const [headPart, tailPart] = ip.split("::");
  const head = headPart ? headPart.split(":").filter(Boolean) : [];
  const tail = tailPart ? tailPart.split(":").filter(Boolean) : [];

  const expandedTail = [...tail];
  const lastTail = expandedTail[expandedTail.length - 1];

  if (lastTail && lastTail.includes(".")) {
    const octets = lastTail.split(".").map(Number);
    if (octets.length !== 4 || octets.some((item) => item < 0 || item > 255)) {
      return null;
    }

    expandedTail.pop();
    expandedTail.push(((octets[0] << 8) | octets[1]).toString(16));
    expandedTail.push(((octets[2] << 8) | octets[3]).toString(16));
  }

  const missingGroups = 8 - (head.length + expandedTail.length);
  if (missingGroups < 0) {
    return null;
  }

  const groups = [
    ...head,
    ...Array(missingGroups).fill("0"),
    ...expandedTail
  ].map((item) => item.padStart(4, "0").toLowerCase());

  return groups.length === 8 ? groups : null;
}

function buildIpRange(ip) {
  const version = net.isIP(ip);

  if (version === 4) {
    const octets = ip.split(".");
    octets[3] = "0";
    return `${octets.join(".")}/24`;
  }

  if (version === 6) {
    const groups = expandIpv6(ip);
    if (!groups) return null;
    return `${groups.slice(0, 4).join(":")}::/64`;
  }

  return null;
}

function normalizePontoMetadata(payload, usuarioId) {
  const latitude = parseOptionalNumber(payload?.latitude, "latitude", {
    min: -90,
    max: 90
  });
  const longitude = parseOptionalNumber(payload?.longitude, "longitude", {
    min: -180,
    max: 180
  });

  if ((latitude === null) !== (longitude === null)) {
    throw new Error("Informe latitude e longitude juntas.");
  }

  const precisaoMetros = parseOptionalNumber(
    payload?.precisao_metros,
    "precisao_metros",
    { min: 0 }
  );

  const localizacaoCapturadaEmRaw = normalizeOptionalString(
    payload?.localizacao_capturada_em,
    80
  );
  let localizacaoCapturadaEm = null;

  if (localizacaoCapturadaEmRaw) {
    const parsedDate = new Date(localizacaoCapturadaEmRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error("Campo localizacao_capturada_em invalido.");
    }
    localizacaoCapturadaEm = parsedDate;
  }

  const geolocalizacaoStatus = normalizeOptionalString(
    payload?.geolocalizacao_status,
    40
  );
  const geolocalizacaoAutorizada =
    payload?.geolocalizacao_autorizada === undefined ||
    payload?.geolocalizacao_autorizada === null ||
    payload?.geolocalizacao_autorizada === ""
      ? null
      : parseBooleanValue(payload?.geolocalizacao_autorizada);

  const ipPublico = normalizeRequestIp(payload?.ip_publico);

  return {
    latitude,
    longitude,
    precisao_metros: precisaoMetros,
    localizacao_capturada_em: localizacaoCapturadaEm,
    geolocalizacao_status:
      geolocalizacaoStatus || (latitude !== null && longitude !== null ? "capturada" : null),
    geolocalizacao_autorizada:
      geolocalizacaoAutorizada !== null
        ? geolocalizacaoAutorizada
        : latitude !== null && longitude !== null
          ? true
          : null,
    timezone_cliente: normalizeOptionalString(payload?.timezone_cliente, 80),
    idioma_cliente: normalizeOptionalString(payload?.idioma_cliente, 40),
    plataforma_cliente: normalizeOptionalString(payload?.plataforma_cliente, 80),
    user_agent: normalizeOptionalString(payload?.user_agent, 1000),
    dispositivo_mobile:
      payload?.dispositivo_mobile === undefined ||
      payload?.dispositivo_mobile === null ||
      payload?.dispositivo_mobile === ""
        ? null
        : parseBooleanValue(payload?.dispositivo_mobile),
    origem_registro:
      normalizeOptionalString(payload?.origem_registro, 40) || "web_colaborador",
    registrado_por_usuario_id:
      parseOptionalInteger(payload?.registrado_por_usuario_id, "registrado_por_usuario_id") ||
      usuarioId,
    ip_publico: ipPublico,
    faixa_ip: buildIpRange(ipPublico)
  };
}

function validateRequiredGeolocation(metadata) {
  const hasCoordinates =
    metadata.latitude !== null &&
    metadata.longitude !== null &&
    Number.isFinite(metadata.latitude) &&
    Number.isFinite(metadata.longitude);

  if (metadata.origem_registro === "web_colaborador" && !hasCoordinates) {
    throw new Error("Ative a localizacao do dispositivo para registrar o ponto.");
  }

  if (
    metadata.origem_registro === "web_colaborador" &&
    metadata.geolocalizacao_status !== "capturada"
  ) {
    throw new Error("Nao foi possivel confirmar a localizacao ativa para registrar o ponto.");
  }
}

function normalizeHorarioDias(dias) {
  if (!Array.isArray(dias) || dias.length === 0) {
    throw new Error("Informe ao menos um dia em dias.");
  }

  const diasUtilizados = new Set();

  return dias.map((item) => {
    const diaSemana = normalizeDiaSemana(item?.dia_semana);

    if (diasUtilizados.has(diaSemana)) {
      throw new Error("Não é permitido repetir dia_semana no mesmo horário.");
    }
    diasUtilizados.add(diaSemana);

    const entrada1 = normalizeTimeValue(item?.entrada_1, "entrada_1");
    const saida1 = normalizeTimeValue(item?.saida_1, "saida_1");
    const entrada2 = normalizeTimeValue(item?.entrada_2, "entrada_2");
    const saida2 = normalizeTimeValue(item?.saida_2, "saida_2");

    if ((entrada1 && !saida1) || (!entrada1 && saida1)) {
      throw new Error("Os campos entrada_1 e saida_1 devem ser informados juntos.");
    }

    if ((entrada2 && !saida2) || (!entrada2 && saida2)) {
      throw new Error("Os campos entrada_2 e saida_2 devem ser informados juntos.");
    }

    const pares = [
      [entrada1, saida1, "faixa 1"],
      [entrada2, saida2, "faixa 2"]
    ];

    pares.forEach(([entrada, saida, label]) => {
      if (entrada && saida) {
        const inicio = toMinutes(entrada);
        const fim = toMinutes(saida);
        if (inicio === null || fim === null || fim <= inicio) {
          throw new Error(`Horários inválidos na ${label}. A saída deve ser maior que a entrada.`);
        }
      }
    });

    const cargaPrevistaInformada = item?.carga_prevista_minutos;
    let cargaPrevistaMinutos =
      cargaPrevistaInformada === undefined || cargaPrevistaInformada === null || cargaPrevistaInformada === ""
        ? null
        : Number(cargaPrevistaInformada);

    if (
      cargaPrevistaMinutos !== null &&
      (!Number.isInteger(cargaPrevistaMinutos) || cargaPrevistaMinutos < 0)
    ) {
      throw new Error("carga_prevista_minutos deve ser um inteiro maior ou igual a zero.");
    }

    if (cargaPrevistaMinutos === null) {
      cargaPrevistaMinutos = 0;
      if (entrada1 && saida1) {
        cargaPrevistaMinutos += toMinutes(saida1) - toMinutes(entrada1);
      }
      if (entrada2 && saida2) {
        cargaPrevistaMinutos += toMinutes(saida2) - toMinutes(entrada2);
      }
    }

    return {
      dia_semana: diaSemana,
      entrada_1: entrada1,
      saida_1: saida1,
      entrada_2: entrada2,
      saida_2: saida2,
      carga_prevista_minutos: cargaPrevistaMinutos
    };
  });
}

function normalizeHorarioPayload(payload) {
  const nome = String(payload?.nome || "").trim();
  if (!nome) {
    throw new Error("Informe o campo nome.");
  }

  const cargaDiaria = Number(payload?.carga_horaria_diaria_minutos);
  if (!Number.isInteger(cargaDiaria) || cargaDiaria < 0) {
    throw new Error("carga_horaria_diaria_minutos deve ser um inteiro maior ou igual a zero.");
  }

  const cargaSemanalRaw = payload?.carga_horaria_semanal_minutos;
  const cargaSemanal =
    cargaSemanalRaw === undefined || cargaSemanalRaw === null || cargaSemanalRaw === ""
      ? null
      : Number(cargaSemanalRaw);

  if (
    cargaSemanal !== null &&
    (!Number.isInteger(cargaSemanal) || cargaSemanal < 0)
  ) {
    throw new Error("carga_horaria_semanal_minutos deve ser um inteiro maior ou igual a zero.");
  }

  const toleranciaEntrada = Number(payload?.tolerancia_entrada_minutos ?? 0);
  const toleranciaSaida = Number(payload?.tolerancia_saida_minutos ?? 0);
  const toleranciaExtra = Number(payload?.tolerancia_extra_minutos ?? 0);

  [toleranciaEntrada, toleranciaSaida, toleranciaExtra].forEach((valor) => {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new Error("As tolerâncias devem ser inteiros maiores ou iguais a zero.");
    }
  });

  return {
    nome,
    descricao: String(payload?.descricao || "").trim() || null,
    carga_horaria_diaria_minutos: cargaDiaria,
    carga_horaria_semanal_minutos: cargaSemanal,
    tolerancia_entrada_minutos: toleranciaEntrada,
    tolerancia_saida_minutos: toleranciaSaida,
    tolerancia_extra_minutos: toleranciaExtra,
    flexivel: parseBooleanValue(payload?.flexivel),
    dias: normalizeHorarioDias(payload?.dias)
  };
}

function diffMinutes(start, end) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function inferBatidaTipo(registros) {
  const tipos = ["entrada_1", "saida_1", "entrada_2", "saida_2"];
  return tipos[registros.length] || `batida_${registros.length + 1}`;
}

function calculateWorkedMinutes(registros) {
  let total = 0;

  for (let i = 0; i + 1 < registros.length; i += 2) {
    const start = new Date(registros[i].data_hora);
    const end = new Date(registros[i + 1].data_hora);
    total += diffMinutes(start, end);
  }

  return total;
}

function buildHorarioMatch(date, horarios) {
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const candidates = [jsDay, isoDay];

  return (
    horarios.find((item) => candidates.includes(item.dia_semana)) || null
  );
}

function mountFaixas(row) {
  if (!row) return [];

  return [
    {
      entrada: row.entrada_1,
      saida: row.saida_1
    },
    {
      entrada: row.entrada_2,
      saida: row.saida_2
    }
  ].filter((item) => item.entrada || item.saida);
}

function getExpectedRegistros(row) {
  if (!row) return 0;

  const faixas = [
    [row.entrada_1, row.saida_1],
    [row.entrada_2, row.saida_2]
  ];

  return faixas.reduce((total, [entrada, saida]) => {
    return entrada && saida ? total + 2 : total;
  }, 0);
}

function buildResumo(apuracoes, bancoHoras) {
  const total = (field) =>
    apuracoes.reduce((acc, item) => acc + Number(item[field] || 0), 0);

  const saldoBancoHoras = bancoHoras.reduce((acc, item) => {
    if (item.tipo === "credito") return acc + Number(item.minutos || 0);
    if (item.tipo === "debito") return acc - Number(item.minutos || 0);
    return acc;
  }, 0);

  return {
    dias_processados: apuracoes.length,
    minutos_previstos: total("minutos_previstos"),
    minutos_trabalhados: total("minutos_trabalhados"),
    minutos_abonados: total("minutos_abonados"),
    minutos_extras: total("minutos_extras"),
    minutos_falta: total("minutos_falta"),
    saldo_periodo_minutos: total("saldo_minutos"),
    saldo_banco_horas_minutos: saldoBancoHoras
  };
}

function getQuantidadeDiasEntreDatas(dataInicio, dataFim) {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  return Math.floor((fim.getTime() - inicio.getTime()) / 86400000) + 1;
}

async function getUsuarioValido(client, usuarioId, empresaId) {
  const ret = await client.query(models.get_usuario_valido(), [
    usuarioId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Usuário não encontrado para a empresa informada.");
  }

  return ret.rows[0];
}

async function getTipoJustificativaValido(client, tipoJustificativaId) {
  const ret = await client.query(models.get_justificativa_tipo_by_id(), [
    tipoJustificativaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Tipo de justificativa inválido ou inativo.");
  }

  return ret.rows[0];
}

async function getRegistroPontoValido(client, registroPontoId, usuarioId, empresaId) {
  const ret = await client.query(models.get_registro_ponto_by_id(), [
    registroPontoId,
    usuarioId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Registro de ponto n??o encontrado para o usu??rio informado.");
  }

  return ret.rows[0];
}

async function getJustificativaValida(client, justificativaId, empresaId) {
  const ret = await client.query(models.get_justificativa_by_id(), [
    justificativaId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Justificativa não encontrada para a empresa informada.");
  }

  return ret.rows[0];
}


async function getHorarioTrabalhoUsuarioValido(
  client,
  usuarioHorarioId,
  usuarioId,
  empresaId
) {
  const ret = await client.query(models.get_horario_trabalho_usuario_by_id(), [
    usuarioHorarioId,
    usuarioId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Horário de trabalho não encontrado para o usuário informado.");
  }

  return ret.rows[0];
}
async function getDayOffValido(client, dayOffId, empresaId) {
  const ret = await client.query(models.get_day_off_by_id(), [
    dayOffId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Day off nÃ£o encontrado para a empresa informada.");
  }

  return ret.rows[0];
}

async function getFeriadoValido(client, feriadoId, empresaId) {
  const ret = await client.query(models.get_feriado_by_id(), [
    feriadoId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Feriado nÃ£o encontrado para a empresa informada.");
  }

  return ret.rows[0];
}

async function getFeriasValida(client, feriasId, empresaId) {
  const ret = await client.query(models.get_ferias_by_id(), [
    feriasId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Ferias nao encontradas para a empresa informada.");
  }

  return ret.rows[0];
}

async function getPeriodoFeriasValido(client, periodoFeriasId, usuarioId) {
  const ret = await client.query(models.get_periodo_ferias_by_id(), [
    periodoFeriasId,
    usuarioId
  ]);

  if (!ret.rows.length) {
    throw new Error("Periodo de ferias nao encontrado para o usuario informado.");
  }

  return ret.rows[0];
}

async function getPeriodoFeriasEmpresaValido(client, periodoFeriasId, empresaId) {
  const ret = await client.query(models.get_periodo_ferias_by_id_empresa(), [
    periodoFeriasId,
    empresaId
  ]);

  if (!ret.rows.length) {
    throw new Error("Periodo de ferias nao encontrado para a empresa informada.");
  }

  return ret.rows[0];
}

async function assertPeriodoFeriasDisponivel(
  client,
  usuarioId,
  periodoInicio,
  periodoFim,
  ignoreId = null
) {
  const ret = await client.query(models.get_periodo_ferias_usuario_conflito(), [
    usuarioId,
    periodoInicio,
    periodoFim,
    ignoreId
  ]);

  if (ret.rows.length) {
    throw new Error(
      "Ja existe um periodo aquisitivo de ferias cadastrado que conflita com as datas informadas."
    );
  }
}

async function assertPeriodoFeriasSemVinculos(client, periodoFeriasId) {
  const ret = await client.query(models.get_periodo_ferias_vinculos(), [periodoFeriasId]);
  const total = Number(ret.rows[0]?.total || 0);

  if (total > 0) {
    throw new Error(
      "Nao e possivel remover o periodo de ferias porque ele ja possui solicitacoes vinculadas."
    );
  }
}

async function assertDayOffDisponivel(client, usuarioId, dataReferencia, ignoreId = null) {
  const ret = await client.query(models.get_day_off_usuario_data(), [
    usuarioId,
    dataReferencia,
    ignoreId
  ]);

  if (ret.rows.length) {
    throw new Error("JÃ¡ existe um day off cadastrado para este usuÃ¡rio nesta data.");
  }
}

async function assertFeriadoDisponivel(client, empresaId, dataReferencia, ignoreId = null) {
  const ret = await client.query(models.get_feriado_empresa_data(), [
    empresaId,
    dataReferencia,
    ignoreId
  ]);

  if (ret.rows.length) {
    throw new Error("JÃ¡ existe um feriado ativo cadastrado nesta data.");
  }
}

async function recalcularUsuarioData(client, empresaId, usuarioId, dataReferencia) {
  return apurarDia(client, empresaId, usuarioId, dataReferencia);
}

async function assertFeriasDisponivel(
  client,
  usuarioId,
  dataInicio,
  dataFim,
  ignoreId = null
) {
  const ret = await client.query(models.get_ferias_usuario_conflito(), [
    usuarioId,
    dataInicio,
    dataFim,
    ignoreId
  ]);

  if (ret.rows.length) {
    throw new Error("Ja existe um periodo de ferias cadastrado que conflita com as datas informadas.");
  }
}

function getPeriodoFeriasStatusBySaldo(saldoDias) {
  if (Number(saldoDias) <= 0) return "utilizado";
  if (Number(saldoDias) < 30) return "parcial";
  return "disponivel";
}

function statusConsomeSaldoFerias(status) {
  return !["reprovado", "cancelado"].includes(String(status || "").trim().toLowerCase());
}

function normalizeSaldoDias(value, fallback = 30) {
  const saldo = Number(value ?? fallback);
  if (!Number.isInteger(saldo) || saldo < 0) {
    throw new Error("saldo_dias invalido. Informe um numero inteiro maior ou igual a zero.");
  }
  return saldo;
}

async function ajustarSaldoPeriodoFerias(client, periodoFeriasId, novoSaldo) {
  if (Number(novoSaldo) < 0) {
    throw new Error("Saldo de ferias insuficiente para a operacao.");
  }

  const ret = await client.query(models.atualizar_saldo_periodo_ferias(), [
    periodoFeriasId,
    Number(novoSaldo),
    getPeriodoFeriasStatusBySaldo(novoSaldo)
  ]);

  return ret.rows[0];
}

async function resolverPeriodoFerias(client, usuarioId, quantidadeDias, periodoFeriasId = null) {
  if (periodoFeriasId) {
    const periodo = await getPeriodoFeriasValido(client, periodoFeriasId, usuarioId);
    if (Number(periodo.saldo_dias) < Number(quantidadeDias)) {
      throw new Error("Saldo de dias insuficiente no periodo de ferias informado.");
    }
    return periodo;
  }

  const ret = await client.query(models.get_periodo_ferias_disponivel(), [
    usuarioId,
    quantidadeDias
  ]);

  if (!ret.rows.length) {
    throw new Error("Nenhum periodo de ferias disponivel com saldo suficiente para este usuario.");
  }

  return ret.rows[0];
}

async function recalcularEmpresaData(client, empresaId, dataReferencia) {
  const usuariosRet = await client.query(models.get_usuarios_empresa(), [empresaId]);
  const apuracoes = [];

  for (const usuario of usuariosRet.rows) {
    const apuracao = await recalcularUsuarioData(
      client,
      empresaId,
      usuario.id,
      dataReferencia
    );
    apuracoes.push(apuracao);
  }

  return apuracoes;
}

async function apurarDia(client, empresaId, usuarioId, dataReferencia) {
  const [registrosRet, horariosRet, dayOffRet, feriadoRet, feriasRet, justificativasRet] =
    await Promise.all([
      client.query(models.get_registros_do_dia(), [usuarioId, dataReferencia]),
      client.query(models.get_horarios_usuario(), [usuarioId]),
      client.query(models.get_day_off_data(), [usuarioId, dataReferencia]),
      client.query(models.get_feriado_data(), [empresaId, dataReferencia]),
      client.query(models.get_ferias_data(), [usuarioId, dataReferencia]),
      client.query(models.get_justificativas_data(), [usuarioId, dataReferencia])
    ]);

  const registros = registrosRet.rows;
  const horarios = horariosRet.rows;
  const date = parseDateInput(dataReferencia);
  const horarioDia = buildHorarioMatch(date, horarios);
  const dayOff = dayOffRet.rows[0] || null;
  const feriado = feriadoRet.rows[0] || null;
  const ferias = feriasRet.rows[0] || null;
  const justificativas = justificativasRet.rows;

  let minutosPrevistos = 0;
  let minutosTrabalhados = calculateWorkedMinutes(registros);
  let minutosAbonados = 0;
  let registrosEsperados = 0;
  let status = "apurado";

  if (horarioDia) {
    minutosPrevistos =
      Number(horarioDia.carga_prevista_minutos) ||
      Number(horarioDia.carga_horaria_diaria_minutos) ||
      0;
    registrosEsperados = getExpectedRegistros(horarioDia);
  }

  if (dayOff) {
    status = "day_off";
    minutosAbonados = Math.max(minutosPrevistos - minutosTrabalhados, 0);
  } else if (ferias) {
    status = "ferias";
    minutosAbonados = Math.max(minutosPrevistos - minutosTrabalhados, 0);
  } else if (feriado) {
    status = "feriado";
    minutosPrevistos = 0;
  } else if (!horarioDia) {
    status = "sem_horario";
  } else if (justificativas.length) {
    status = "justificado";
    minutosAbonados = Math.max(minutosPrevistos - minutosTrabalhados, 0);
  } else if (
    registros.length % 2 !== 0 ||
    (registrosEsperados > 0 && registros.length < registrosEsperados)
  ) {
    status = "incompleto";
  }

  const saldoMinutos = minutosTrabalhados + minutosAbonados - minutosPrevistos;
  const minutosExtras = saldoMinutos > 0 ? saldoMinutos : 0;
  const minutosFalta = saldoMinutos < 0 ? Math.abs(saldoMinutos) : 0;

  const apuracaoRet = await client.query(models.upsert_apuracao_ponto_diaria(), [
    usuarioId,
    dataReferencia,
    minutosPrevistos,
    minutosTrabalhados,
    minutosAbonados,
    minutosExtras,
    minutosFalta,
    saldoMinutos,
    status
  ]);

  const apuracao = apuracaoRet.rows[0];

  await client.query(models.limpar_banco_horas_apuracao(), [
    usuarioId,
    dataReferencia
  ]);

  let bancoHoras = null;

  if (saldoMinutos !== 0) {
    const bancoHorasRet = await client.query(
      models.inserir_banco_horas_lancamento(),
      [
        usuarioId,
        dataReferencia,
        saldoMinutos > 0 ? "credito" : "debito",
        Math.abs(saldoMinutos),
        "apuracao_diaria",
        apuracao.id,
        `Apuração automática do dia ${dataReferencia}`
      ]
    );
    bancoHoras = bancoHorasRet.rows[0];
  }

  return {
    apuracao,
    banco_horas_lancamento: bancoHoras,
    contexto: {
      day_off: dayOff,
      feriado,
      ferias,
      justificativas,
      horario: horarioDia
        ? {
          horario_trabalho_id: horarioDia.horario_trabalho_id,
          nome: horarioDia.nome,
          descricao: horarioDia.descricao,
          dia_semana: horarioDia.dia_semana,
          carga_prevista_minutos:
            Number(horarioDia.carga_prevista_minutos) ||
            Number(horarioDia.carga_horaria_diaria_minutos) ||
            0,
          tolerancia_entrada_minutos: horarioDia.tolerancia_entrada_minutos,
          tolerancia_saida_minutos: horarioDia.tolerancia_saida_minutos,
          tolerancia_extra_minutos: horarioDia.tolerancia_extra_minutos,
          flexivel: horarioDia.flexivel,
          registros_esperados: registrosEsperados,
          faixas: mountFaixas(horarioDia)
        }
        : null,
      registros
    }
  };
}

const execute = {
  execute_criar_periodo_ferias: async (
    empresaId,
    usuarioId,
    periodoAquisitivoInicio,
    periodoAquisitivoFim,
    saldoDias
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);

      const inicio = toDateOnly(parseDateInput(periodoAquisitivoInicio));
      const fim = toDateOnly(parseDateInput(periodoAquisitivoFim, true));
      if (new Date(fim).getTime() < new Date(inicio).getTime()) {
        throw new Error("periodo_aquisitivo_fim nao pode ser menor que periodo_aquisitivo_inicio.");
      }

      await assertPeriodoFeriasDisponivel(client, usuarioId, inicio, fim);

      const saldoNormalizado = normalizeSaldoDias(saldoDias);
      const ret = await client.query(models.inserir_periodo_ferias(), [
        usuarioId,
        inicio,
        fim,
        saldoNormalizado,
        getPeriodoFeriasStatusBySaldo(saldoNormalizado)
      ]);

      await client.query("COMMIT");
      return ret.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_listar_periodos_ferias: async (empresaId, usuarioId, dataInicio, dataFim) => {
    const client = await postgres.connect();

    try {
      if (usuarioId) {
        await getUsuarioValido(client, usuarioId, empresaId);
      }

      const inicio = dataInicio ? toDateOnly(parseDateInput(dataInicio)) : null;
      const fim = dataFim ? toDateOnly(parseDateInput(dataFim, true)) : null;

      const ret = await client.query(models.get_periodos_ferias_usuario_lista(), [
        empresaId,
        usuarioId || null,
        inicio,
        fim
      ]);

      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_editar_periodo_ferias: async (
    empresaId,
    periodoFeriasId,
    periodoAquisitivoInicio,
    periodoAquisitivoFim,
    saldoDias
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");

      const atual = await getPeriodoFeriasEmpresaValido(client, periodoFeriasId, empresaId);

      const inicio = periodoAquisitivoInicio
        ? toDateOnly(parseDateInput(periodoAquisitivoInicio))
        : toDateOnly(atual.periodo_aquisitivo_inicio);
      const fim = periodoAquisitivoFim
        ? toDateOnly(parseDateInput(periodoAquisitivoFim, true))
        : toDateOnly(atual.periodo_aquisitivo_fim);

      if (new Date(fim).getTime() < new Date(inicio).getTime()) {
        throw new Error("periodo_aquisitivo_fim nao pode ser menor que periodo_aquisitivo_inicio.");
      }

      await assertPeriodoFeriasDisponivel(client, atual.usuario_id, inicio, fim, atual.id);

      const saldoNormalizado = normalizeSaldoDias(saldoDias, atual.saldo_dias);
      const ret = await client.query(models.atualizar_periodo_ferias(), [
        atual.id,
        inicio,
        fim,
        saldoNormalizado,
        getPeriodoFeriasStatusBySaldo(saldoNormalizado)
      ]);

      await client.query("COMMIT");
      return ret.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_remover_periodo_ferias: async (empresaId, periodoFeriasId) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");

      const atual = await getPeriodoFeriasEmpresaValido(client, periodoFeriasId, empresaId);

      await assertPeriodoFeriasSemVinculos(client, atual.id);

      const ret = await client.query(models.deletar_periodo_ferias(), [atual.id]);

      await client.query("COMMIT");
      return ret.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_criar_ferias: async (
    empresaId,
    usuarioId,
    dataInicio,
    dataFim,
    observacao,
    status,
    periodoFeriasId,
    aprovadorUsuarioId
  ) => {
    const client = await postgres.connect();


    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const inicio = toDateOnly(parseDateInput(dataInicio));
      const fim = toDateOnly(parseDateInput(dataFim || dataInicio, true));

      if (new Date(fim).getTime() < new Date(inicio).getTime()) {
        throw new Error("data_fim nao pode ser menor que data_inicio.");
      }

      const quantidadeDias = getQuantidadeDiasEntreDatas(inicio, fim);
      const statusNormalizado = String(status || "aprovado").trim().toLowerCase();

      if (!["aprovado", "pendente", "reprovado", "cancelado"].includes(statusNormalizado)) {
        throw new Error("Status invalido. Use aprovado, pendente, reprovado ou cancelado.");
      }

      await assertFeriasDisponivel(client, usuarioId, inicio, fim);

      const periodo = await resolverPeriodoFerias(
        client,
        usuarioId,
        quantidadeDias,
        periodoFeriasId || null
      );

      let saldoPeriodo = periodo;
      if (statusConsomeSaldoFerias(statusNormalizado)) {
        saldoPeriodo = await ajustarSaldoPeriodoFerias(
          client,
          periodo.id,
          Number(periodo.saldo_dias) - quantidadeDias
        );
      }

      const ret = await client.query(models.inserir_ferias(), [
        usuarioId,
        periodo.id,
        inicio,
        fim,
        quantidadeDias,
        statusNormalizado,
        aprovadorUsuarioId || null,
        statusNormalizado === "aprovado" ? new Date() : null,
        String(observacao || "").trim() || null
      ]);

      const datasAfetadas = enumerateDates(inicio, fim);
      const apuracoes = [];

      if (statusNormalizado === "aprovado") {
        for (const dataReferencia of datasAfetadas) {
          const apuracao = await recalcularUsuarioData(
            client,
            empresaId,
            usuarioId,
            dataReferencia
          );
          apuracoes.push(apuracao);
        }
      }

      await client.query("COMMIT");

      return {
        ferias: ret.rows[0],
        periodo_ferias: saldoPeriodo,
        datas_recalculadas: statusNormalizado === "aprovado" ? datasAfetadas : [],
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_cadastrar_horario_trabalho: async (empresaId, usuarioId, payload) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const horarioPayload = normalizeHorarioPayload(payload);

      const horarioRet = await client.query(models.inserir_horario_trabalho(), [
        empresaId,
        horarioPayload.nome,
        horarioPayload.descricao,
        horarioPayload.carga_horaria_diaria_minutos,
        horarioPayload.carga_horaria_semanal_minutos,
        horarioPayload.tolerancia_entrada_minutos,
        horarioPayload.tolerancia_saida_minutos,
        horarioPayload.tolerancia_extra_minutos,
        horarioPayload.flexivel
      ]);

      const horario = horarioRet.rows[0];
      const dias = [];

      for (const dia of horarioPayload.dias) {
        const diaRet = await client.query(models.inserir_horario_trabalho_dia(), [
          horario.id,
          dia.dia_semana,
          dia.entrada_1,
          dia.saida_1,
          dia.entrada_2,
          dia.saida_2,
          dia.carga_prevista_minutos
        ]);
        dias.push(diaRet.rows[0]);
      }

      const vinculoRet = await client.query(models.inserir_usuario_horario(), [
        usuarioId,
        horario.id
      ]);

      await client.query("COMMIT");

      return {
        usuario_horario: vinculoRet.rows[0],
        horario_trabalho: {
          ...horario,
          dias
        }

      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },


  execute_listar_ferias_usuario: async (empresaId, usuarioId, dataInicio, dataFim) => {
    const client = await postgres.connect();

    try {
      if (usuarioId) {
        await getUsuarioValido(client, usuarioId, empresaId);
      }

      const inicio = dataInicio ? toDateOnly(parseDateInput(dataInicio)) : null;
      const fim = dataFim ? toDateOnly(parseDateInput(dataFim, true)) : null;

      const ret = await client.query(models.get_ferias_usuario_lista(), [
        empresaId,
        usuarioId || null,
        inicio,
        fim
      ]);

      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_editar_ferias: async (
    empresaId,
    feriasId,
    dataInicio,
    dataFim,
    observacao,
    status,
    periodoFeriasId,
    aprovadorUsuarioId
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      const atual = await getFeriasValida(client, feriasId, empresaId);

      const inicio = dataInicio
        ? toDateOnly(parseDateInput(dataInicio))
        : toDateOnly(atual.data_inicio);
      const fim = dataFim
        ? toDateOnly(parseDateInput(dataFim, true))
        : toDateOnly(atual.data_fim);

      if (new Date(fim).getTime() < new Date(inicio).getTime()) {
        throw new Error("data_fim nao pode ser menor que data_inicio.");
      }

      const quantidadeDias = getQuantidadeDiasEntreDatas(inicio, fim);
      const statusNormalizado = String(status || atual.status || "aprovado")
        .trim()
        .toLowerCase();

      if (!["aprovado", "pendente", "reprovado", "cancelado"].includes(statusNormalizado)) {
        throw new Error("Status invalido. Use aprovado, pendente, reprovado ou cancelado.");
      }

      await assertFeriasDisponivel(client, atual.usuario_id, inicio, fim, atual.id);

      const periodoAtual = await getPeriodoFeriasValido(
        client,
        atual.periodo_ferias_id,
        atual.usuario_id
      );

      if (statusConsomeSaldoFerias(atual.status)) {
        await ajustarSaldoPeriodoFerias(
          client,
          periodoAtual.id,
          Number(periodoAtual.saldo_dias) + Number(atual.quantidade_dias)
        );
      }

      const novoPeriodo = await resolverPeriodoFerias(
        client,
        atual.usuario_id,
        quantidadeDias,
        periodoFeriasId || atual.periodo_ferias_id
      );

      let saldoPeriodo = novoPeriodo;
      if (statusConsomeSaldoFerias(statusNormalizado)) {
        saldoPeriodo = await ajustarSaldoPeriodoFerias(
          client,
          novoPeriodo.id,
          Number(novoPeriodo.saldo_dias) - quantidadeDias
        );
      }

      const ret = await client.query(models.atualizar_ferias(), [
        atual.id,
        novoPeriodo.id,
        inicio,
        fim,
        quantidadeDias,
        statusNormalizado,
        aprovadorUsuarioId === undefined
          ? atual.aprovado_por
          : aprovadorUsuarioId || null,
        statusNormalizado === "aprovado" ? new Date() : atual.aprovado_em,
        observacao === undefined
          ? atual.observacao
          : String(observacao || "").trim() || null
      ]);

      const datasAfetadas = Array.from(
        new Set([
          ...enumerateDates(atual.data_inicio, atual.data_fim),
          ...enumerateDates(inicio, fim)
        ])
      );
      const apuracoes = [];

      for (const dataReferencia of datasAfetadas) {
        const apuracao = await recalcularUsuarioData(
          client,
          empresaId,
          atual.usuario_id,
          dataReferencia
        );
        apuracoes.push(apuracao);
      }

      await client.query("COMMIT");

      return {
        ferias: ret.rows[0],
        periodo_ferias: saldoPeriodo,
        datas_recalculadas: datasAfetadas,
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_listar_horarios_trabalho_usuario: async (empresaId, usuarioId) => {
    const client = await postgres.connect();

    try {
      await getUsuarioValido(client, usuarioId, empresaId);
      const ret = await client.query(models.get_horarios_trabalho_usuario_lista(), [
        usuarioId,
        empresaId
      ]);

      return ret.rows.map((item) => ({
        ...item,
        flexivel: Boolean(item.flexivel),
        ativo: Boolean(item.ativo),
        dias: Array.isArray(item.dias) ? item.dias : []
      }));

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },


  execute_remover_ferias: async (empresaId, feriasId) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      const atual = await getFeriasValida(client, feriasId, empresaId);
      const periodoAtual = await getPeriodoFeriasValido(
        client,
        atual.periodo_ferias_id,
        atual.usuario_id
      );

      const ret = await client.query(models.deletar_ferias(), [atual.id]);
      let saldoPeriodo = periodoAtual;
      if (statusConsomeSaldoFerias(atual.status)) {
        saldoPeriodo = await ajustarSaldoPeriodoFerias(
          client,
          periodoAtual.id,
          Number(periodoAtual.saldo_dias) + Number(atual.quantidade_dias)
        );
      }

      const datasAfetadas = enumerateDates(atual.data_inicio, atual.data_fim);
      const apuracoes = [];

      for (const dataReferencia of datasAfetadas) {
        const apuracao = await recalcularUsuarioData(
          client,
          empresaId,
          atual.usuario_id,
          dataReferencia
        );
        apuracoes.push(apuracao);
      }

      await client.query("COMMIT");

      return {
        ferias: ret.rows[0],
        periodo_ferias: saldoPeriodo,
        datas_recalculadas: datasAfetadas,
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_editar_horario_trabalho: async (
    empresaId,
    usuarioId,
    usuarioHorarioId,
    payload) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const horarioAtual = await getHorarioTrabalhoUsuarioValido(
        client,
        usuarioHorarioId,
        usuarioId,
        empresaId
      );
      const horarioPayload = normalizeHorarioPayload(payload);

      const horarioRet = await client.query(models.atualizar_horario_trabalho(), [
        horarioAtual.horario_trabalho_id,
        horarioPayload.nome,
        horarioPayload.descricao,
        horarioPayload.carga_horaria_diaria_minutos,
        horarioPayload.carga_horaria_semanal_minutos,
        horarioPayload.tolerancia_entrada_minutos,
        horarioPayload.tolerancia_saida_minutos,
        horarioPayload.tolerancia_extra_minutos,
        horarioPayload.flexivel
      ]);

      await client.query(models.deletar_horario_trabalho_dias(), [
        horarioAtual.horario_trabalho_id
      ]);

      const dias = [];
      for (const dia of horarioPayload.dias) {
        const diaRet = await client.query(models.inserir_horario_trabalho_dia(), [
          horarioAtual.horario_trabalho_id,
          dia.dia_semana,
          dia.entrada_1,
          dia.saida_1,
          dia.entrada_2,
          dia.saida_2,
          dia.carga_prevista_minutos
        ]);
        dias.push(diaRet.rows[0]);
      }

      await client.query("COMMIT");

      return {
        usuario_horario_id: horarioAtual.usuario_horario_id,
        usuario_id: usuarioId,
        horario_trabalho: {
          ...horarioRet.rows[0],
          dias
        }
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_criar_day_off: async (
    empresaId,
    usuarioId,
    dataReferencia,
    tipo,
    observacao,
    status
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);

      const dateRef = toDateOnly(parseDateInput(dataReferencia));
      const tipoNormalizado = String(tipo || "day_off").trim() || "day_off";
      const statusNormalizado = String(status || "aprovado").trim().toLowerCase();

      if (!["aprovado", "pendente", "reprovado"].includes(statusNormalizado)) {
        throw new Error("Status invÃ¡lido. Use aprovado, pendente ou reprovado.");
      }

      await assertDayOffDisponivel(client, usuarioId, dateRef);

      const ret = await client.query(models.inserir_day_off(), [
        usuarioId,
        dateRef,
        tipoNormalizado,
        String(observacao || "").trim() || null,
        statusNormalizado
      ]);

      let apuracao = null;
      if (statusNormalizado === "aprovado") {
        apuracao = await recalcularUsuarioData(client, empresaId, usuarioId, dateRef);
      }

      await client.query("COMMIT");

      return {
        day_off: ret.rows[0],
        apuracao
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  execute_deletar_horario_trabalho: async (
    empresaId,
    usuarioId,
    usuarioHorarioId
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");

      await getUsuarioValido(client, usuarioId, empresaId);
      const horarioAtual = await getHorarioTrabalhoUsuarioValido(
        client,
        usuarioHorarioId,
        usuarioId,
        empresaId
      );

      const vinculoRet = await client.query(models.desativar_usuario_horario(), [
        usuarioHorarioId
      ]);

      const totalOutrosRet = await client.query(
        models.count_outros_usuarios_horario_ativos(),
        [horarioAtual.horario_trabalho_id]
      );

      const totalAtivos = Number(totalOutrosRet.rows[0]?.total || 0);
      let horarioDesativado = null;

      if (totalAtivos === 0) {
        const horarioRet = await client.query(models.desativar_horario_trabalho(), [
          horarioAtual.horario_trabalho_id
        ]);
        await client.query(models.desativar_horario_trabalho_dias(), [
          horarioAtual.horario_trabalho_id
        ]);
        horarioDesativado = horarioRet.rows[0] || null;
      }

      await client.query("COMMIT");

      return {
        usuario_horario: vinculoRet.rows[0],
        horario_trabalho: horarioDesativado
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  execute_listar_day_off_usuario: async (
    empresaId,
    usuarioId,
    dataInicio,
    dataFim
  ) => {
    const client = await postgres.connect();

    try {
      if (usuarioId) {
        await getUsuarioValido(client, usuarioId, empresaId);
      }

      const inicio = dataInicio ? toDateOnly(parseDateInput(dataInicio)) : null;
      const fim = dataFim ? toDateOnly(parseDateInput(dataFim, true)) : null;

      const ret = await client.query(models.get_day_off_usuario_lista(), [
        empresaId,
        usuarioId || null,
        inicio,
        fim
      ]);

      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_editar_day_off: async (
    empresaId,
    dayOffId,
    dataReferencia,
    tipo,
    observacao,
    status
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      const atual = await getDayOffValido(client, dayOffId, empresaId);

      const dateRef = dataReferencia
        ? toDateOnly(parseDateInput(dataReferencia))
        : toDateOnly(atual.data_referencia);
      const tipoNormalizado = String(tipo || atual.tipo || "day_off").trim() || "day_off";
      const statusNormalizado = String(status || atual.status || "aprovado")
        .trim()
        .toLowerCase();

      if (!["aprovado", "pendente", "reprovado"].includes(statusNormalizado)) {
        throw new Error("Status invÃ¡lido. Use aprovado, pendente ou reprovado.");
      }

      await assertDayOffDisponivel(client, atual.usuario_id, dateRef, atual.id);

      const ret = await client.query(models.atualizar_day_off(), [
        atual.id,
        dateRef,
        tipoNormalizado,
        observacao === undefined
          ? atual.observacao
          : String(observacao || "").trim() || null,
        statusNormalizado
      ]);

      const datasAfetadas = Array.from(
        new Set([toDateOnly(atual.data_referencia), dateRef])
      );
      const apuracoes = [];

      for (const dataAfetada of datasAfetadas) {
        const apuracao = await recalcularUsuarioData(
          client,
          empresaId,
          atual.usuario_id,
          dataAfetada
        );
        apuracoes.push(apuracao);
      }

      await client.query("COMMIT");

      return {
        day_off: ret.rows[0],
        datas_recalculadas: datasAfetadas,
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_remover_day_off: async (empresaId, dayOffId) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      const atual = await getDayOffValido(client, dayOffId, empresaId);

      const ret = await client.query(models.deletar_day_off_usuario_data(), [
        atual.usuario_id,
        toDateOnly(atual.data_referencia)
      ]);

      const apuracao = await recalcularUsuarioData(
        client,
        empresaId,
        atual.usuario_id,
        toDateOnly(atual.data_referencia)
      );

      await client.query("COMMIT");

      return {
        day_off: ret.rows[0] || null,
        day_offs_removidos: ret.rows,
        apuracao
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_criar_feriado: async (
    empresaId,
    dataReferencia,
    descricao,
    tipo,
    ativo
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");

      const dateRef = toDateOnly(parseDateInput(dataReferencia));
      const descricaoNormalizada = String(descricao || "").trim();
      if (!descricaoNormalizada) {
        throw new Error("Informe a descriÃ§Ã£o do feriado.");
      }

      const tipoNormalizado = String(tipo || "nacional").trim() || "nacional";
      const ativoNormalizado = ativo === undefined ? true : Boolean(ativo);

      if (ativoNormalizado) {
        await assertFeriadoDisponivel(client, empresaId, dateRef);
      }

      const ret = await client.query(models.inserir_feriado(), [
        empresaId,
        dateRef,
        descricaoNormalizada,
        tipoNormalizado,
        ativoNormalizado
      ]);

      let apuracoes = [];
      if (ativoNormalizado) {
        apuracoes = await recalcularEmpresaData(client, empresaId, dateRef);
      }

      await client.query("COMMIT");

      return {
        feriado: ret.rows[0],
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_listar_feriados: async (empresaId, dataInicio, dataFim) => {
    const client = await postgres.connect();

    try {
      const inicio = dataInicio ? toDateOnly(parseDateInput(dataInicio)) : null;
      const fim = dataFim ? toDateOnly(parseDateInput(dataFim, true)) : null;

      const ret = await client.query(models.get_feriados_lista(), [
        empresaId,
        inicio,
        fim
      ]);

      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_editar_feriado: async (
    empresaId,
    feriadoId,
    dataReferencia,
    descricao,
    tipo,
    ativo
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      const atual = await getFeriadoValido(client, feriadoId, empresaId);

      const dateRef = dataReferencia
        ? toDateOnly(parseDateInput(dataReferencia))
        : toDateOnly(atual.data_referencia);
      const descricaoNormalizada =
        descricao === undefined
          ? atual.descricao
          : String(descricao || "").trim();

      if (!descricaoNormalizada) {
        throw new Error("Informe a descriÃ§Ã£o do feriado.");
      }

      const tipoNormalizado = String(tipo || atual.tipo || "nacional").trim() || "nacional";
      const ativoNormalizado = ativo === undefined ? Boolean(atual.ativo) : Boolean(ativo);

      if (ativoNormalizado) {
        await assertFeriadoDisponivel(client, empresaId, dateRef, atual.id);
      }

      const ret = await client.query(models.atualizar_feriado(), [
        atual.id,
        dateRef,
        descricaoNormalizada,
        tipoNormalizado,
        ativoNormalizado
      ]);

      const datasAfetadas = Array.from(
        new Set([toDateOnly(atual.data_referencia), dateRef])
      );
      const apuracoes = [];

      for (const dataAfetada of datasAfetadas) {
        const retApuracoes = await recalcularEmpresaData(
          client,
          empresaId,
          dataAfetada
        );
        apuracoes.push({
          data_referencia: dataAfetada,
          resultados: retApuracoes
        });
      }

      await client.query("COMMIT");

      return {
        feriado: ret.rows[0],
        datas_recalculadas: datasAfetadas,
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_remover_feriado: async (empresaId, feriadoId) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      const atual = await getFeriadoValido(client, feriadoId, empresaId);

      const ret = await client.query(models.deletar_feriado(), [atual.id]);
      const apuracoes = await recalcularEmpresaData(
        client,
        empresaId,
        toDateOnly(atual.data_referencia)
      );

      await client.query("COMMIT");

      return {
        feriado: ret.rows[0],
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_adicionar_justificativa: async (
    empresaId,
    usuarioId,
    tipoJustificativaId,
    dataInicio,
    dataFim,
    descricao,
    anexo
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const tipoJustificativa = await getTipoJustificativaValido(
        client,
        tipoJustificativaId
      );

      const inicio = parseDateInput(dataInicio);
      const fim = parseDateInput(dataFim || dataInicio);

      if (fim.getTime() < inicio.getTime()) {
        throw new Error("data_fim não pode ser menor que data_inicio.");
      }

      if (tipoJustificativa.has_text && !String(descricao || "").trim()) {
        throw new Error(
          "Este tipo de justificativa exige o preenchimento da descrição."
        );
      }

      const justificativaRet = await client.query(models.inserir_justificativa(), [
        usuarioId,
        tipoJustificativa.id,
        inicio,
        fim,
        String(descricao || "").trim() || null,
        "pendente"
      ]);

      let anexoRet = null;

      if (anexo) {
        const insertAnexo = await client.query(
          models.inserir_justificativa_anexo(),
          [
            justificativaRet.rows[0].id,
            anexo.originalname,
            anexo.url,
            anexo.mimetype || null
          ]
        );
        anexoRet = insertAnexo.rows[0];
      }

      await client.query("COMMIT");

      return {
        justificativa: {
          ...justificativaRet.rows[0],
          tipo: tipoJustificativa.descricao,
          tipo_descricao: tipoJustificativa.descricao,
          has_text: tipoJustificativa.has_text
        },
        anexo: anexoRet
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_listar_justificativas: async (
    empresaId,
    usuarioId,
    status,
    dataInicio,
    dataFim
  ) => {
    const client = await postgres.connect();

    try {
      const inicio = dataInicio ? toDateOnly(parseDateInput(dataInicio)) : null;
      const fim = dataFim ? toDateOnly(parseDateInput(dataFim, true)) : null;
      const statusNormalizado = status ? String(status).trim().toLowerCase() : null;

      if (
        statusNormalizado &&
        !["pendente", "aprovado", "reprovado"].includes(statusNormalizado)
      ) {
        throw new Error("Status inválido. Use pendente, aprovado ou reprovado.");
      }

      const ret = await client.query(models.get_justificativas_lista(), [
        empresaId,
        usuarioId || null,
        statusNormalizado,
        inicio,
        fim
      ]);

      return ret.rows.map((item) => ({
        ...item,
        has_text: Boolean(item.has_text),
        anexos: Array.isArray(item.anexos) ? item.anexos : []
      }));
    } finally {
      client.release();
    }
  },

  execute_aprovar_reprovar_justificativa: async (
    empresaId,
    aprovadorUsuarioId,
    justificativaId,
    status,
    motivoRecusa
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, aprovadorUsuarioId, empresaId);

      const statusNormalizado = String(status || "").trim().toLowerCase();
      if (!["aprovado", "reprovado"].includes(statusNormalizado)) {
        throw new Error("Status inválido. Use aprovado ou reprovado.");
      }

      const motivoRecusaNormalizado = String(motivoRecusa || "").trim() || null;
      if (statusNormalizado === "reprovado" && !motivoRecusaNormalizado) {
        throw new Error("Informe o motivo_recusa para reprovar a justificativa.");
      }

      const justificativaAtual = await getJustificativaValida(
        client,
        justificativaId,
        empresaId
      );

      const justificativaRet = await client.query(
        models.atualizar_status_justificativa(),
        [
          justificativaAtual.id,
          statusNormalizado,
          aprovadorUsuarioId,
          statusNormalizado === "reprovado" ? motivoRecusaNormalizado : null
        ]
      );

      const justificativa = {
        ...justificativaRet.rows[0],
        tipo: justificativaAtual.tipo,
        tipo_descricao: justificativaAtual.tipo_descricao,
        has_text: Boolean(justificativaAtual.has_text)
      };

      const datasAfetadas = enumerateDates(
        justificativa.data_inicio,
        justificativa.data_fim
      );

      const apuracoes = [];
      for (const dataReferencia of datasAfetadas) {
        const apuracao = await apurarDia(
          client,
          empresaId,
          justificativa.usuario_id,
          dataReferencia
        );
        apuracoes.push(apuracao);
      }

      await client.query("COMMIT");

      return {
        justificativa,
        datas_recalculadas: datasAfetadas,
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_validar_day_off: async (empresaId, usuarioId, dataReferencia) => {
    const client = await postgres.connect();

    try {
      await getUsuarioValido(client, usuarioId, empresaId);
      const dateRef = toDateOnly(parseDateInput(dataReferencia));

      const [dayOffRet, feriadoRet, horariosRet] = await Promise.all([
        client.query(models.get_day_off_data(), [usuarioId, dateRef]),
        client.query(models.get_feriado_data(), [empresaId, dateRef]),
        client.query(models.get_horarios_usuario(), [usuarioId])
      ]);

      const horario = buildHorarioMatch(parseDateInput(dateRef), horariosRet.rows);

      return {
        permite_batida: dayOffRet.rows.length === 0,
        data_referencia: dateRef,
        day_off: dayOffRet.rows[0] || null,
        feriado: feriadoRet.rows[0] || null,
        horario: horario
          ? {
            horario_trabalho_id: horario.horario_trabalho_id,
            nome: horario.nome,
            dia_semana: horario.dia_semana,
            carga_prevista_minutos:
              Number(horario.carga_prevista_minutos) ||
              Number(horario.carga_horaria_diaria_minutos) ||
              0,
            faixas: mountFaixas(horario)
          }
          : null
      };
    } finally {
      client.release();
    }
  },

  execute_registrar_batida: async (
    empresaId,
    usuarioId,
    tipo,
    dataHora,
    pontoMetadata = {}
  ) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const metadata = normalizePontoMetadata(pontoMetadata, usuarioId);
      validateRequiredGeolocation(metadata);

      if (metadata.registrado_por_usuario_id) {
        await getUsuarioValido(client, metadata.registrado_por_usuario_id, empresaId);
      }

      const instante = dataHora ? parseDateInput(dataHora) : new Date();
      const dataReferencia = toDateOnly(instante);

      const validacao = await client.query(models.get_day_off_data(), [
        usuarioId,
        dataReferencia
      ]);

      if (validacao.rows.length) {
        throw new Error("Usuário está em day off aprovado nesta data.");
      }

      const registrosAtuais = await client.query(models.get_registros_do_dia(), [
        usuarioId,
        dataReferencia
      ]);

      const tipoBatida = tipo || inferBatidaTipo(registrosAtuais.rows);
      const registroRet = await client.query(models.inserir_registro_ponto(), [
        usuarioId,
        instante,
        tipoBatida,
        metadata.latitude,
        metadata.longitude,
        metadata.precisao_metros,
        metadata.localizacao_capturada_em,
        metadata.geolocalizacao_status,
        metadata.geolocalizacao_autorizada,
        metadata.timezone_cliente,
        metadata.idioma_cliente,
        metadata.plataforma_cliente,
        metadata.user_agent,
        metadata.dispositivo_mobile,
        metadata.origem_registro,
        metadata.registrado_por_usuario_id,
        metadata.ip_publico,
        metadata.faixa_ip
      ]);

      const apuracao = await apurarDia(
        client,
        empresaId,
        usuarioId,
        dataReferencia
      );

      await client.query("COMMIT");

      return {
        registro: registroRet.rows[0],
        ...apuracao
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_editar_registro_ponto: async (empresaId, usuarioId, registroPontoId, tipo, dataHora) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const atual = await getRegistroPontoValido(client, registroPontoId, usuarioId, empresaId);

      const instante = dataHora ? parseDateInput(dataHora) : new Date(atual.data_hora);
      const tipoNormalizado = String(tipo || atual.tipo || "").trim();
      if (!tipoNormalizado) {
        throw new Error("Informe o tipo da batida.");
      }

      const registroRet = await client.query(models.atualizar_registro_ponto(), [
        atual.id,
        instante,
        tipoNormalizado
      ]);

      const datasAfetadas = Array.from(
        new Set([toDateOnly(atual.data_hora), toDateOnly(instante)])
      );
      const apuracoes = [];

      for (const dataRef of datasAfetadas) {
        const apuracao = await apurarDia(client, empresaId, usuarioId, dataRef);
        apuracoes.push(apuracao);
      }

      await client.query("COMMIT");

      return {
        registro: registroRet.rows[0],
        datas_recalculadas: datasAfetadas,
        apuracoes
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_deletar_registro_ponto: async (empresaId, usuarioId, registroPontoId) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const atual = await getRegistroPontoValido(client, registroPontoId, usuarioId, empresaId);

      const ret = await client.query(models.deletar_registro_ponto(), [atual.id]);
      const dataRef = toDateOnly(atual.data_hora);
      const apuracao = await apurarDia(client, empresaId, usuarioId, dataRef);

      await client.query("COMMIT");

      return {
        registro: ret.rows[0],
        datas_recalculadas: [dataRef],
        apuracoes: [apuracao]
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_recalcular_dia: async (empresaId, usuarioId, dataReferencia) => {
    const client = await postgres.connect();

    try {
      await client.query("BEGIN");
      await getUsuarioValido(client, usuarioId, empresaId);
      const dateRef = toDateOnly(parseDateInput(dataReferencia));
      const ret = await apurarDia(client, empresaId, usuarioId, dateRef);
      await client.query("COMMIT");
      return ret;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_relatorio_ponto: async (empresaId, usuarioId, dataInicio, dataFim) => {
    const client = await postgres.connect();

    try {
      await getUsuarioValido(client, usuarioId, empresaId);

      const inicio = toDateOnly(parseDateInput(dataInicio));
      const fim = toDateOnly(parseDateInput(dataFim, true));

      const [registrosRet, apuracaoRet, dayOffRet] = await Promise.all([
        client.query(models.get_registros_periodo(), [
          usuarioId,
          empresaId,
          inicio,
          fim
        ]),
        client.query(models.get_apuracao_periodo(), [usuarioId, empresaId, inicio, fim]),
        client.query(models.get_day_off_periodo(), [usuarioId, inicio, fim])
      ]);

      const registrosPorDia = registrosRet.rows.reduce((acc, item) => {
        const key = toDateOnly(item.data_referencia);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});

      const dayOffPorDia = dayOffRet.rows.reduce((acc, item) => {
        acc[toDateOnly(item.data_referencia)] = item;
        return acc;
      }, {});

      const dias = apuracaoRet.rows.map((item) => {
        const key = toDateOnly(item.data_referencia);
        return {
          ...item,
          registros: registrosPorDia[key] || [],
          day_off: dayOffPorDia[key] || null
        };
      });
      return {
        periodo: {
          data_inicio: inicio,
          data_fim: fim
        },
        dias
      };
    } finally {
      client.release();
    }
  },

  execute_balanco_ponto: async (empresaId, usuarioId, dataInicio, dataFim) => {
    const client = await postgres.connect();

    try {
      await getUsuarioValido(client, usuarioId, empresaId);

      const inicio = toDateOnly(parseDateInput(dataInicio));
      const fim = toDateOnly(parseDateInput(dataFim, true));

      const [apuracaoRet, bancoRet] = await Promise.all([
        client.query(models.get_apuracao_periodo(), [usuarioId, empresaId, inicio, fim]),
        client.query(models.get_banco_horas_periodo(), [usuarioId, inicio, fim])
      ]);

      return {
        periodo: {
          data_inicio: inicio,
          data_fim: fim
        },
        resumo: buildResumo(apuracaoRet.rows, bancoRet.rows),
        apuracoes: apuracaoRet.rows,
        banco_horas: bancoRet.rows
      };
    } finally {
      client.release();
    }
  },

  execute_banco_horas: async (empresaId, usuarioId, dataInicio, dataFim) => {
    const client = await postgres.connect();

    try {
      await getUsuarioValido(client, usuarioId, empresaId);

      const inicio = toDateOnly(parseDateInput(dataInicio));
      const fim = toDateOnly(parseDateInput(dataFim, true));

      const [lancamentosRet, saldoRet] = await Promise.all([
        client.query(models.get_banco_horas_periodo(), [usuarioId, inicio, fim]),
        client.query(models.get_banco_horas_saldo(), [usuarioId])
      ]);

      return {
        periodo: {
          data_inicio: inicio,
          data_fim: fim
        },
        saldo_minutos: Number(saldoRet.rows[0]?.saldo_minutos || 0),
        lancamentos: lancamentosRet.rows
      };
    } finally {
      client.release();
    }
  },

  execute_justificativa_tipo_select: async () => {
    const client = await postgres.connect();

    try {
      const ret = await client.query(models.get_justificativa_tipo_select());
      return ret.rows.map((item) => ({
        ...item,
        has_text: Boolean(item.has_text)
      }));
    } finally {
      client.release();
    }
  }
};

module.exports = execute;



