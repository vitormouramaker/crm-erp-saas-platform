const models = {
  listar_dominios: () => {
    return `
      SELECT 'status_titulo' AS dominio, id, codigo, nome FROM financeiro_status_titulo_tipo
      UNION ALL
      SELECT 'status_lancamento' AS dominio, id, codigo, nome FROM financeiro_status_lancamento_tipo
      UNION ALL
      SELECT 'natureza_lancamento' AS dominio, id, codigo, nome FROM financeiro_natureza_lancamento_tipo
      UNION ALL
      SELECT 'origem_lancamento' AS dominio, id, codigo, nome FROM financeiro_origem_lancamento_tipo
      UNION ALL
      SELECT 'recorrencia' AS dominio, id, codigo, nome FROM financeiro_recorrencia_tipo
      UNION ALL
      SELECT 'categoria_tipo' AS dominio, id, codigo, nome FROM financeiro_categoria_tipo
      UNION ALL
      SELECT 'alerta_tipo' AS dominio, id, codigo, nome FROM financeiro_alerta_tipo
      UNION ALL
      SELECT 'alerta_status' AS dominio, id, codigo, nome FROM financeiro_alerta_status_tipo
      ORDER BY dominio, id
    `;
  },

  listar_categorias: () => {
    return `
      SELECT
        c.id,
        c.nome,
        c.categoria_pai_id,
        c.ativo,
        c.created_at,
        c.updated_at,
        ct.id AS tipo_id,
        ct.codigo AS tipo_codigo,
        ct.nome AS tipo_nome
      FROM financeiro_categoria c
      INNER JOIN financeiro_categoria_tipo ct ON ct.id = c.tipo_id
      WHERE c.empresa_id = $1
      ORDER BY c.nome ASC
    `;
  },

  criar_categoria: () => {
    return `
      INSERT INTO financeiro_categoria (
        empresa_id,
        nome,
        tipo_id,
        categoria_pai_id,
        ativo
      ) VALUES (
        $1,
        $2,
        fn_fin_tipo_categoria_id($3),
        $4,
        true
      )
      RETURNING id, nome, tipo_id, categoria_pai_id, ativo
    `;
  },

  listar_centros_custo: () => `
    SELECT id, empresa_id, codigo, nome, descricao, ativo, created_at, updated_at
    FROM financeiro_centro_custo
    WHERE empresa_id = $1 AND ($2::boolean = true OR ativo = true)
    ORDER BY ativo DESC, nome ASC
  `,

  salvar_centro_custo: () => `
    INSERT INTO financeiro_centro_custo (empresa_id, codigo, nome, descricao, ativo)
    VALUES ($1, $2, $3, $4, true)
    RETURNING *
  `,

  editar_centro_custo: () => `
    UPDATE financeiro_centro_custo
    SET codigo = $3, nome = $4, descricao = $5, ativo = COALESCE($6, ativo), updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND empresa_id = $2
    RETURNING *
  `,

  listar_contas_financeiras: () => `
    SELECT
      cf.*,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', eg.id, 'nome', eg.nome) ORDER BY eg.nome)
        FROM financeiro_conta_financeira_empresa_grupo cfe
        INNER JOIN financeiro_empresa_grupo eg ON eg.id = cfe.empresa_grupo_id AND eg.ativo = true
        WHERE cfe.empresa_id = cf.empresa_id AND cfe.conta_financeira_id = cf.id
      ), '[]'::jsonb) AS empresas_grupo,
      (COALESCE(cf.saldo_inicial, 0) + COALESCE((
        SELECT SUM(CASE WHEN n.codigo = 'entrada' THEN l.valor ELSE -l.valor END)
        FROM financeiro_lancamento l
        INNER JOIN financeiro_natureza_lancamento_tipo n ON n.id = l.natureza_id
        INNER JOIN financeiro_status_lancamento_tipo s ON s.id = l.status_id
        WHERE l.empresa_id = cf.empresa_id
          AND l.conta_financeira_id = cf.id
          AND l.ativo = true
          AND s.codigo = 'realizado'
      ), 0))::numeric(14,2) AS saldo_atual
    FROM financeiro_conta_financeira cf
    WHERE cf.empresa_id = $1 AND ($2::boolean = true OR cf.ativo = true)
    ORDER BY cf.ativo DESC, cf.nome ASC
  `,

  salvar_conta_financeira: () => `
    INSERT INTO financeiro_conta_financeira
      (empresa_id, nome, tipo, banco, agencia, conta, pix_chave, saldo_inicial, ativo)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
    RETURNING *
  `,

  editar_conta_financeira: () => `
    UPDATE financeiro_conta_financeira
    SET nome=$3, tipo=$4, banco=$5, agencia=$6, conta=$7, pix_chave=$8,
        saldo_inicial=$9, ativo=COALESCE($10, ativo), updated_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND empresa_id=$2
    RETURNING *
  `,

  substituir_empresas_conta: () => `
    WITH removidos AS (
      DELETE FROM financeiro_conta_financeira_empresa_grupo
      WHERE empresa_id = $1 AND conta_financeira_id = $2
    )
    INSERT INTO financeiro_conta_financeira_empresa_grupo
      (empresa_id, conta_financeira_id, empresa_grupo_id)
    SELECT $1, $2, eg.id
    FROM financeiro_empresa_grupo eg
    WHERE eg.empresa_id = $1 AND eg.ativo = true AND eg.id = ANY($3::bigint[])
    ON CONFLICT DO NOTHING
  `,

  listar_contrapartes: () => `
    SELECT id, empresa_id, nome, documento, cpf, cnpj, email, telefone, endereco, cep, uf, cidade,
           tipo, ativo, created_at, updated_at
    FROM financeiro_contraparte
    WHERE empresa_id = $1 AND ($2::boolean = true OR ativo = true)
    ORDER BY ativo DESC, nome ASC
  `,

  salvar_contraparte: () => `
    INSERT INTO financeiro_contraparte
      (empresa_id, nome, documento, cpf, cnpj, email, telefone, endereco, cep, uf, cidade, tipo, ativo)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
    RETURNING *
  `,

  editar_contraparte: () => `
    UPDATE financeiro_contraparte
    SET nome=$3, documento=$4, cpf=$5, cnpj=$6, email=$7, telefone=$8,
        endereco=$9, cep=$10, uf=$11, cidade=$12, tipo=$13,
        ativo=COALESCE($14, ativo), updated_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND empresa_id=$2
    RETURNING *
  `,

  listar_empresas_grupo: () => `
    SELECT * FROM financeiro_empresa_grupo
    WHERE empresa_id=$1 AND ($2::boolean=true OR ativo=true)
    ORDER BY ativo DESC, nome
  `,
  salvar_empresa_grupo: () => `
    INSERT INTO financeiro_empresa_grupo
      (empresa_id,nome,razao_social,cnpj,email,telefone,endereco,cep,uf,cidade,ativo)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) RETURNING *
  `,
  editar_empresa_grupo: () => `
    UPDATE financeiro_empresa_grupo SET nome=$3,razao_social=$4,cnpj=$5,email=$6,telefone=$7,
      endereco=$8,cep=$9,uf=$10,cidade=$11,ativo=COALESCE($12,ativo),updated_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND empresa_id=$2 RETURNING *
  `,
  listar_formas_pagamento: () => `
    SELECT * FROM financeiro_forma_pagamento
    WHERE empresa_id=$1 AND ($2::boolean=true OR ativo=true)
    ORDER BY ativo DESC, nome
  `,
  salvar_forma_pagamento: () => `
    INSERT INTO financeiro_forma_pagamento (empresa_id,nome,taxa_percentual,taxa_fixa,ativo)
    VALUES ($1,$2,$3,$4,true) RETURNING *
  `,
  editar_forma_pagamento: () => `
    UPDATE financeiro_forma_pagamento SET nome=$3,taxa_percentual=$4,taxa_fixa=$5,
      ativo=COALESCE($6,ativo),updated_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND empresa_id=$2 RETURNING *
  `,
  obter_forma_pagamento: () => `
    SELECT * FROM financeiro_forma_pagamento WHERE id=$1 AND empresa_id=$2 AND ativo=true
  `,

  criar_conta_pagar: () => {
    return `
      INSERT INTO financeiro_conta_pagar (
        empresa_id, categoria_id, centro_custo_id, conta_financeira_id, contraparte_id,
        descricao, documento_numero, competencia, emissao, vencimento,
        valor_original, desconto, juros, multa, recorrencia_id, recorrencia_grupo,
        status_id, observacao, anexo_url, anexo_nome_arquivo, anexo_mimetype,
        criado_por, grupo_parcelamento_id, parcela_numero, parcela_total, empresa_grupo_id
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, COALESCE($9, CURRENT_DATE), $10,
        $11, COALESCE($12,0), COALESCE($13,0), COALESCE($14,0), fn_fin_tipo_recorrencia_id($15), $16,
        fn_fin_status_titulo_id('aberto'), $17, $18, $19, $20, $21, $22, $23, $24,
        (SELECT id FROM financeiro_empresa_grupo WHERE id=$25 AND empresa_id=$1 AND ativo=true)
      )
      RETURNING *
    `;
  },

  listar_contas_pagar: () => {
    return `
      SELECT
        cp.*,
        st.codigo AS status_codigo,
        st.nome AS status_nome,
        rt.codigo AS recorrencia_codigo,
        c.nome AS categoria_nome,
        cc.nome AS centro_custo_nome,
        cf.nome AS conta_financeira_nome,
        ct.nome AS contraparte_nome,
        eg.nome AS empresa_grupo_nome,
        COALESCE((SELECT SUM(pp.valor_taxa) FROM financeiro_pagamento_pagar pp WHERE pp.conta_pagar_id=cp.id AND pp.ativo=true),0)::numeric(14,2) AS taxa_acumulada,
        COALESCE((SELECT SUM(pp.valor_liquido) FROM financeiro_pagamento_pagar pp WHERE pp.conta_pagar_id=cp.id AND pp.ativo=true),0)::numeric(14,2) AS valor_liquido_acumulado,
        upp.anexo_url AS ultimo_pagamento_anexo_url,
        upp.anexo_nome_arquivo AS ultimo_pagamento_anexo_nome_arquivo,
        upp.anexo_mimetype AS ultimo_pagamento_anexo_mimetype,
        GREATEST((cp.valor_original - cp.desconto + cp.juros + cp.multa) - cp.valor_pago_acumulado, 0)::numeric(14,2) AS valor_em_aberto
      FROM financeiro_conta_pagar cp
      INNER JOIN financeiro_status_titulo_tipo st ON st.id = cp.status_id
      INNER JOIN financeiro_recorrencia_tipo rt ON rt.id = cp.recorrencia_id
      LEFT JOIN financeiro_categoria c ON c.id = cp.categoria_id
      LEFT JOIN financeiro_centro_custo cc ON cc.id = cp.centro_custo_id
      LEFT JOIN financeiro_conta_financeira cf ON cf.id = cp.conta_financeira_id
      LEFT JOIN financeiro_contraparte ct ON ct.id = cp.contraparte_id
      LEFT JOIN financeiro_empresa_grupo eg ON eg.id = cp.empresa_grupo_id
      LEFT JOIN LATERAL (
        SELECT
          pp.anexo_url,
          pp.anexo_nome_arquivo,
          pp.anexo_mimetype
        FROM financeiro_pagamento_pagar pp
        WHERE pp.conta_pagar_id = cp.id
          AND pp.empresa_id = cp.empresa_id
          AND pp.ativo = true
          AND pp.anexo_url IS NOT NULL
        ORDER BY pp.data_pagamento DESC, pp.id DESC
        LIMIT 1
      ) upp ON true
      WHERE cp.empresa_id = $1
        AND cp.ativo = true
        AND ($2 = '' OR st.codigo = $2)
        AND ($3::text IS NULL OR TO_CHAR(cp.vencimento, 'YYYY-MM') = $3::text)
        AND ($6::bigint IS NULL OR cp.conta_financeira_id = $6)
        AND ($7::bigint IS NULL OR cp.contraparte_id = $7)
        AND ($8::bigint IS NULL OR cp.empresa_grupo_id = $8)
      ORDER BY cp.vencimento ASC, cp.id DESC
      LIMIT $4 OFFSET $5
    `;
  },

  sincronizar_contas_pagar_empresa: () => {
    return `
      WITH calc AS (
        SELECT
          cp.id,
          cp.status_id AS status_atual_id,
          cp.vencimento,
          GREATEST((cp.valor_original - cp.desconto + cp.juros + cp.multa), 0)::numeric(14,2) AS valor_total_titulo,
          COALESCE((
            SELECT SUM(pp.valor)
            FROM financeiro_pagamento_pagar pp
            WHERE pp.empresa_id = cp.empresa_id
              AND pp.conta_pagar_id = cp.id
              AND pp.ativo = true
          ), 0)::numeric(14,2) AS valor_pago
        FROM financeiro_conta_pagar cp
        WHERE cp.empresa_id = $1
          AND cp.ativo = true
      ),
      calc_status AS (
        SELECT
          id,
          valor_pago,
          CASE
            WHEN status_atual_id = fn_fin_status_titulo_id('cancelado') THEN status_atual_id
            WHEN valor_total_titulo > 0 AND valor_pago >= valor_total_titulo
              THEN fn_fin_status_titulo_id('pago')
            WHEN valor_pago > 0
              THEN fn_fin_status_titulo_id('parcial')
            WHEN vencimento < CURRENT_DATE
              THEN fn_fin_status_titulo_id('vencido')
            ELSE fn_fin_status_titulo_id('aberto')
          END AS novo_status_id
        FROM calc
      )
      UPDATE financeiro_conta_pagar cp
      SET
        valor_pago_acumulado = cs.valor_pago,
        status_id = cs.novo_status_id,
        updated_at = CURRENT_TIMESTAMP
      FROM calc_status cs
      WHERE cp.id = cs.id
        AND (
          cp.valor_pago_acumulado IS DISTINCT FROM cs.valor_pago
          OR cp.status_id IS DISTINCT FROM cs.novo_status_id
        )
    `;
  },

  sincronizar_conta_pagar_por_id: () => {
    return `
      WITH calc AS (
        SELECT
          cp.id,
          cp.status_id AS status_atual_id,
          cp.vencimento,
          GREATEST((cp.valor_original - cp.desconto + cp.juros + cp.multa), 0)::numeric(14,2) AS valor_total_titulo,
          COALESCE((
            SELECT SUM(pp.valor)
            FROM financeiro_pagamento_pagar pp
            WHERE pp.empresa_id = cp.empresa_id
              AND pp.conta_pagar_id = cp.id
              AND pp.ativo = true
          ), 0)::numeric(14,2) AS valor_pago
        FROM financeiro_conta_pagar cp
        WHERE cp.empresa_id = $1
          AND cp.id = $2
          AND cp.ativo = true
      ),
      calc_status AS (
        SELECT
          id,
          valor_pago,
          CASE
            WHEN status_atual_id = fn_fin_status_titulo_id('cancelado') THEN status_atual_id
            WHEN valor_total_titulo > 0 AND valor_pago >= valor_total_titulo
              THEN fn_fin_status_titulo_id('pago')
            WHEN valor_pago > 0
              THEN fn_fin_status_titulo_id('parcial')
            WHEN vencimento < CURRENT_DATE
              THEN fn_fin_status_titulo_id('vencido')
            ELSE fn_fin_status_titulo_id('aberto')
          END AS novo_status_id
        FROM calc
      )
      UPDATE financeiro_conta_pagar cp
      SET
        valor_pago_acumulado = cs.valor_pago,
        status_id = cs.novo_status_id,
        updated_at = CURRENT_TIMESTAMP
      FROM calc_status cs
      WHERE cp.id = cs.id
      RETURNING cp.*
    `;
  },

  listar_contas_pagar_agrupado: () => {
    return `
      SELECT
        COALESCE(cp.grupo_parcelamento_id::text, cp.id::text) AS grupo_parcelamento_id,
        MIN(cp.descricao) AS descricao,
        COUNT(*)::int AS total_parcelas,
        SUM(cp.valor_original)::numeric(14,2) AS valor_total,
        SUM(GREATEST((cp.valor_original - cp.desconto + cp.juros + cp.multa) - cp.valor_pago_acumulado, 0))::numeric(14,2) AS valor_em_aberto_total,
        MIN(cp.vencimento) AS primeiro_vencimento,
        MAX(cp.vencimento) AS ultimo_vencimento,
        json_agg(
          json_build_object(
            'id', cp.id,
            'parcela_numero', cp.parcela_numero,
            'parcela_total', cp.parcela_total,
            'valor_original', cp.valor_original,
            'valor_em_aberto', GREATEST((cp.valor_original - cp.desconto + cp.juros + cp.multa) - cp.valor_pago_acumulado, 0),
            'vencimento', cp.vencimento,
            'status_codigo', st.codigo,
            'status_nome', st.nome,
            'anexo_url', cp.anexo_url,
            'anexo_nome_arquivo', cp.anexo_nome_arquivo,
            'anexo_mimetype', cp.anexo_mimetype,
            'ultimo_pagamento_anexo_url', upp.anexo_url,
            'ultimo_pagamento_anexo_nome_arquivo', upp.anexo_nome_arquivo,
            'ultimo_pagamento_anexo_mimetype', upp.anexo_mimetype
          )
          ORDER BY cp.parcela_numero ASC, cp.vencimento ASC
        ) AS parcelas
      FROM financeiro_conta_pagar cp
      INNER JOIN financeiro_status_titulo_tipo st ON st.id = cp.status_id
      LEFT JOIN LATERAL (
        SELECT
          pp.anexo_url,
          pp.anexo_nome_arquivo,
          pp.anexo_mimetype
        FROM financeiro_pagamento_pagar pp
        WHERE pp.conta_pagar_id = cp.id
          AND pp.empresa_id = cp.empresa_id
          AND pp.ativo = true
          AND pp.anexo_url IS NOT NULL
        ORDER BY pp.data_pagamento DESC, pp.id DESC
        LIMIT 1
      ) upp ON true
      WHERE cp.empresa_id = $1
        AND cp.ativo = true
        AND ($2 = '' OR st.codigo = $2)
        AND ($3::text IS NULL OR TO_CHAR(cp.vencimento, 'YYYY-MM') = $3::text)
        AND ($6::bigint IS NULL OR cp.conta_financeira_id = $6)
        AND ($7::bigint IS NULL OR cp.contraparte_id = $7)
        AND ($8::bigint IS NULL OR cp.empresa_grupo_id = $8)
      GROUP BY COALESCE(cp.grupo_parcelamento_id::text, cp.id::text)
      ORDER BY MIN(cp.vencimento) ASC
      LIMIT $4 OFFSET $5
    `;
  },

  registrar_pagamento: () => {
    return `
      INSERT INTO financeiro_pagamento_pagar (
        conta_pagar_id, empresa_id, conta_financeira_id, data_pagamento,
        valor, meio_pagamento, referencia_externa, observacao,
        anexo_url, anexo_nome_arquivo, anexo_mimetype, ativo, criado_por,
        forma_pagamento_id, taxa_percentual, taxa_fixa, valor_taxa, valor_liquido
      )
      VALUES ($1,$2,$3,COALESCE($4,CURRENT_TIMESTAMP),$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `;
  },

  deletar_conta_pagar: () => {
    return `
      UPDATE financeiro_conta_pagar
      SET
        ativo = false,
        status_id = fn_fin_status_titulo_id('cancelado'),
        updated_at = CURRENT_TIMESTAMP
      WHERE empresa_id = $1
        AND ativo = true
        AND (
          ($2::bigint IS NOT NULL AND id = $2::bigint)
          OR
          ($3::text IS NOT NULL AND COALESCE(grupo_parcelamento_id::text, id::text) = $3::text)
        )
      RETURNING id, grupo_parcelamento_id
    `;
  },

  criar_conta_receber: () => {
    return `
      INSERT INTO financeiro_conta_receber (
        empresa_id, cliente_id, comercial_negocio_id, categoria_id, centro_custo_id,
        conta_financeira_id, contraparte_id, descricao, documento_numero, competencia,
        emissao, vencimento, valor_original, desconto, juros, multa,
        recorrencia_id, recorrencia_grupo, status_id, observacao, anexo_url, anexo_nome_arquivo, anexo_mimetype, criado_por,
        grupo_parcelamento_id, parcela_numero, parcela_total, empresa_grupo_id
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        COALESCE($11, CURRENT_DATE), $12, $13, COALESCE($14,0), COALESCE($15,0), COALESCE($16,0),
        fn_fin_tipo_recorrencia_id($17), $18, fn_fin_status_titulo_id('aberto'), $19, $20, $21, $22, $23,
        $24, $25, $26,
        (SELECT id FROM financeiro_empresa_grupo WHERE id=$27 AND empresa_id=$1 AND ativo=true)
      )
      RETURNING *
    `;
  },

  criar_conta_receber_venda_idempotente: () => {
    return `
      INSERT INTO financeiro_conta_receber (
        empresa_id, cliente_id, comercial_negocio_id, categoria_id, centro_custo_id,
        conta_financeira_id, empresa_grupo_id, descricao, documento_numero,
        competencia, emissao, vencimento, valor_original, desconto, juros, multa,
        recorrencia_id, status_id, observacao, criado_por, parcela_numero, parcela_total,
        origem_externa, referencia_externa
      )
      VALUES (
        $1, $2, $3, $12, $13,
        $14, $15, $4, $5,
        $6, $6, $16, $7, 0, 0, 0,
        fn_fin_tipo_recorrencia_id('unico'), fn_fin_status_titulo_id('aberto'), $8, $9, 1, 1,
        $10, $11
      )
      ON CONFLICT (empresa_id, origem_externa, referencia_externa)
        WHERE origem_externa IS NOT NULL AND referencia_externa IS NOT NULL
      DO NOTHING
      RETURNING *
    `;
  },

  listar_contas_receber: () => {
    return `
      SELECT
        cr.*,
        st.codigo AS status_codigo,
        st.nome AS status_nome,
        rt.codigo AS recorrencia_codigo,
        c.nome AS categoria_nome,
        cc.nome AS centro_custo_nome,
        cf.nome AS conta_financeira_nome,
        ct.nome AS contraparte_nome,
        eg.nome AS empresa_grupo_nome,
        COALESCE((SELECT SUM(fr.valor_taxa) FROM financeiro_recebimento fr WHERE fr.conta_receber_id=cr.id AND fr.ativo=true),0)::numeric(14,2) AS taxa_acumulada,
        COALESCE((SELECT SUM(fr.valor_liquido) FROM financeiro_recebimento fr WHERE fr.conta_receber_id=cr.id AND fr.ativo=true),0)::numeric(14,2) AS valor_liquido_acumulado,
        GREATEST((cr.valor_original - cr.desconto + cr.juros + cr.multa) - cr.valor_recebido_acumulado, 0)::numeric(14,2) AS valor_em_aberto
      FROM financeiro_conta_receber cr
      INNER JOIN financeiro_status_titulo_tipo st ON st.id = cr.status_id
      INNER JOIN financeiro_recorrencia_tipo rt ON rt.id = cr.recorrencia_id
      LEFT JOIN financeiro_categoria c ON c.id = cr.categoria_id
      LEFT JOIN financeiro_centro_custo cc ON cc.id = cr.centro_custo_id
      LEFT JOIN financeiro_conta_financeira cf ON cf.id = cr.conta_financeira_id
      LEFT JOIN financeiro_contraparte ct ON ct.id = cr.contraparte_id
      LEFT JOIN financeiro_empresa_grupo eg ON eg.id = cr.empresa_grupo_id
      WHERE cr.empresa_id = $1
        AND cr.ativo = true
        AND ($2 = '' OR st.codigo = $2)
        AND ($3::text IS NULL OR TO_CHAR(cr.vencimento, 'YYYY-MM') = $3::text)
        AND ($6::bigint IS NULL OR cr.conta_financeira_id = $6)
        AND ($7::bigint IS NULL OR cr.contraparte_id = $7)
        AND ($8::bigint IS NULL OR cr.empresa_grupo_id = $8)
      ORDER BY cr.vencimento ASC, cr.id DESC
      LIMIT $4 OFFSET $5
    `;
  },

  sincronizar_contas_receber_empresa: () => {
    return `
      WITH calc AS (
        SELECT
          cr.id,
          cr.status_id AS status_atual_id,
          cr.vencimento,
          GREATEST((cr.valor_original - cr.desconto + cr.juros + cr.multa), 0)::numeric(14,2) AS valor_total_titulo,
          COALESCE((
            SELECT SUM(fr.valor)
            FROM financeiro_recebimento fr
            WHERE fr.empresa_id = cr.empresa_id
              AND fr.conta_receber_id = cr.id
              AND fr.ativo = true
          ), 0)::numeric(14,2) AS valor_recebido
        FROM financeiro_conta_receber cr
        WHERE cr.empresa_id = $1
          AND cr.ativo = true
      ),
      calc_status AS (
        SELECT
          id,
          valor_recebido,
          CASE
            WHEN status_atual_id = fn_fin_status_titulo_id('cancelado') THEN status_atual_id
            WHEN valor_total_titulo > 0 AND valor_recebido >= valor_total_titulo
              THEN fn_fin_status_titulo_id('pago')
            WHEN valor_recebido > 0
              THEN fn_fin_status_titulo_id('parcial')
            WHEN vencimento < CURRENT_DATE
              THEN fn_fin_status_titulo_id('vencido')
            ELSE fn_fin_status_titulo_id('aberto')
          END AS novo_status_id
        FROM calc
      )
      UPDATE financeiro_conta_receber cr
      SET
        valor_recebido_acumulado = cs.valor_recebido,
        status_id = cs.novo_status_id,
        updated_at = CURRENT_TIMESTAMP
      FROM calc_status cs
      WHERE cr.id = cs.id
        AND (
          cr.valor_recebido_acumulado IS DISTINCT FROM cs.valor_recebido
          OR cr.status_id IS DISTINCT FROM cs.novo_status_id
        )
    `;
  },

  sincronizar_conta_receber_por_id: () => {
    return `
      WITH calc AS (
        SELECT
          cr.id,
          cr.status_id AS status_atual_id,
          cr.vencimento,
          GREATEST((cr.valor_original - cr.desconto + cr.juros + cr.multa), 0)::numeric(14,2) AS valor_total_titulo,
          COALESCE((
            SELECT SUM(fr.valor)
            FROM financeiro_recebimento fr
            WHERE fr.empresa_id = cr.empresa_id
              AND fr.conta_receber_id = cr.id
              AND fr.ativo = true
          ), 0)::numeric(14,2) AS valor_recebido
        FROM financeiro_conta_receber cr
        WHERE cr.empresa_id = $1
          AND cr.id = $2
          AND cr.ativo = true
      ),
      calc_status AS (
        SELECT
          id,
          valor_recebido,
          CASE
            WHEN status_atual_id = fn_fin_status_titulo_id('cancelado') THEN status_atual_id
            WHEN valor_total_titulo > 0 AND valor_recebido >= valor_total_titulo
              THEN fn_fin_status_titulo_id('pago')
            WHEN valor_recebido > 0
              THEN fn_fin_status_titulo_id('parcial')
            WHEN vencimento < CURRENT_DATE
              THEN fn_fin_status_titulo_id('vencido')
            ELSE fn_fin_status_titulo_id('aberto')
          END AS novo_status_id
        FROM calc
      )
      UPDATE financeiro_conta_receber cr
      SET
        valor_recebido_acumulado = cs.valor_recebido,
        status_id = cs.novo_status_id,
        updated_at = CURRENT_TIMESTAMP
      FROM calc_status cs
      WHERE cr.id = cs.id
      RETURNING cr.*
    `;
  },

  gerar_alertas_contas_pagar_vencidas: () => {
    return `
      INSERT INTO financeiro_alerta (
        empresa_id,
        tipo_id,
        status_id,
        titulo,
        descricao,
        referencia_id,
        referencia_tabela,
        payload
      )
      SELECT
        cp.empresa_id,
        fn_fin_alerta_tipo_id('vencido'),
        fn_fin_alerta_status_id('novo'),
        'Conta a pagar vencida',
        CONCAT(
          'A conta a pagar "',
          cp.descricao,
          '" venceu em ',
          TO_CHAR(cp.vencimento, 'DD/MM/YYYY'),
          ' e possui ',
          TO_CHAR(
            GREATEST(
              (cp.valor_original - cp.desconto + cp.juros + cp.multa) - cp.valor_pago_acumulado,
              0
            ),
            'FM999G999G999D00'
          ),
          ' em aberto.'
        ),
        cp.id,
        'financeiro_conta_pagar',
        jsonb_build_object(
          'tipo_titulo', 'conta_pagar',
          'conta_id', cp.id,
          'descricao', cp.descricao,
          'documento_numero', cp.documento_numero,
          'vencimento', cp.vencimento,
          'valor_original', cp.valor_original,
          'valor_pago_acumulado', cp.valor_pago_acumulado,
          'valor_em_aberto',
            GREATEST(
              (cp.valor_original - cp.desconto + cp.juros + cp.multa) - cp.valor_pago_acumulado,
              0
            )
        )
      FROM financeiro_conta_pagar cp
      WHERE cp.empresa_id = $1
        AND cp.ativo = true
        AND cp.status_id = fn_fin_status_titulo_id('vencido')
        AND GREATEST(
          (cp.valor_original - cp.desconto + cp.juros + cp.multa) - cp.valor_pago_acumulado,
          0
        ) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM financeiro_alerta a
          WHERE a.empresa_id = cp.empresa_id
            AND a.tipo_id = fn_fin_alerta_tipo_id('vencido')
            AND a.referencia_id = cp.id
            AND a.referencia_tabela = 'financeiro_conta_pagar'
            AND a.status_id IN (
              fn_fin_alerta_status_id('novo'),
              fn_fin_alerta_status_id('lido')
            )
        )
      RETURNING id
    `;
  },

  gerar_alertas_contas_receber_vencidas: () => {
    return `
      INSERT INTO financeiro_alerta (
        empresa_id,
        tipo_id,
        status_id,
        titulo,
        descricao,
        referencia_id,
        referencia_tabela,
        payload
      )
      SELECT
        cr.empresa_id,
        fn_fin_alerta_tipo_id('vencido'),
        fn_fin_alerta_status_id('novo'),
        'Conta a receber vencida',
        CONCAT(
          'A conta a receber "',
          cr.descricao,
          '" venceu em ',
          TO_CHAR(cr.vencimento, 'DD/MM/YYYY'),
          ' e possui ',
          TO_CHAR(
            GREATEST(
              (cr.valor_original - cr.desconto + cr.juros + cr.multa) - cr.valor_recebido_acumulado,
              0
            ),
            'FM999G999G999D00'
          ),
          ' pendente de recebimento.'
        ),
        cr.id,
        'financeiro_conta_receber',
        jsonb_build_object(
          'tipo_titulo', 'conta_receber',
          'conta_id', cr.id,
          'descricao', cr.descricao,
          'documento_numero', cr.documento_numero,
          'vencimento', cr.vencimento,
          'valor_original', cr.valor_original,
          'valor_recebido_acumulado', cr.valor_recebido_acumulado,
          'valor_em_aberto',
            GREATEST(
              (cr.valor_original - cr.desconto + cr.juros + cr.multa) - cr.valor_recebido_acumulado,
              0
            )
        )
      FROM financeiro_conta_receber cr
      WHERE cr.empresa_id = $1
        AND cr.ativo = true
        AND cr.status_id = fn_fin_status_titulo_id('vencido')
        AND GREATEST(
          (cr.valor_original - cr.desconto + cr.juros + cr.multa) - cr.valor_recebido_acumulado,
          0
        ) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM financeiro_alerta a
          WHERE a.empresa_id = cr.empresa_id
            AND a.tipo_id = fn_fin_alerta_tipo_id('vencido')
            AND a.referencia_id = cr.id
            AND a.referencia_tabela = 'financeiro_conta_receber'
            AND a.status_id IN (
              fn_fin_alerta_status_id('novo'),
              fn_fin_alerta_status_id('lido')
            )
        )
      RETURNING id
    `;
  },

  resolver_alertas_vencidos_sem_pendencia: () => {
    return `
      UPDATE financeiro_alerta a
      SET
        status_id = fn_fin_alerta_status_id('resolvido'),
        resolvido_em = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE a.empresa_id = $1
        AND a.tipo_id = fn_fin_alerta_tipo_id('vencido')
        AND a.status_id IN (
          fn_fin_alerta_status_id('novo'),
          fn_fin_alerta_status_id('lido')
        )
        AND (
          (
            a.referencia_tabela = 'financeiro_conta_pagar'
            AND NOT EXISTS (
              SELECT 1
              FROM financeiro_conta_pagar cp
              WHERE cp.id = a.referencia_id
                AND cp.empresa_id = a.empresa_id
                AND cp.ativo = true
                AND cp.status_id = fn_fin_status_titulo_id('vencido')
                AND GREATEST(
                  (cp.valor_original - cp.desconto + cp.juros + cp.multa) - cp.valor_pago_acumulado,
                  0
                ) > 0
            )
          )
          OR
          (
            a.referencia_tabela = 'financeiro_conta_receber'
            AND NOT EXISTS (
              SELECT 1
              FROM financeiro_conta_receber cr
              WHERE cr.id = a.referencia_id
                AND cr.empresa_id = a.empresa_id
                AND cr.ativo = true
                AND cr.status_id = fn_fin_status_titulo_id('vencido')
                AND GREATEST(
                  (cr.valor_original - cr.desconto + cr.juros + cr.multa) - cr.valor_recebido_acumulado,
                  0
                ) > 0
            )
          )
        )
      RETURNING id
    `;
  },

  listar_contas_receber_agrupado: () => {
    return `
      SELECT
        COALESCE(cr.grupo_parcelamento_id::text, cr.id::text) AS grupo_parcelamento_id,
        MIN(cr.descricao) AS descricao,
        COUNT(*)::int AS total_parcelas,
        SUM(cr.valor_original)::numeric(14,2) AS valor_total,
        SUM(GREATEST((cr.valor_original - cr.desconto + cr.juros + cr.multa) - cr.valor_recebido_acumulado, 0))::numeric(14,2) AS valor_em_aberto_total,
        MIN(cr.vencimento) AS primeiro_vencimento,
        MAX(cr.vencimento) AS ultimo_vencimento,
        json_agg(
          json_build_object(
            'id', cr.id,
            'parcela_numero', cr.parcela_numero,
            'parcela_total', cr.parcela_total,
            'valor_original', cr.valor_original,
            'valor_em_aberto', GREATEST((cr.valor_original - cr.desconto + cr.juros + cr.multa) - cr.valor_recebido_acumulado, 0),
            'vencimento', cr.vencimento,
            'status_codigo', st.codigo,
            'status_nome', st.nome,
            'anexo_url', cr.anexo_url,
            'anexo_nome_arquivo', cr.anexo_nome_arquivo,
            'anexo_mimetype', cr.anexo_mimetype
          )
          ORDER BY cr.parcela_numero ASC, cr.vencimento ASC
        ) AS parcelas
      FROM financeiro_conta_receber cr
      INNER JOIN financeiro_status_titulo_tipo st ON st.id = cr.status_id
      WHERE cr.empresa_id = $1
        AND cr.ativo = true
        AND ($2 = '' OR st.codigo = $2)
        AND ($3::text IS NULL OR TO_CHAR(cr.vencimento, 'YYYY-MM') = $3::text)
        AND ($6::bigint IS NULL OR cr.conta_financeira_id = $6)
        AND ($7::bigint IS NULL OR cr.contraparte_id = $7)
        AND ($8::bigint IS NULL OR cr.empresa_grupo_id = $8)
      GROUP BY COALESCE(cr.grupo_parcelamento_id::text, cr.id::text)
      ORDER BY MIN(cr.vencimento) ASC
      LIMIT $4 OFFSET $5
    `;
  },

  registrar_recebimento: () => {
    return `
      INSERT INTO financeiro_recebimento (
        conta_receber_id, empresa_id, conta_financeira_id, data_recebimento,
        valor, meio_pagamento, referencia_externa, observacao, ativo, criado_por,
        forma_pagamento_id, taxa_percentual, taxa_fixa, valor_taxa, valor_liquido
      )
      VALUES ($1,$2,$3,COALESCE($4,CURRENT_TIMESTAMP),$5,$6,$7,$8,true,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `;
  },

  deletar_conta_receber: () => {
    return `
      UPDATE financeiro_conta_receber
      SET
        ativo = false,
        status_id = fn_fin_status_titulo_id('cancelado'),
        updated_at = CURRENT_TIMESTAMP
      WHERE empresa_id = $1
        AND ativo = true
        AND (
          ($2::bigint IS NOT NULL AND id = $2::bigint)
          OR
          ($3::text IS NOT NULL AND COALESCE(grupo_parcelamento_id::text, id::text) = $3::text)
        )
      RETURNING id, grupo_parcelamento_id
    `;
  },

  listar_lancamentos: () => {
    return `
      SELECT
        fl.*,
        n.codigo AS natureza_codigo,
        sl.codigo AS status_codigo,
        ol.codigo AS origem_codigo,
        c.nome AS categoria_nome,
        cc.nome AS centro_custo_nome,
        cf.nome AS conta_financeira_nome,
        ft.id AS transferencia_id,
        ft.observacao AS transferencia_observacao,
        ft.anexo_url AS transferencia_anexo_url,
        ft.anexo_nome_arquivo AS transferencia_anexo_nome_arquivo,
        ft.anexo_mimetype AS transferencia_anexo_mimetype,
        cfo.nome AS transferencia_conta_origem_nome,
        cfd.nome AS transferencia_conta_destino_nome,
        CASE WHEN ft.id IS NULL THEN NULL WHEN fl.conta_financeira_id=ft.conta_origem_id THEN 'saida' ELSE 'entrada' END AS transferencia_movimento
      FROM financeiro_lancamento fl
      INNER JOIN financeiro_natureza_lancamento_tipo n ON n.id = fl.natureza_id
      INNER JOIN financeiro_status_lancamento_tipo sl ON sl.id = fl.status_id
      INNER JOIN financeiro_origem_lancamento_tipo ol ON ol.id = fl.origem_id
      LEFT JOIN financeiro_categoria c ON c.id = fl.categoria_id
      LEFT JOIN financeiro_centro_custo cc ON cc.id = fl.centro_custo_id
      LEFT JOIN financeiro_conta_financeira cf ON cf.id = fl.conta_financeira_id
      LEFT JOIN financeiro_transferencia ft ON ol.codigo='transferencia' AND ft.id=fl.origem_registro_id AND ft.empresa_id=fl.empresa_id
      LEFT JOIN financeiro_conta_financeira cfo ON cfo.id=ft.conta_origem_id
      LEFT JOIN financeiro_conta_financeira cfd ON cfd.id=ft.conta_destino_id
      WHERE fl.empresa_id = $1
        AND fl.ativo = true
        AND ($2::date IS NULL OR fl.data_lancamento::date >= $2::date)
        AND ($3::date IS NULL OR fl.data_lancamento::date <= $3::date)
        AND ($4 = '' OR n.codigo = $4)
      ORDER BY fl.data_lancamento DESC, fl.id DESC
      LIMIT $5 OFFSET $6
    `;
  },

  criar_transferencia: () => `
    INSERT INTO financeiro_transferencia
      (empresa_id,conta_origem_id,conta_destino_id,valor,data_transferencia,observacao,
       anexo_url,anexo_nome_arquivo,anexo_mimetype,criado_por)
    SELECT $1,$2,$3,$4,COALESCE($5,CURRENT_TIMESTAMP),$6,$7,$8,$9,$10
    WHERE EXISTS (SELECT 1 FROM financeiro_conta_financeira WHERE id=$2 AND empresa_id=$1 AND ativo=true)
      AND EXISTS (SELECT 1 FROM financeiro_conta_financeira WHERE id=$3 AND empresa_id=$1 AND ativo=true)
    RETURNING *
  `,
  criar_lancamento_transferencia: () => `
    INSERT INTO financeiro_lancamento
      (empresa_id,natureza_id,status_id,origem_id,origem_registro_id,conta_financeira_id,
       data_lancamento,valor,descricao,metadata,criado_por,ativo)
    VALUES ($1,fn_fin_natureza_lancamento_id($2),fn_fin_status_lancamento_id('realizado'),
      fn_fin_origem_lancamento_id('transferencia'),$3,$4,$5,$6,$7,$8::jsonb,$9,true)
    RETURNING *
  `,

  deletar_lancamento: () => {
    return `
      UPDATE financeiro_lancamento
      SET
        ativo = false,
        status_id = fn_fin_status_lancamento_id('cancelado'),
        updated_at = CURRENT_TIMESTAMP
      WHERE empresa_id = $1
        AND id = $2
        AND ativo = true
      RETURNING *
    `;
  },

  salvar_meta_usuario: () => {
    return `
      INSERT INTO financeiro_meta_usuario (
        empresa_id, usuario_id, mes_referencia, valor_meta, percentual_comissao, valor_comissao_fixa
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (empresa_id, usuario_id, mes_referencia)
      DO UPDATE SET
        valor_meta = EXCLUDED.valor_meta,
        percentual_comissao = EXCLUDED.percentual_comissao,
        valor_comissao_fixa = EXCLUDED.valor_comissao_fixa
      RETURNING *
    `;
  },

  obter_meta_para_finalizacao: () => {
    return `
      WITH crm_ganho AS (
        SELECT
          n.responsavel_usuario_id AS usuario_id,
          SUM(COALESCE(n.valor_fechamento, n.valor_estimado, 0))::numeric(14,2) AS valor_realizado_crm
        FROM comercial_negocio n
        INNER JOIN comercial_etapa e ON e.id = n.etapa_id
        WHERE n.empresa_id = $1
          AND n.ativo = true
          AND n.responsavel_usuario_id = $2
          AND COALESCE(e.eh_fechamento, false) = true
          AND COALESCE(e.eh_ganho, false) = true
          AND TO_CHAR(COALESCE(n.data_fechamento_real, n.data_fechamento_prevista, n.data_criacao)::date, 'YYYY-MM') = $3
        GROUP BY n.responsavel_usuario_id
      )
      SELECT
        m.id AS meta_id,
        m.empresa_id,
        m.usuario_id,
        m.mes_referencia,
        m.valor_meta,
        m.percentual_comissao,
        m.valor_comissao_fixa,
        u.nome AS usuario_nome,
        COALESCE(cg.valor_realizado_crm, 0)::numeric(14,2) AS valor_realizado_crm
      FROM financeiro_meta_usuario m
      INNER JOIN usuario u ON u.id = m.usuario_id
      LEFT JOIN crm_ganho cg ON cg.usuario_id = m.usuario_id
      WHERE m.empresa_id = $1
        AND m.usuario_id = $2
        AND TO_CHAR(m.mes_referencia::date, 'YYYY-MM') = $3
      ORDER BY m.id DESC
      LIMIT 1
    `;
  },

  existe_comissao_usuario_mes: () => {
    return `
      SELECT c.id
      FROM financeiro_comissao_lancamento c
      WHERE c.empresa_id = $1
        AND c.usuario_id = $2
        AND TO_CHAR(c.competencia::date, 'YYYY-MM') = $3
      ORDER BY c.id DESC
      LIMIT 1
    `;
  },

  buscar_categoria_comissao_padrao: () => {
    return `
      SELECT c.id
      FROM financeiro_categoria c
      WHERE c.empresa_id = $1
        AND c.ativo = true
        AND LOWER(c.nome) = 'folha e comissoes'
      ORDER BY c.id ASC
      LIMIT 1
    `;
  },

  lancar_comissao: () => {
    return `
      INSERT INTO financeiro_comissao_lancamento (
        empresa_id, usuario_id,
        base_calculo, percentual_aplicado, valor_comissao, status_id, observacao, competencia
      )
      VALUES (
        $1, $2,
        $3, $4, $5, fn_fin_status_titulo_id('aberto'), $6, COALESCE($7, CURRENT_DATE)
      )
      RETURNING *
    `;
  },

  listar_metas_mes: () => {
    return `
      WITH crm_ganho AS (
        SELECT
          n.responsavel_usuario_id AS usuario_id,
          SUM(COALESCE(n.valor_fechamento, n.valor_estimado, 0))::numeric(14,2) AS valor_realizado_crm
        FROM comercial_negocio n
        INNER JOIN comercial_etapa e ON e.id = n.etapa_id
        WHERE n.empresa_id = $1
          AND n.ativo = true
          AND n.responsavel_usuario_id IS NOT NULL
          AND COALESCE(e.eh_fechamento, false) = true
          AND COALESCE(e.eh_ganho, false) = true
          AND TO_CHAR(COALESCE(n.data_fechamento_real, n.data_fechamento_prevista, n.data_criacao)::date, 'YYYY-MM') = $2
        GROUP BY n.responsavel_usuario_id
      )
      SELECT
        m.*,
        u.nome AS usuario_nome,
        COALESCE(cg.valor_realizado_crm, 0)::numeric(14,2) AS valor_realizado_crm,
        EXISTS (
          SELECT 1
          FROM financeiro_comissao_lancamento c
          WHERE c.empresa_id = m.empresa_id
            AND c.usuario_id = m.usuario_id
            AND TO_CHAR(c.competencia::date, 'YYYY-MM') = $2
        ) AS possui_comissao_lancada,
        CASE
          WHEN COALESCE(m.valor_meta, 0) > 0
          THEN ROUND((COALESCE(cg.valor_realizado_crm, 0) / m.valor_meta) * 100.0, 2)
          ELSE 0
        END::numeric(10,2) AS percentual_atingimento,
        GREATEST(COALESCE(m.valor_meta, 0) - COALESCE(cg.valor_realizado_crm, 0), 0)::numeric(14,2) AS valor_faltante_meta
      FROM financeiro_meta_usuario m
      INNER JOIN usuario u ON u.id = m.usuario_id
      LEFT JOIN crm_ganho cg ON cg.usuario_id = m.usuario_id
      WHERE m.empresa_id = $1
        AND TO_CHAR(m.mes_referencia::date, 'YYYY-MM') = $2
      ORDER BY u.nome ASC, m.usuario_id ASC, m.created_at DESC, m.id DESC
    `;
  },

  listar_comissoes_lancadas_mes: () => {
    return `
      SELECT
        c.*,
        u.nome AS usuario_nome,
        st.codigo AS status_codigo,
        st.nome AS status_nome
      FROM financeiro_comissao_lancamento c
      INNER JOIN usuario u ON u.id = c.usuario_id
      INNER JOIN financeiro_status_titulo_tipo st ON st.id = c.status_id
      WHERE c.empresa_id = $1
        AND TO_CHAR(c.competencia::date, 'YYYY-MM') = $2
      ORDER BY c.competencia DESC, c.created_at DESC, c.id DESC
      LIMIT 500
    `;
  },

  listar_alertas: () => {
    return `
      SELECT
        a.*,
        at.codigo AS tipo_codigo,
        ast.codigo AS status_codigo
      FROM financeiro_alerta a
      INNER JOIN financeiro_alerta_tipo at ON at.id = a.tipo_id
      INNER JOIN financeiro_alerta_status_tipo ast ON ast.id = a.status_id
      WHERE a.empresa_id = $1
        AND ($2 = '' OR ast.codigo = $2)
      ORDER BY a.data_alerta DESC, a.id DESC
      LIMIT 200
    `;
  },

  marcar_alerta_lido: () => {
    return `
      UPDATE financeiro_alerta
      SET
        status_id = fn_fin_alerta_status_id('lido'),
        lido_por = $3,
        lido_em = CURRENT_TIMESTAMP
      WHERE id = $1
        AND empresa_id = $2
      RETURNING *
    `;
  },

  dashboard_dre: () => {
    return `
      SELECT * FROM vw_financeiro_dre_mensal
      WHERE empresa_id = $1
      ORDER BY mes_referencia DESC
      LIMIT 12
    `;
  },

  dashboard_fluxo: () => {
    return `
      WITH dias AS (
        SELECT generate_series(CURRENT_DATE - 30, CURRENT_DATE + 30, INTERVAL '1 day')::date AS dia
      ), realizado AS (
        SELECT fl.data_lancamento::date AS dia,
          SUM(fl.valor) FILTER (WHERE n.codigo='entrada') AS entradas,
          SUM(fl.valor) FILTER (WHERE n.codigo='saida') AS saidas
        FROM financeiro_lancamento fl
        JOIN financeiro_natureza_lancamento_tipo n ON n.id=fl.natureza_id
        JOIN financeiro_status_lancamento_tipo s ON s.id=fl.status_id
        WHERE fl.empresa_id=$1 AND fl.ativo=true AND s.codigo='realizado'
          AND fl.data_lancamento::date BETWEEN CURRENT_DATE-30 AND CURRENT_DATE+30
        GROUP BY fl.data_lancamento::date
      ), previsto AS (
        SELECT vencimento AS dia,
          SUM(valor) FILTER (WHERE natureza='entrada') AS entradas,
          SUM(valor) FILTER (WHERE natureza='saida') AS saidas
        FROM (
          SELECT cr.vencimento, GREATEST(cr.valor_original-cr.desconto+cr.juros+cr.multa-cr.valor_recebido_acumulado,0) valor, 'entrada' natureza
          FROM financeiro_conta_receber cr JOIN financeiro_status_titulo_tipo st ON st.id=cr.status_id
          WHERE cr.empresa_id=$1 AND cr.ativo=true AND st.codigo IN ('aberto','parcial','vencido') AND cr.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE+30
          UNION ALL
          SELECT cp.vencimento, GREATEST(cp.valor_original-cp.desconto+cp.juros+cp.multa-cp.valor_pago_acumulado,0), 'saida'
          FROM financeiro_conta_pagar cp JOIN financeiro_status_titulo_tipo st ON st.id=cp.status_id
          WHERE cp.empresa_id=$1 AND cp.ativo=true AND st.codigo IN ('aberto','parcial','vencido') AND cp.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE+30
        ) p GROUP BY vencimento
      )
      SELECT $1::int AS empresa_id, d.dia,
        COALESCE(r.entradas,0)::numeric(14,2) entradas_realizadas,
        COALESCE(r.saidas,0)::numeric(14,2) saidas_realizadas,
        COALESCE(p.entradas,0)::numeric(14,2) entradas_previstas,
        COALESCE(p.saidas,0)::numeric(14,2) saidas_previstas,
        (COALESCE(r.entradas,0)-COALESCE(r.saidas,0))::numeric(14,2) saldo_realizado,
        (COALESCE(r.entradas,0)-COALESCE(r.saidas,0)+COALESCE(p.entradas,0)-COALESCE(p.saidas,0))::numeric(14,2) saldo_projetado
      FROM dias d LEFT JOIN realizado r USING(dia) LEFT JOIN previsto p USING(dia)
      ORDER BY d.dia
    `;
  },

  dashboard_resumo_operacional: () => `
    SELECT
      (SELECT COALESCE(SUM(saldo_inicial),0) FROM financeiro_conta_financeira WHERE empresa_id=$1 AND ativo=true)
      + (SELECT COALESCE(SUM(CASE WHEN n.codigo='entrada' THEN l.valor ELSE -l.valor END),0)
         FROM financeiro_lancamento l JOIN financeiro_natureza_lancamento_tipo n ON n.id=l.natureza_id
         JOIN financeiro_status_lancamento_tipo s ON s.id=l.status_id
         WHERE l.empresa_id=$1 AND l.ativo=true AND s.codigo='realizado') AS saldo_disponivel,
      (SELECT COALESCE(SUM(GREATEST(cr.valor_original-cr.desconto+cr.juros+cr.multa-cr.valor_recebido_acumulado,0)),0)
       FROM financeiro_conta_receber cr JOIN financeiro_status_titulo_tipo st ON st.id=cr.status_id
       WHERE cr.empresa_id=$1 AND cr.ativo=true AND st.codigo IN ('aberto','parcial','vencido') AND date_trunc('month',cr.vencimento)=date_trunc('month',CURRENT_DATE)) AS receber_mes,
      (SELECT COALESCE(SUM(GREATEST(cp.valor_original-cp.desconto+cp.juros+cp.multa-cp.valor_pago_acumulado,0)),0)
       FROM financeiro_conta_pagar cp JOIN financeiro_status_titulo_tipo st ON st.id=cp.status_id
       WHERE cp.empresa_id=$1 AND cp.ativo=true AND st.codigo IN ('aberto','parcial','vencido') AND date_trunc('month',cp.vencimento)=date_trunc('month',CURRENT_DATE)) AS pagar_mes,
      (SELECT COALESCE(SUM(r.valor),0) FROM financeiro_recebimento r WHERE r.empresa_id=$1 AND r.ativo=true AND date_trunc('month',r.data_recebimento)=date_trunc('month',CURRENT_DATE)) AS recebido_mes,
      (SELECT COALESCE(SUM(p.valor),0) FROM financeiro_pagamento_pagar p WHERE p.empresa_id=$1 AND p.ativo=true AND date_trunc('month',p.data_pagamento)=date_trunc('month',CURRENT_DATE)) AS pago_mes
  `,

  dashboard_proximos_vencimentos: () => `
    SELECT * FROM (
      SELECT cr.id, 'receber'::text tipo, cr.descricao, cr.vencimento,
        GREATEST(cr.valor_original-cr.desconto+cr.juros+cr.multa-cr.valor_recebido_acumulado,0)::numeric(14,2) valor
      FROM financeiro_conta_receber cr JOIN financeiro_status_titulo_tipo st ON st.id=cr.status_id
      WHERE cr.empresa_id=$1 AND cr.ativo=true AND st.codigo IN ('aberto','parcial','vencido') AND cr.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE+7
      UNION ALL
      SELECT cp.id, 'pagar', cp.descricao, cp.vencimento,
        GREATEST(cp.valor_original-cp.desconto+cp.juros+cp.multa-cp.valor_pago_acumulado,0)::numeric(14,2)
      FROM financeiro_conta_pagar cp JOIN financeiro_status_titulo_tipo st ON st.id=cp.status_id
      WHERE cp.empresa_id=$1 AND cp.ativo=true AND st.codigo IN ('aberto','parcial','vencido') AND cp.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE+7
    ) x ORDER BY vencimento, tipo DESC, id LIMIT 30
  `,

  dashboard_inadimplencia: () => {
    return `
      SELECT * FROM vw_financeiro_inadimplencia_resumo
      WHERE empresa_id = $1
    `;
  },

  dashboard_mensalidades_ativas: () => {
    return `
      SELECT
        COUNT(*)::int AS total_assinaturas_ativas,
        COALESCE(
          SUM(
            CASE
              WHEN COALESCE(LOWER(fa.ciclo_cobranca), 'mensal') = 'bimestral' THEN COALESCE(fa.valor, 0) / 2.0
              WHEN COALESCE(LOWER(fa.ciclo_cobranca), 'mensal') = 'trimestral' THEN COALESCE(fa.valor, 0) / 3.0
              WHEN COALESCE(LOWER(fa.ciclo_cobranca), 'mensal') = 'semestral' THEN COALESCE(fa.valor, 0) / 6.0
              WHEN COALESCE(LOWER(fa.ciclo_cobranca), 'mensal') = 'anual' THEN COALESCE(fa.valor, 0) / 12.0
              ELSE COALESCE(fa.valor, 0)
            END
          ),
          0
        )::numeric(14,2) AS mensalidades_ativas_total
      FROM financeiro_assinatura_empresa fa
      WHERE fa.empresa_id = $1
        AND fa.ativo = true
    `;
  },

  dashboard_crm: () => {
    return `
      SELECT * FROM vw_financeiro_receita_crm_prevista
      WHERE empresa_id = $1
        AND data_prevista >= CURRENT_DATE
      ORDER BY data_prevista ASC
      LIMIT 90
    `;
  },

  listar_assinaturas_empresa: () => {
    return `
      SELECT
        fa.*,
        c.nome AS categoria_nome
      FROM financeiro_assinatura_empresa fa
      LEFT JOIN financeiro_categoria c ON c.id = fa.categoria_id
      WHERE fa.empresa_id = $1
        AND (
          $2 = ''
          OR ($2 = 'ativos' AND fa.ativo = true)
          OR ($2 = 'inativos' AND fa.ativo = false)
        )
      ORDER BY fa.ativo DESC, fa.proximo_vencimento ASC NULLS LAST, fa.nome ASC, fa.id DESC
    `;
  },

  criar_assinatura_empresa: () => {
    return `
      INSERT INTO financeiro_assinatura_empresa (
        empresa_id,
        nome,
        fornecedor,
        plano,
        valor,
        ciclo_cobranca,
        dia_vencimento,
        proximo_vencimento,
        categoria_id,
        conta_financeira_id,
        observacao,
        ativo,
        criado_por
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, true), $13
      )
      RETURNING *
    `;
  },

  editar_assinatura_empresa: () => {
    return `
      UPDATE financeiro_assinatura_empresa
      SET
        nome = COALESCE($3, nome),
        fornecedor = COALESCE($4, fornecedor),
        plano = $5,
        valor = COALESCE($6, valor),
        ciclo_cobranca = COALESCE($7, ciclo_cobranca),
        dia_vencimento = $8,
        proximo_vencimento = $9,
        categoria_id = $10,
        conta_financeira_id = $11,
        observacao = $12,
        ativo = COALESCE($13, ativo)
      WHERE id = $1
        AND empresa_id = $2
      RETURNING *
    `;
  },

  inativar_assinatura_empresa: () => {
    return `
      UPDATE financeiro_assinatura_empresa
      SET ativo = false
      WHERE id = $1
        AND empresa_id = $2
      RETURNING *
    `;
  },

  listar_assinaturas_cobrancas: () => {
    return `
      SELECT *
      FROM vw_financeiro_assinatura_cobrancas
      WHERE empresa_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
  },

  health_contas_pagar: () => {
    return `SELECT COUNT(*)::int AS total FROM financeiro_conta_pagar WHERE empresa_id = $1 AND ativo = true`;
  },

  health_contas_receber: () => {
    return `SELECT COUNT(*)::int AS total FROM financeiro_conta_receber WHERE empresa_id = $1 AND ativo = true`;
  },

  health_lancamentos: () => {
    return `SELECT COUNT(*)::int AS total FROM financeiro_lancamento WHERE empresa_id = $1 AND ativo = true`;
  },

  listar_empresas_com_financeiro_ativo: () => {
    return `
      SELECT DISTINCT empresa_id
      FROM (
        SELECT empresa_id FROM financeiro_conta_pagar WHERE ativo = true
        UNION
        SELECT empresa_id FROM financeiro_conta_receber WHERE ativo = true
      ) empresas
      ORDER BY empresa_id
    `;
  },
};

module.exports = models;
