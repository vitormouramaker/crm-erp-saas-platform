const crypto = require("crypto");
const models = require("../models/models_financeiro");
const { postgres } = require("../server/connect");
const fn = require("../functions/function_financeiro");

const CICLOS_ASSINATURA_VALIDOS = new Set([
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
  "outro",
]);

async function query_rows(sql, params = []) {
  const client = await postgres.connect();
  try {
    const ret = await client.query(sql, params);
    return ret.rows;
  } finally {
    client.release();
  }
}

async function query_one(sql, params = []) {
  const rows = await query_rows(sql, params);
  return rows[0] || null;
}

async function with_transaction(handler) {
  const client = await postgres.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function get_current_month_reference() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

async function sync_financeiro_alertas_empresa(empresaId, sharedClient = null) {
  const client = sharedClient || (await postgres.connect());
  try {
    await client.query(models.sincronizar_contas_pagar_empresa(), [empresaId]);
    await client.query(models.sincronizar_contas_receber_empresa(), [empresaId]);
    await client.query(models.gerar_alertas_contas_pagar_vencidas(), [empresaId]);
    await client.query(models.gerar_alertas_contas_receber_vencidas(), [empresaId]);
    await client.query(models.resolver_alertas_vencidos_sem_pendencia(), [empresaId]);
  } finally {
    if (!sharedClient) client.release();
  }
}

const execute = {
  execute_dominios: async () => {
    return query_rows(models.listar_dominios());
  },

  execute_listar_categorias: async (empresaId) => {
    return query_rows(models.listar_categorias(), [empresaId]);
  },

  execute_criar_categoria: async (payload) => {
    const nome = String(payload.nome || "").trim();
    const tipoCodigo = String(payload.tipo_codigo || "ambos").trim().toLowerCase();
    const categoriaPaiId = fn.to_int(payload.categoria_pai_id);

    if (!nome) {
      throw new Error("Informe nome da categoria.");
    }

    return query_one(models.criar_categoria(), [
      payload.empresa_id,
      nome,
      tipoCodigo,
      categoriaPaiId || null,
    ]);
  },

  execute_listar_centros_custo: async (payload) =>
    query_rows(models.listar_centros_custo(), [
      payload.empresa_id,
      fn.to_boolean(payload.incluir_inativos, false),
    ]),

  execute_salvar_centro_custo: async (payload) => {
    const nome = String(payload.nome || "").trim();
    if (!nome) throw new Error("Informe o nome do centro de custo.");
    if (fn.to_int(payload.id)) {
      return query_one(models.editar_centro_custo(), [
        fn.to_int(payload.id), payload.empresa_id, payload.codigo || null, nome,
        payload.descricao || null, payload.ativo,
      ]);
    }
    return query_one(models.salvar_centro_custo(), [
      payload.empresa_id, payload.codigo || null, nome, payload.descricao || null,
    ]);
  },

  execute_listar_contas_financeiras: async (payload) =>
    query_rows(models.listar_contas_financeiras(), [
      payload.empresa_id,
      fn.to_boolean(payload.incluir_inativos, false),
    ]),

  execute_salvar_conta_financeira: async (payload) => {
    const nome = String(payload.nome || "").trim();
    const tipo = String(payload.tipo || "conta_corrente").trim().toLowerCase();
    const saldoInicial = fn.to_number(payload.saldo_inicial, 0);
    if (!nome) throw new Error("Informe o nome da conta financeira.");
    const empresasGrupoIds = Array.isArray(payload.empresas_grupo_ids)
      ? payload.empresas_grupo_ids.map((id) => fn.to_int(id)).filter(Boolean)
      : [];
    return with_transaction(async (client) => {
      const id = fn.to_int(payload.id);
      const ret = id
        ? await client.query(models.editar_conta_financeira(), [id, payload.empresa_id, nome, tipo,
            payload.banco || null, payload.agencia || null, payload.conta || null,
            payload.pix_chave || null, saldoInicial, payload.ativo])
        : await client.query(models.salvar_conta_financeira(), [payload.empresa_id, nome, tipo,
            payload.banco || null, payload.agencia || null, payload.conta || null,
            payload.pix_chave || null, saldoInicial]);
      const conta = ret.rows[0];
      if (!conta) throw new Error("Conta financeira nao encontrada.");
      await client.query(models.substituir_empresas_conta(), [payload.empresa_id, conta.id, empresasGrupoIds]);
      return conta;
    });
  },

  execute_listar_contrapartes: async (payload) =>
    query_rows(models.listar_contrapartes(), [
      payload.empresa_id,
      fn.to_boolean(payload.incluir_inativos, false),
    ]),

  execute_salvar_contraparte: async (payload) => {
    const nome = String(payload.nome || "").trim();
    const tipo = String(payload.tipo || "outros").trim().toLowerCase();
    if (!nome) throw new Error("Informe o nome do cliente ou fornecedor.");
    const cpf = String(payload.cpf || "").trim() || null;
    const cnpj = String(payload.cnpj || "").trim() || null;
    const documento = String(payload.documento || cpf || cnpj || "").trim() || null;
    const dados = [documento, cpf, cnpj, payload.email || null, payload.telefone || null,
      payload.endereco || null, payload.cep || null, String(payload.uf || "").trim().toUpperCase() || null,
      payload.cidade || null, tipo];
    if (fn.to_int(payload.id)) {
      return query_one(models.editar_contraparte(), [
        fn.to_int(payload.id), payload.empresa_id, nome, ...dados, payload.ativo,
      ]);
    }
    return query_one(models.salvar_contraparte(), [payload.empresa_id, nome, ...dados]);
  },

  execute_listar_empresas_grupo: async (payload) => query_rows(models.listar_empresas_grupo(), [
    payload.empresa_id, fn.to_boolean(payload.incluir_inativos, false),
  ]),

  execute_salvar_empresa_grupo: async (payload) => {
    const nome = String(payload.nome || "").trim();
    if (!nome) throw new Error("Informe o nome da empresa do grupo.");
    const values = [nome, payload.razao_social || null, payload.cnpj || null, payload.email || null,
      payload.telefone || null, payload.endereco || null, payload.cep || null,
      String(payload.uf || "").trim().toUpperCase() || null, payload.cidade || null];
    return fn.to_int(payload.id)
      ? query_one(models.editar_empresa_grupo(), [fn.to_int(payload.id), payload.empresa_id, ...values, payload.ativo])
      : query_one(models.salvar_empresa_grupo(), [payload.empresa_id, ...values]);
  },

  execute_listar_formas_pagamento: async (payload) => query_rows(models.listar_formas_pagamento(), [
    payload.empresa_id, fn.to_boolean(payload.incluir_inativos, false),
  ]),

  execute_salvar_forma_pagamento: async (payload) => {
    const nome = String(payload.nome || "").trim();
    const percentual = fn.to_number(payload.taxa_percentual, 0);
    const fixa = fn.to_number(payload.taxa_fixa, 0);
    if (!nome || percentual < 0 || fixa < 0) throw new Error("Informe nome e taxas validas.");
    return fn.to_int(payload.id)
      ? query_one(models.editar_forma_pagamento(), [fn.to_int(payload.id), payload.empresa_id, nome, percentual, fixa, payload.ativo])
      : query_one(models.salvar_forma_pagamento(), [payload.empresa_id, nome, percentual, fixa]);
  },

  execute_criar_conta_pagar: async (payload) => {
    const descricao = String(payload.descricao || "").trim();
    const vencimento = fn.to_date(payload.vencimento);
    const valorOriginal = fn.to_number(payload.valor_original, NaN);

    if (!descricao || !vencimento || Number.isNaN(valorOriginal) || valorOriginal <= 0) {
      throw new Error("Informe descricao, vencimento e valor_original validos.");
    }

    const parcelaNumero = Math.max(1, fn.to_int(payload.parcela_numero, 1));
    const parcelaTotal = Math.max(parcelaNumero, fn.to_int(payload.parcela_total, 1));

    return query_one(models.criar_conta_pagar(), [
      payload.empresa_id,
      fn.to_int(payload.categoria_id),
      fn.to_int(payload.centro_custo_id),
      fn.to_int(payload.conta_financeira_id),
      fn.to_int(payload.contraparte_id),
      descricao,
      payload.documento_numero || null,
      payload.competencia || null,
      payload.emissao || null,
      payload.vencimento,
      valorOriginal,
      fn.to_number(payload.desconto, 0),
      fn.to_number(payload.juros, 0),
      fn.to_number(payload.multa, 0),
      String(payload.recorrencia_codigo || "unico").toLowerCase(),
      payload.recorrencia_grupo || null,
      payload.observacao || null,
      payload.anexo_url || null,
      payload.anexo_nome_arquivo || null,
      payload.anexo_mimetype || null,
      fn.to_int(payload.usuario_id || payload.criado_por),
      payload.grupo_parcelamento_id || null,
      parcelaNumero,
      parcelaTotal,
      fn.to_int(payload.empresa_grupo_id),
    ]);
  },

  execute_criar_conta_pagar_parcelado: async (payload) => {
    const descricao = String(payload.descricao || "").trim();
    const vencimentoInicial = fn.to_iso_date_only(payload.vencimento_inicial || payload.vencimento);
    const valorTotal = fn.to_number(payload.valor_total, NaN);
    const qtdParcelas = fn.to_int(payload.quantidade_parcelas, null);

    if (
      !descricao ||
      !vencimentoInicial ||
      Number.isNaN(valorTotal) ||
      valorTotal <= 0 ||
      !qtdParcelas ||
      qtdParcelas < 2
    ) {
      throw new Error(
        "Informe descricao, vencimento_inicial, valor_total e quantidade_parcelas validos."
      );
    }

    const periodicidadeMeses = Math.max(1, fn.to_int(payload.periodicidade_meses, 1));
    const recorrenciaCodigo = String(payload.recorrencia_codigo || "unico").toLowerCase();
    const usuarioId = fn.to_int(payload.usuario_id || payload.criado_por);
    const grupoId = crypto.randomUUID();
    const valoresParcelas = fn.split_installments(valorTotal, qtdParcelas);

    const parcelas = await with_transaction(async (client) => {
      const rows = [];
      for (let i = 0; i < qtdParcelas; i += 1) {
        const vencimento = fn.add_months_to_iso_date(vencimentoInicial, i * periodicidadeMeses);
        const ret = await client.query(models.criar_conta_pagar(), [
          payload.empresa_id,
          fn.to_int(payload.categoria_id),
          fn.to_int(payload.centro_custo_id),
          fn.to_int(payload.conta_financeira_id),
          fn.to_int(payload.contraparte_id),
          descricao,
          payload.documento_numero || null,
          payload.competencia || null,
          payload.emissao || null,
          vencimento,
          valoresParcelas[i],
          fn.to_number(payload.desconto, 0),
          fn.to_number(payload.juros, 0),
          fn.to_number(payload.multa, 0),
          recorrenciaCodigo,
          payload.recorrencia_grupo || null,
          payload.observacao || null,
          payload.anexo_url || null,
          payload.anexo_nome_arquivo || null,
          payload.anexo_mimetype || null,
          usuarioId,
          grupoId,
          i + 1,
          qtdParcelas,
          fn.to_int(payload.empresa_grupo_id),
        ]);
        rows.push(ret.rows[0]);
      }
      return rows;
    });

    return {
      grupo_parcelamento_id: grupoId,
      quantidade_parcelas: qtdParcelas,
      valor_total: valorTotal,
      parcelas,
    };
  },

  execute_listar_contas_pagar: async (payload) => {
    const statusCodigo = String(payload.status_codigo || "").trim().toLowerCase();
    const mesReferencia = fn.to_month_reference(payload.mes_referencia || payload.mes);
    const limit = Math.min(Math.max(fn.to_int(payload.limit, 50), 1), 200);
    const offset = Math.max(fn.to_int(payload.offset, 0), 0);
    const agrupar = fn.to_boolean(payload.agrupar_parcelamento, false);

    return query_rows(agrupar ? models.listar_contas_pagar_agrupado() : models.listar_contas_pagar(), [
      payload.empresa_id,
      statusCodigo,
      mesReferencia,
      limit,
      offset,
      fn.to_int(payload.conta_financeira_id),
      fn.to_int(payload.contraparte_id),
      fn.to_int(payload.empresa_grupo_id),
    ]);
  },

  execute_registrar_pagamento: async (payload) => {
    const contaPagarId = fn.to_int(payload.conta_pagar_id);
    const valor = fn.to_number(payload.valor, NaN);

    if (!contaPagarId || Number.isNaN(valor) || valor <= 0) {
      throw new Error("Informe conta_pagar_id e valor validos.");
    }

    return with_transaction(async (client) => {
      const formaId = fn.to_int(payload.forma_pagamento_id);
      const formaRet = formaId
        ? await client.query(models.obter_forma_pagamento(), [formaId, payload.empresa_id])
        : null;
      if (formaId && !formaRet.rows[0]) throw new Error("Forma de pagamento nao encontrada.");
      const forma = formaRet?.rows[0];
      const taxaPercentual = fn.to_number(forma?.taxa_percentual, 0);
      const taxaFixa = fn.to_number(forma?.taxa_fixa, 0);
      const valorTaxa = Number((valor * taxaPercentual / 100 + taxaFixa).toFixed(2));
      const valorLiquido = Number(Math.max(valor - valorTaxa, 0).toFixed(2));
      const pagamentoRet = await client.query(models.registrar_pagamento(), [
        contaPagarId,
        payload.empresa_id,
        fn.to_int(payload.conta_financeira_id),
        payload.data_pagamento || null,
        valor,
        forma?.nome || payload.meio_pagamento || null,
        payload.referencia_externa || null,
        payload.observacao || null,
        payload.anexo_url || null,
        payload.anexo_nome_arquivo || null,
        payload.anexo_mimetype || null,
        fn.to_int(payload.usuario_id || payload.criado_por),
        formaId, taxaPercentual, taxaFixa, valorTaxa, valorLiquido,
      ]);

      const syncRet = await client.query(models.sincronizar_conta_pagar_por_id(), [
        payload.empresa_id,
        contaPagarId,
      ]);

      if (!syncRet.rowCount) {
        throw new Error("Conta a pagar nao encontrada ou inativa.");
      }

      return pagamentoRet.rows[0] || null;
    });
  },

  execute_deletar_conta_pagar: async (payload) => {
    const contaId = fn.to_int(payload.conta_pagar_id);
    const grupoParcelamentoId = String(payload.grupo_parcelamento_id || "").trim();

    if (!contaId && !grupoParcelamentoId) {
      throw new Error("Informe conta_pagar_id ou grupo_parcelamento_id.");
    }

    const rows = await query_rows(models.deletar_conta_pagar(), [
      payload.empresa_id,
      contaId || null,
      grupoParcelamentoId || null,
    ]);

    if (!rows.length) {
      throw new Error("Nenhuma conta a pagar ativa encontrada para exclusao.");
    }

    return {
      total_afetados: rows.length,
      ids: rows.map((row) => row.id),
    };
  },

  execute_criar_conta_receber: async (payload) => {
    const descricao = String(payload.descricao || "").trim();
    const vencimento = fn.to_date(payload.vencimento);
    const valorOriginal = fn.to_number(payload.valor_original, NaN);

    if (!descricao || !vencimento || Number.isNaN(valorOriginal) || valorOriginal <= 0) {
      throw new Error("Informe descricao, vencimento e valor_original validos.");
    }

    const parcelaNumero = Math.max(1, fn.to_int(payload.parcela_numero, 1));
    const parcelaTotal = Math.max(parcelaNumero, fn.to_int(payload.parcela_total, 1));

    return query_one(models.criar_conta_receber(), [
      payload.empresa_id,
      fn.to_int(payload.cliente_id),
      fn.to_int(payload.comercial_negocio_id),
      fn.to_int(payload.categoria_id),
      fn.to_int(payload.centro_custo_id),
      fn.to_int(payload.conta_financeira_id),
      fn.to_int(payload.contraparte_id),
      descricao,
      payload.documento_numero || null,
      payload.competencia || null,
      payload.emissao || null,
      payload.vencimento,
      valorOriginal,
      fn.to_number(payload.desconto, 0),
      fn.to_number(payload.juros, 0),
      fn.to_number(payload.multa, 0),
      String(payload.recorrencia_codigo || "unico").toLowerCase(),
      payload.recorrencia_grupo || null,
      payload.observacao || null,
      payload.anexo_url || null,
      payload.anexo_nome_arquivo || null,
      payload.anexo_mimetype || null,
      fn.to_int(payload.usuario_id || payload.criado_por),
      payload.grupo_parcelamento_id || null,
      parcelaNumero,
      parcelaTotal,
      fn.to_int(payload.empresa_grupo_id),
    ]);
  },

  execute_sincronizar_recebivel_venda: async (payload, sharedClient = null) => {
    const empresaId = fn.to_int(payload.empresa_id);
    const valor = fn.to_number(payload.valor, NaN);
    const origem = String(payload.origem || "").trim().toLowerCase();
    const referencia = String(payload.referencia || "").trim();
    const descricao = String(payload.descricao || "Venda").trim();
    const dataVenda = fn.to_iso_date_only(payload.data_venda) || fn.to_iso_date_only(new Date());
    const vencimento = fn.to_iso_date_only(payload.vencimento) || dataVenda;

    if (!empresaId || !origem || !referencia || Number.isNaN(valor) || valor <= 0) {
      return { created: false, skipped: true, reason: "dados_incompletos" };
    }

    const syncReceivable = async (client) => {
      const contaRet = await client.query(models.criar_conta_receber_venda_idempotente(), [
        empresaId,
        fn.to_int(payload.cliente_id),
        fn.to_int(payload.comercial_negocio_id),
        descricao,
        `${origem}:${referencia}`,
        dataVenda,
        valor,
        payload.observacao || `Gerado automaticamente pela venda ${origem}.`,
        fn.to_int(payload.usuario_id),
        origem,
        referencia,
        fn.to_int(payload.categoria_id),
        fn.to_int(payload.centro_custo_id),
        fn.to_int(payload.conta_financeira_id),
        fn.to_int(payload.empresa_grupo_id),
        vencimento,
      ]);
      const conta = contaRet.rows?.[0] || null;
      if (!conta) return { created: false, duplicate: true };

      if (fn.to_boolean(payload.recebido, false)) {
        await client.query(models.registrar_recebimento(), [
          conta.id,
          empresaId,
          null,
          payload.data_recebimento || dataVenda,
          valor,
          payload.meio_pagamento || origem,
          `${origem}:${referencia}`,
          `Recebimento automatico confirmado pela ${origem}.`,
          fn.to_int(payload.usuario_id),
        ]);
        await client.query(models.sincronizar_conta_receber_por_id(), [empresaId, conta.id]);
      }

      return { created: true, conta_receber_id: Number(conta.id) };
    };

    if (!sharedClient) return with_transaction(syncReceivable);

    await sharedClient.query("BEGIN");
    try {
      const result = await syncReceivable(sharedClient);
      await sharedClient.query("COMMIT");
      return result;
    } catch (error) {
      await sharedClient.query("ROLLBACK");
      throw error;
    }
  },

  execute_criar_conta_receber_parcelado: async (payload) => {
    const descricao = String(payload.descricao || "").trim();
    const vencimentoInicial = fn.to_iso_date_only(payload.vencimento_inicial || payload.vencimento);
    const valorTotal = fn.to_number(payload.valor_total, NaN);
    const qtdParcelas = fn.to_int(payload.quantidade_parcelas, null);

    if (
      !descricao ||
      !vencimentoInicial ||
      Number.isNaN(valorTotal) ||
      valorTotal <= 0 ||
      !qtdParcelas ||
      qtdParcelas < 2
    ) {
      throw new Error(
        "Informe descricao, vencimento_inicial, valor_total e quantidade_parcelas validos."
      );
    }

    const periodicidadeMeses = Math.max(1, fn.to_int(payload.periodicidade_meses, 1));
    const recorrenciaCodigo = String(payload.recorrencia_codigo || "unico").toLowerCase();
    const usuarioId = fn.to_int(payload.usuario_id || payload.criado_por);
    const grupoId = crypto.randomUUID();
    const valoresParcelas = fn.split_installments(valorTotal, qtdParcelas);

    const parcelas = await with_transaction(async (client) => {
      const rows = [];
      for (let i = 0; i < qtdParcelas; i += 1) {
        const vencimento = fn.add_months_to_iso_date(vencimentoInicial, i * periodicidadeMeses);
        const ret = await client.query(models.criar_conta_receber(), [
          payload.empresa_id,
          fn.to_int(payload.cliente_id),
          fn.to_int(payload.comercial_negocio_id),
          fn.to_int(payload.categoria_id),
          fn.to_int(payload.centro_custo_id),
          fn.to_int(payload.conta_financeira_id),
          fn.to_int(payload.contraparte_id),
          descricao,
          payload.documento_numero || null,
          payload.competencia || null,
          payload.emissao || null,
          vencimento,
          valoresParcelas[i],
          fn.to_number(payload.desconto, 0),
          fn.to_number(payload.juros, 0),
          fn.to_number(payload.multa, 0),
          recorrenciaCodigo,
          payload.recorrencia_grupo || null,
          payload.observacao || null,
          payload.anexo_url || null,
          payload.anexo_nome_arquivo || null,
          payload.anexo_mimetype || null,
          usuarioId,
          grupoId,
          i + 1,
          qtdParcelas,
          fn.to_int(payload.empresa_grupo_id),
        ]);
        rows.push(ret.rows[0]);
      }
      return rows;
    });

    return {
      grupo_parcelamento_id: grupoId,
      quantidade_parcelas: qtdParcelas,
      valor_total: valorTotal,
      parcelas,
    };
  },

  execute_listar_contas_receber: async (payload) => {
    const statusCodigo = String(payload.status_codigo || "").trim().toLowerCase();
    const mesReferencia = fn.to_month_reference(payload.mes_referencia || payload.mes);
    const limit = Math.min(Math.max(fn.to_int(payload.limit, 50), 1), 200);
    const offset = Math.max(fn.to_int(payload.offset, 0), 0);
    const agrupar = fn.to_boolean(payload.agrupar_parcelamento, false);

    return query_rows(
      agrupar ? models.listar_contas_receber_agrupado() : models.listar_contas_receber(),
      [payload.empresa_id, statusCodigo, mesReferencia, limit, offset,
        fn.to_int(payload.conta_financeira_id), fn.to_int(payload.contraparte_id),
        fn.to_int(payload.empresa_grupo_id)]
    );
  },

  execute_registrar_recebimento: async (payload) => {
    const contaReceberId = fn.to_int(payload.conta_receber_id);
    const valor = fn.to_number(payload.valor, NaN);

    if (!contaReceberId || Number.isNaN(valor) || valor <= 0) {
      throw new Error("Informe conta_receber_id e valor validos.");
    }

    return with_transaction(async (client) => {
      const formaId = fn.to_int(payload.forma_pagamento_id);
      const formaRet = formaId
        ? await client.query(models.obter_forma_pagamento(), [formaId, payload.empresa_id])
        : null;
      if (formaId && !formaRet.rows[0]) throw new Error("Forma de pagamento nao encontrada.");
      const forma = formaRet?.rows[0];
      const taxaPercentual = fn.to_number(forma?.taxa_percentual, 0);
      const taxaFixa = fn.to_number(forma?.taxa_fixa, 0);
      const valorTaxa = Number((valor * taxaPercentual / 100 + taxaFixa).toFixed(2));
      const valorLiquido = Number(Math.max(valor - valorTaxa, 0).toFixed(2));
      const recebimentoRet = await client.query(models.registrar_recebimento(), [
        contaReceberId,
        payload.empresa_id,
        fn.to_int(payload.conta_financeira_id),
        payload.data_recebimento || null,
        valor,
        forma?.nome || payload.meio_pagamento || null,
        payload.referencia_externa || null,
        payload.observacao || null,
        fn.to_int(payload.usuario_id || payload.criado_por),
        formaId, taxaPercentual, taxaFixa, valorTaxa, valorLiquido,
      ]);

      const syncRet = await client.query(models.sincronizar_conta_receber_por_id(), [
        payload.empresa_id,
        contaReceberId,
      ]);

      if (!syncRet.rowCount) {
        throw new Error("Conta a receber nao encontrada ou inativa.");
      }

      return recebimentoRet.rows[0] || null;
    });
  },

  execute_deletar_conta_receber: async (payload) => {
    const contaId = fn.to_int(payload.conta_receber_id);
    const grupoParcelamentoId = String(payload.grupo_parcelamento_id || "").trim();

    if (!contaId && !grupoParcelamentoId) {
      throw new Error("Informe conta_receber_id ou grupo_parcelamento_id.");
    }

    const rows = await query_rows(models.deletar_conta_receber(), [
      payload.empresa_id,
      contaId || null,
      grupoParcelamentoId || null,
    ]);

    if (!rows.length) {
      throw new Error("Nenhuma conta a receber ativa encontrada para exclusao.");
    }

    return {
      total_afetados: rows.length,
      ids: rows.map((row) => row.id),
    };
  },

  execute_criar_transferencia: async (payload) => {
    const origemId = fn.to_int(payload.conta_origem_id);
    const destinoId = fn.to_int(payload.conta_destino_id);
    const valor = fn.to_number(payload.valor, NaN);
    if (!origemId || !destinoId || origemId === destinoId || Number.isNaN(valor) || valor <= 0) {
      throw new Error("Informe contas diferentes e valor valido.");
    }
    return with_transaction(async (client) => {
      const userId = fn.to_int(payload.usuario_id || payload.criado_por);
      const ret = await client.query(models.criar_transferencia(), [payload.empresa_id, origemId,
        destinoId, valor, payload.data_transferencia || null, payload.observacao || null,
        payload.anexo_url || null, payload.anexo_nome_arquivo || null,
        payload.anexo_mimetype || null, userId]);
      const transferencia = ret.rows[0];
      if (!transferencia) throw new Error("Conta de origem ou destino nao encontrada.");
      const base = [payload.empresa_id, "saida", transferencia.id, origemId,
        transferencia.data_transferencia, valor, "Transferencia entre contas",
        JSON.stringify({
          transferencia_id: transferencia.id,
          conta_contraparte_id: destinoId,
          anexo_url: transferencia.anexo_url || null,
          anexo_nome_arquivo: transferencia.anexo_nome_arquivo || null,
        }), userId];
      await client.query(models.criar_lancamento_transferencia(), base);
      await client.query(models.criar_lancamento_transferencia(), [payload.empresa_id, "entrada",
        transferencia.id, destinoId, transferencia.data_transferencia, valor,
        "Transferencia entre contas",
        JSON.stringify({
          transferencia_id: transferencia.id,
          conta_contraparte_id: origemId,
          anexo_url: transferencia.anexo_url || null,
          anexo_nome_arquivo: transferencia.anexo_nome_arquivo || null,
        }), userId]);
      return transferencia;
    });
  },

  execute_listar_lancamentos: async (payload) => {
    const limit = Math.min(Math.max(fn.to_int(payload.limit, 100), 1), 500);
    const offset = Math.max(fn.to_int(payload.offset, 0), 0);

    return query_rows(models.listar_lancamentos(), [
      payload.empresa_id,
      payload.data_inicio || null,
      payload.data_fim || null,
      String(payload.natureza_codigo || "").trim().toLowerCase(),
      limit,
      offset,
    ]);
  },

  execute_deletar_lancamento: async (payload) => {
    const lancamentoId = fn.to_int(payload.lancamento_id);

    if (!lancamentoId) {
      throw new Error("Informe lancamento_id valido.");
    }

    const row = await query_one(models.deletar_lancamento(), [payload.empresa_id, lancamentoId]);

    if (!row) {
      throw new Error("Lancamento nao encontrado ou ja inativo.");
    }

    return row;
  },

  execute_salvar_meta_usuario: async (payload) => {
    const usuarioId = fn.to_int(payload.usuario_id);
    const mesReferencia = payload.mes_referencia;

    if (!usuarioId || !mesReferencia) {
      throw new Error("Informe usuario_id e mes_referencia (YYYY-MM-01).");
    }

    return query_one(models.salvar_meta_usuario(), [
      payload.empresa_id,
      usuarioId,
      mesReferencia,
      fn.to_number(payload.valor_meta, 0),
      fn.to_number(payload.percentual_comissao, 0),
      fn.to_number(payload.valor_comissao_fixa, 0),
    ]);
  },

  execute_finalizar_meta_usuario: async (payload) => {
    const usuarioId = fn.to_int(payload.usuario_id);
    const mesReferencia = fn.to_month_reference(payload.mes_referencia || payload.mes);
    const mesAtual = get_current_month_reference();
    const usuarioExecutorId =
      fn.to_int(payload.usuario_executor_id) ||
      fn.to_int(payload.usuario_id_executor) ||
      fn.to_int(payload.criado_por) ||
      usuarioId;

    if (!usuarioId || !mesReferencia) {
      throw new Error("Informe usuario_id e mes_referencia (YYYY-MM).");
    }

    if (mesReferencia >= mesAtual) {
      throw new Error("A meta so pode ser finalizada apos o encerramento do mes.");
    }

    return with_transaction(async (client) => {
      const metaRet = await client.query(models.obter_meta_para_finalizacao(), [
        payload.empresa_id,
        usuarioId,
        mesReferencia,
      ]);
      const meta = metaRet.rows[0];

      if (!meta) {
        throw new Error("Meta nao encontrada para este usuario e mes.");
      }

      const comissaoExistenteRet = await client.query(models.existe_comissao_usuario_mes(), [
        payload.empresa_id,
        usuarioId,
        mesReferencia,
      ]);
      if (comissaoExistenteRet.rows[0]) {
        throw new Error("Esta meta ja possui comissao lancada no mes informado.");
      }

      const baseCalculo = fn.to_number(meta.valor_realizado_crm, 0);
      const percentualAplicado = fn.to_number(meta.percentual_comissao, 0);
      const valorComissaoFixa = fn.to_number(meta.valor_comissao_fixa, 0);
      const valorComissao = Number(
        (((baseCalculo * percentualAplicado) / 100) + valorComissaoFixa).toFixed(2)
      );

      if (Number.isNaN(valorComissao) || valorComissao <= 0) {
        throw new Error("A comissao calculada ficou zerada. Ajuste percentual/fixo da meta.");
      }

      const competencia = `${mesReferencia}-01`;
      const marcadorMeta = `FINALIZACAO_META:${meta.meta_id}:${mesReferencia}`;
      const observacaoComissaoManual = String(payload.observacao || "").trim();
      const observacaoComissao = observacaoComissaoManual
        ? `${marcadorMeta} | ${observacaoComissaoManual}`
        : marcadorMeta;

      const comissaoRet = await client.query(models.lancar_comissao(), [
        payload.empresa_id,
        usuarioId,
        baseCalculo,
        percentualAplicado,
        valorComissao,
        observacaoComissao,
        competencia,
      ]);
      const comissao = comissaoRet.rows[0];

      const categoriaRet = await client.query(models.buscar_categoria_comissao_padrao(), [
        payload.empresa_id,
      ]);
      const categoriaId = categoriaRet.rows[0]?.id || null;

      const hoje = fn.to_iso_date_only(new Date());
      const descricaoConta = `Comissao ${mesReferencia} - ${meta.usuario_nome || `Usuario ${usuarioId}`}`;
      const documentoNumero = `COM-META-${usuarioId}-${mesReferencia}`;
      const observacaoConta = [
        `Gerado automaticamente pela finalizacao da meta ${mesReferencia}.`,
        `Comissao_lancamento_id: ${comissao.id}.`,
      ].join(" ");

      const contaRet = await client.query(models.criar_conta_pagar(), [
        payload.empresa_id,
        categoriaId,
        null,
        null,
        null,
        descricaoConta,
        documentoNumero,
        competencia,
        hoje,
        hoje,
        valorComissao,
        0,
        0,
        0,
        "unico",
        null,
        observacaoConta,
        null,
        null,
        null,
        usuarioExecutorId,
        null,
        1,
        1,
        null,
      ]);
      const contaPagar = contaRet.rows[0];

      return {
        meta: {
          id: meta.meta_id,
          usuario_id: meta.usuario_id,
          mes_referencia: meta.mes_referencia,
          valor_meta: meta.valor_meta,
          valor_realizado_crm: meta.valor_realizado_crm,
          percentual_comissao: meta.percentual_comissao,
          valor_comissao_fixa: meta.valor_comissao_fixa,
        },
        comissao_lancamento: comissao,
        conta_pagar: contaPagar,
        resumo: {
          base_calculo: baseCalculo,
          percentual_aplicado: percentualAplicado,
          valor_comissao: valorComissao,
        },
      };
    });
  },

  execute_lancar_comissao: async (payload) => {
    const usuarioId = fn.to_int(payload.usuario_id);
    const baseCalculo = fn.to_number(payload.base_calculo, NaN);
    const percentual = fn.to_number(payload.percentual_aplicado, 0);
    const mesReferencia = fn.to_month_reference(
      payload.mes_referencia ||
        payload.mes ||
        (typeof payload.competencia === "string" ? payload.competencia.slice(0, 7) : "")
    );
    const competencia = mesReferencia ? `${mesReferencia}-01` : null;
    const valorComissao =
      payload.valor_comissao !== undefined
        ? fn.to_number(payload.valor_comissao, NaN)
        : Number((baseCalculo * percentual) / 100);

    if (!usuarioId || Number.isNaN(baseCalculo) || Number.isNaN(valorComissao)) {
      throw new Error("Informe usuario_id, base_calculo e percentual/valor validos.");
    }

    return query_one(models.lancar_comissao(), [
      payload.empresa_id,
      usuarioId,
      baseCalculo,
      percentual,
      valorComissao,
      payload.observacao || null,
      competencia,
    ]);
  },

  execute_listar_metas_mes: async (payload) => {
    const mesReferencia =
      fn.to_month_reference(payload.mes_referencia || payload.mes) || get_current_month_reference();

    return query_rows(models.listar_metas_mes(), [payload.empresa_id, mesReferencia]);
  },

  execute_listar_comissoes_lancadas_mes: async (payload) => {
    const mesReferencia =
      fn.to_month_reference(payload.mes_referencia || payload.mes) || get_current_month_reference();

    return query_rows(models.listar_comissoes_lancadas_mes(), [payload.empresa_id, mesReferencia]);
  },

  execute_listar_alertas: async (payload) => {
    return query_rows(models.listar_alertas(), [
      payload.empresa_id,
      String(payload.status_codigo || "").trim().toLowerCase(),
    ]);
  },

  execute_marcar_alerta_lido: async (payload) => {
    const alertaId = fn.to_int(payload.alerta_id);
    const usuarioId = fn.to_int(payload.usuario_id);

    if (!alertaId || !usuarioId) {
      throw new Error("Informe alerta_id e usuario_id.");
    }

    return query_one(models.marcar_alerta_lido(), [
      alertaId,
      payload.empresa_id,
      usuarioId,
    ]);
  },

  execute_dashboard: async (empresaId) => {
    const client = await postgres.connect();
    try {
      const dre = await client.query(models.dashboard_dre(), [empresaId]);
      const fluxo = await client.query(models.dashboard_fluxo(), [empresaId]);
      const inad = await client.query(models.dashboard_inadimplencia(), [empresaId]);
      const mensalidadesAtivas = await client.query(
        models.dashboard_mensalidades_ativas(),
        [empresaId]
      );
      const crm = await client.query(models.dashboard_crm(), [empresaId]);
      const resumo = await client.query(models.dashboard_resumo_operacional(), [empresaId]);
      const proximos = await client.query(models.dashboard_proximos_vencimentos(), [empresaId]);

      return {
        dre_mensal: dre.rows || [],
        fluxo_30_dias: fluxo.rows || [],
        inadimplencia: inad.rows?.[0] || {},
        mensalidades_ativas: mensalidadesAtivas.rows?.[0] || {},
        previsao_crm: crm.rows || [],
        resumo_operacional: resumo.rows?.[0] || {},
        proximos_vencimentos: proximos.rows || [],
      };
    } finally {
      client.release();
    }
  },

  execute_sincronizar_alertas_todas_empresas: async (sharedClient = null) => {
    const client = sharedClient || (await postgres.connect());
    try {
      const empresasRet = await client.query(models.listar_empresas_com_financeiro_ativo());
      let processadas = 0;
      for (const row of empresasRet.rows || []) {
        await sync_financeiro_alertas_empresa(row.empresa_id, client);
        processadas += 1;
      }
      return { empresas_processadas: processadas };
    } finally {
      if (!sharedClient) client.release();
    }
  },

  execute_listar_assinaturas_empresa: async (payload) => {
    const status = String(payload.status || "")
      .trim()
      .toLowerCase();

    return query_rows(models.listar_assinaturas_empresa(), [payload.empresa_id, status]);
  },

  execute_criar_assinatura_empresa: async (payload) => {
    const nome = String(payload.nome || "").trim();
    const fornecedor = String(payload.fornecedor || "").trim();
    const plano = String(payload.plano || "").trim();
    const valor = fn.to_number(payload.valor, NaN);
    const ciclo = String(payload.ciclo_cobranca || "mensal")
      .trim()
      .toLowerCase();
    const diaVencimento = fn.to_int(payload.dia_vencimento);
    const proximoVencimento = payload.proximo_vencimento || null;

    if (!nome || !fornecedor || Number.isNaN(valor) || valor < 0) {
      throw new Error("Informe nome, fornecedor e valor validos.");
    }

    if (!CICLOS_ASSINATURA_VALIDOS.has(ciclo)) {
      throw new Error("Informe um ciclo_cobranca valido.");
    }

    if (diaVencimento !== null && (diaVencimento < 1 || diaVencimento > 31)) {
      throw new Error("dia_vencimento deve estar entre 1 e 31.");
    }

    return query_one(models.criar_assinatura_empresa(), [
      payload.empresa_id,
      nome,
      fornecedor,
      plano || null,
      valor,
      ciclo,
      diaVencimento,
      proximoVencimento,
      fn.to_int(payload.categoria_id),
      fn.to_int(payload.conta_financeira_id),
      payload.observacao || null,
      payload.ativo,
      fn.to_int(payload.usuario_id || payload.criado_por),
    ]);
  },

  execute_editar_assinatura_empresa: async (payload) => {
    const assinaturaId = fn.to_int(payload.assinatura_id || payload.id);
    if (!assinaturaId) {
      throw new Error("Informe assinatura_id valido.");
    }

    const nome =
      payload.nome !== undefined ? String(payload.nome || "").trim() : null;
    const fornecedor =
      payload.fornecedor !== undefined ? String(payload.fornecedor || "").trim() : null;
    const plano = payload.plano !== undefined ? String(payload.plano || "").trim() : null;
    const valor =
      payload.valor !== undefined ? fn.to_number(payload.valor, NaN) : null;
    const ciclo =
      payload.ciclo_cobranca !== undefined
        ? String(payload.ciclo_cobranca || "")
            .trim()
            .toLowerCase()
        : null;
    const diaVencimento =
      payload.dia_vencimento !== undefined ? fn.to_int(payload.dia_vencimento) : null;
    const proximoVencimento =
      payload.proximo_vencimento !== undefined ? payload.proximo_vencimento : null;
    const ativo =
      payload.ativo !== undefined ? fn.to_boolean(payload.ativo, true) : null;

    if (nome !== null && !nome) {
      throw new Error("Informe nome valido.");
    }
    if (fornecedor !== null && !fornecedor) {
      throw new Error("Informe fornecedor valido.");
    }
    if (valor !== null && (Number.isNaN(valor) || valor < 0)) {
      throw new Error("Informe valor valido.");
    }
    if (ciclo !== null && !CICLOS_ASSINATURA_VALIDOS.has(ciclo)) {
      throw new Error("Informe um ciclo_cobranca valido.");
    }
    if (diaVencimento !== null && diaVencimento !== undefined && (diaVencimento < 1 || diaVencimento > 31)) {
      throw new Error("dia_vencimento deve estar entre 1 e 31.");
    }

    const row = await query_one(models.editar_assinatura_empresa(), [
      assinaturaId,
      payload.empresa_id,
      nome,
      fornecedor,
      plano,
      valor,
      ciclo,
      diaVencimento,
      proximoVencimento,
      payload.categoria_id !== undefined ? fn.to_int(payload.categoria_id) : null,
      payload.conta_financeira_id !== undefined ? fn.to_int(payload.conta_financeira_id) : null,
      payload.observacao !== undefined ? payload.observacao || null : null,
      ativo,
    ]);

    if (!row) {
      throw new Error("Assinatura nao encontrada para esta empresa.");
    }

    return row;
  },

  execute_inativar_assinatura_empresa: async (payload) => {
    const assinaturaId = fn.to_int(payload.assinatura_id || payload.id);
    if (!assinaturaId) {
      throw new Error("Informe assinatura_id valido.");
    }

    const row = await query_one(models.inativar_assinatura_empresa(), [
      assinaturaId,
      payload.empresa_id,
    ]);

    if (!row) {
      throw new Error("Assinatura nao encontrada para esta empresa.");
    }

    return row;
  },

  execute_listar_assinaturas_cobrancas: async (payload) => {
    const limit = Math.min(Math.max(fn.to_int(payload.limit, 100), 1), 500);
    return query_rows(models.listar_assinaturas_cobrancas(), [payload.empresa_id, limit]);
  },

  execute_healthcheck: async (empresaId) => {
    return with_transaction(async (client) => {
      const [c1, c2, c3] = await Promise.all([
        client.query(models.health_contas_pagar(), [empresaId]),
        client.query(models.health_contas_receber(), [empresaId]),
        client.query(models.health_lancamentos(), [empresaId]),
      ]);

      return {
        contas_pagar: c1.rows[0]?.total || 0,
        contas_receber: c2.rows[0]?.total || 0,
        lancamentos: c3.rows[0]?.total || 0,
      };
    });
  },
};

module.exports = execute;
