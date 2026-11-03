const models = {
  login: () => {
    return `
        SELECT
            u.id,
            u.nome,
            u.email,
            u.telefone,
            u.ativo,
            u.empresa_id,
            u.is_master,  -- Novo campo: Define se é o dono da conta
            u.permissoes_customizadas, -- Novo campo: Permissões específicas do user
            u.foto_perfil_url,
            e.nome_fantasia as empresa,
            u.perfil_id as cargo_id,
            p.nome as cargo,
            -- Informações do Plano
            ea.has_pdv as pdv,
			(select count(*) from usuario where empresa_id = u.empresa_id and is_master = false and ativo = true) as curr_user,
            pl.max_user,
			(select count(*) from empresa_filial where empresa_id = u.empresa_id and ativo = true) as curr_filial,
            pl.max_filial,
            ea.additional_user,
			ea.additional_filial,
            pl.max_crm,
            pl.max_leads,
            ea.additional_crm,
            ea.additional_leads,
            pl.id as id_plano,
            pl.nome as nome_plano,
            pl.permissoes as permissoes_plano, -- O "Teto" de permissões do plano
            u.senha as senha_hash -- conferido e removido antes de responder
            
        FROM usuario u
        LEFT JOIN empresa e ON e.id = u.empresa_id
        
        -- Join para pegar o plano ativo da empresa
        LEFT JOIN empresa_assinatura ea ON ea.empresa_id = e.id
        LEFT JOIN assinatura pl ON pl.id = ea.assinatura_id
        LEFT JOIN perfil p on p.id = u.perfil_id
        
        WHERE u.ativo = true
          AND e.ativo = true
          AND ea.ativo = true 
          AND u.email = $1
        ORDER BY u.id
        `;
  },

  forgot_pass: () => {
    return `select id, email from usuario where lower(email) = $1 and ativo = true order by id`;
  },

  update_senha_usuario: () => {
    return `update usuario set senha = $2 where id = $1`;
  },

  invalidar_codigos_reset: () => {
    return `update usuario_senha_reset set usado_em = now() where usuario_id = ANY($1::int[]) and usado_em is null`;
  },

  insert_codigo_reset: () => {
    return `
      insert into usuario_senha_reset (usuario_id, codigo_hash, expira_em)
      values ($1, $2, now() + ($3::int * interval '1 minute'))
    `;
  },

  get_codigos_reset_ativos: () => {
    return `
      select r.id, r.usuario_id, r.codigo_hash, r.tentativas
      from usuario_senha_reset r
      join usuario u on u.id = r.usuario_id
      where lower(u.email) = $1
        and u.ativo = true
        and r.usado_em is null
        and r.expira_em > now()
      order by r.id desc
      for update of r
    `;
  },

  incrementar_tentativa_reset: () => {
    return `update usuario_senha_reset set tentativas = tentativas + 1 where id = ANY($1::bigint[])`;
  },

  marcar_reset_usado: () => {
    return `update usuario_senha_reset set usado_em = now() where id = $1`;
  },

  get_parans: () => {
    return `select * from parametros where empresa_id = 1`;
  },


  get_onboarding_empresa_by_token_context: () => {
    return `
      SELECT
        e.id AS empresa_id,
        e.nome_fantasia,
        e.razao_social,
        e.cnpj,
        e.logradouro,
        e.numero,
        e.bairro,
        e.cidade,
        e.uf,
        e.cep,
        e.ativo AS empresa_ativa,
        u.id AS usuario_id,
        u.nome AS usuario_nome,
        u.email AS usuario_email,
        u.senha AS usuario_senha,
        u.ativo AS usuario_ativo,
        u.is_master
      FROM empresa e
      INNER JOIN usuario u ON u.empresa_id = e.id
      WHERE e.id = $1
        AND LOWER(u.email) = LOWER($2)
      ORDER BY u.is_master DESC, u.id ASC
      LIMIT 1
    `;
  },

  update_empresa_onboarding: () => {
    return `
      UPDATE empresa
      SET
        nome_fantasia = $2,
        razao_social = $3,
        cnpj = $4,
        logradouro = $5,
        numero = $6,
        bairro = $7,
        cidade = $8,
        uf = $9,
        cep = $10,
        ativo = true
      WHERE id = $1
      RETURNING id
    `;
  },

  update_usuario_onboarding: () => {
    return `
      UPDATE usuario
      SET
        nome = $2,
        senha = $3,
        ativo = true
      WHERE id = $1
      RETURNING id, nome, email, empresa_id
    `;
  },

  get_default_crm_empresa: () => {
    return `
      SELECT id
      FROM comercial_crm
      WHERE empresa_id = $1
        AND ativo = true
      ORDER BY master DESC, id ASC
      LIMIT 1
    `;
  },

  insert_crm_master_onboarding: () => {
    return `
      INSERT INTO comercial_crm (
        empresa_id,
        nome,
        descricao,
        ativo,
        master
      ) VALUES (
        $1,
        $2,
        $3,
        true,
        true
      )
      RETURNING id
    `;
  },

  get_etapa_by_codigo_crm: () => {
    return `
      SELECT id
      FROM comercial_etapa
      WHERE crm_id = $1
        AND codigo = $2
      LIMIT 1
    `;
  },

  insert_etapa_crm: () => {
    return `
      INSERT INTO comercial_etapa (
        crm_id,
        codigo,
        nome,
        ordem,
        cor,
        eh_inicial,
        eh_fechamento,
        eh_ganho,
        ativo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, true
      )
      RETURNING id
    `;
  },
};
module.exports = models;
