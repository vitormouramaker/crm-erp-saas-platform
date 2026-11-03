const models = {
  get_usuario_valido: () => {
    return `
      select
        id,
        nome,
        empresa_id
      from usuario
      where id = $1
        and empresa_id = $2
        and ativo = true
    `;
  },

  inserir_horario_trabalho: () => {
    return `
      insert into horario_trabalho (
        empresa_id,
        nome,
        descricao,
        carga_horaria_diaria_minutos,
        carga_horaria_semanal_minutos,
        tolerancia_entrada_minutos,
        tolerancia_saida_minutos,
        tolerancia_extra_minutos,
        flexivel,
        ativo
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      returning
        id,
        empresa_id,
        nome,
        descricao,
        carga_horaria_diaria_minutos,
        carga_horaria_semanal_minutos,
        tolerancia_entrada_minutos,
        tolerancia_saida_minutos,
        tolerancia_extra_minutos,
        flexivel,
        ativo,
        created_at,
        updated_at
    `;
  },

  inserir_horario_trabalho_dia: () => {
    return `
      insert into horario_trabalho_dia (
        horario_trabalho_id,
        dia_semana,
        entrada_1,
        saida_1,
        entrada_2,
        saida_2,
        carga_prevista_minutos,
        ativo
      ) values ($1, $2, $3, $4, $5, $6, $7, true)
      returning
        id,
        horario_trabalho_id,
        dia_semana,
        entrada_1,
        saida_1,
        entrada_2,
        saida_2,
        carga_prevista_minutos,
        ativo
    `;
  },

  inserir_usuario_horario: () => {
    return `
      insert into usuario_horario (
        usuario_id,
        horario_trabalho_id,
        ativo
      ) values ($1, $2, true)
      returning
        id,
        usuario_id,
        horario_trabalho_id,
        ativo
    `;
  },

  get_horarios_trabalho_usuario_lista: () => {
    return `
      select
        uh.id as usuario_horario_id,
        uh.usuario_id,
        ht.id as horario_trabalho_id,
        ht.empresa_id,
        ht.nome,
        ht.descricao,
        ht.carga_horaria_diaria_minutos,
        ht.carga_horaria_semanal_minutos,
        ht.tolerancia_entrada_minutos,
        ht.tolerancia_saida_minutos,
        ht.tolerancia_extra_minutos,
        ht.flexivel,
        ht.ativo,
        ht.created_at,
        ht.updated_at,
        coalesce(
          json_agg(
            json_build_object(
              'id', htd.id,
              'dia_semana', htd.dia_semana,
              'entrada_1', htd.entrada_1,
              'saida_1', htd.saida_1,
              'entrada_2', htd.entrada_2,
              'saida_2', htd.saida_2,
              'carga_prevista_minutos', htd.carga_prevista_minutos,
              'ativo', htd.ativo
            )
            order by htd.dia_semana asc
          ) filter (where htd.id is not null),
          '[]'::json
        ) as dias
      from usuario_horario uh
      inner join usuario u
        on u.id = uh.usuario_id
      inner join horario_trabalho ht
        on ht.id = uh.horario_trabalho_id
      left join horario_trabalho_dia htd
        on htd.horario_trabalho_id = ht.id
       and htd.ativo = true
      where uh.usuario_id = $1
        and u.empresa_id = $2
        and uh.ativo = true
        and ht.ativo = true
      group by
        uh.id,
        uh.usuario_id,
        ht.id
      order by ht.nome asc nulls last, ht.id asc
    `;
  },

  get_horario_trabalho_usuario_by_id: () => {
    return `
      select
        uh.id as usuario_horario_id,
        uh.usuario_id,
        ht.id as horario_trabalho_id,
        ht.empresa_id,
        ht.nome,
        ht.descricao,
        ht.carga_horaria_diaria_minutos,
        ht.carga_horaria_semanal_minutos,
        ht.tolerancia_entrada_minutos,
        ht.tolerancia_saida_minutos,
        ht.tolerancia_extra_minutos,
        ht.flexivel,
        ht.ativo
      from usuario_horario uh
      inner join horario_trabalho ht
        on ht.id = uh.horario_trabalho_id
      inner join usuario u
        on u.id = uh.usuario_id
      where uh.id = $1
        and uh.usuario_id = $2
        and u.empresa_id = $3
        and uh.ativo = true
        and ht.ativo = true
    `;
  },

  atualizar_horario_trabalho: () => {
    return `
      update horario_trabalho
      set
        nome = $2,
        descricao = $3,
        carga_horaria_diaria_minutos = $4,
        carga_horaria_semanal_minutos = $5,
        tolerancia_entrada_minutos = $6,
        tolerancia_saida_minutos = $7,
        tolerancia_extra_minutos = $8,
        flexivel = $9,
        ativo = true,
        updated_at = now()
      where id = $1
      returning
        id,
        empresa_id,
        nome,
        descricao,
        carga_horaria_diaria_minutos,
        carga_horaria_semanal_minutos,
        tolerancia_entrada_minutos,
        tolerancia_saida_minutos,
        tolerancia_extra_minutos,
        flexivel,
        ativo,
        created_at,
        updated_at
    `;
  },

  deletar_horario_trabalho_dias: () => {
    return `
      delete from horario_trabalho_dia
      where horario_trabalho_id = $1
    `;
  },

  desativar_usuario_horario: () => {
    return `
      update usuario_horario
      set ativo = false
      where id = $1
      returning
        id,
        usuario_id,
        horario_trabalho_id,
        ativo
    `;
  },

  count_outros_usuarios_horario_ativos: () => {
    return `
      select count(*)::integer as total
      from usuario_horario
      where horario_trabalho_id = $1
        and ativo = true
    `;
  },

  desativar_horario_trabalho: () => {
    return `
      update horario_trabalho
      set
        ativo = false,
        updated_at = now()
      where id = $1
      returning
        id,
        empresa_id,
        nome,
        descricao,
        ativo,
        updated_at
    `;
  },

  desativar_horario_trabalho_dias: () => {
    return `
      update horario_trabalho_dia
      set ativo = false
      where horario_trabalho_id = $1
    `;
  },

  inserir_registro_ponto: () => {
    return `
      insert into registro_ponto (
        usuario_id,
        data_hora,
        tipo,
        latitude,
        longitude,
        precisao_metros,
        localizacao_capturada_em,
        geolocalizacao_status,
        geolocalizacao_autorizada,
        timezone_cliente,
        idioma_cliente,
        plataforma_cliente,
        user_agent,
        dispositivo_mobile,
        origem_registro,
        registrado_por_usuario_id,
        ip_publico,
        faixa_ip
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18
      )
      returning
        id,
        usuario_id,
        data_hora,
        tipo,
        latitude,
        longitude,
        precisao_metros,
        localizacao_capturada_em,
        geolocalizacao_status,
        geolocalizacao_autorizada,
        timezone_cliente,
        idioma_cliente,
        plataforma_cliente,
        user_agent,
        dispositivo_mobile,
        origem_registro,
        registrado_por_usuario_id,
        ip_publico,
        faixa_ip,
        created_at
    `;
  },

  get_registro_ponto_by_id: () => {
    return `
      select
        rp.id,
        rp.usuario_id,
        rp.data_hora,
        rp.tipo,
        rp.created_at
      from registro_ponto rp
      inner join usuario u
        on u.id = rp.usuario_id
      where rp.id = $1
        and rp.usuario_id = $2
        and u.empresa_id = $3
      limit 1
    `;
  },

  atualizar_registro_ponto: () => {
    return `
      update registro_ponto
      set
        data_hora = $2,
        tipo = $3
      where id = $1
      returning
        id,
        usuario_id,
        data_hora,
        tipo,
        created_at
    `;
  },

  deletar_registro_ponto: () => {
    return `
      delete from registro_ponto
      where id = $1
      returning
        id,
        usuario_id,
        data_hora,
        tipo,
        created_at
    `;
  },

  get_registros_do_dia: () => {
    return `
      select
        id,
        usuario_id,
        data_hora,
        tipo,
        latitude,
        longitude,
        precisao_metros,
        localizacao_capturada_em,
        geolocalizacao_status,
        geolocalizacao_autorizada,
        timezone_cliente,
        idioma_cliente,
        plataforma_cliente,
        user_agent,
        dispositivo_mobile,
        origem_registro,
        registrado_por_usuario_id,
        ip_publico,
        faixa_ip,
        created_at
      from registro_ponto
      where usuario_id = $1
        and data_hora::date = $2::date
      order by data_hora asc, id asc
    `;
  },

  get_registros_periodo: () => {
    return `
      select
        rp.id,
        rp.usuario_id,
        rp.data_hora,
        rp.tipo,
        rp.latitude,
        rp.longitude,
        rp.precisao_metros,
        rp.localizacao_capturada_em,
        rp.geolocalizacao_status,
        rp.geolocalizacao_autorizada,
        rp.timezone_cliente,
        rp.idioma_cliente,
        rp.plataforma_cliente,
        rp.user_agent,
        rp.dispositivo_mobile,
        rp.origem_registro,
        rp.registrado_por_usuario_id,
        rp.ip_publico,
        rp.faixa_ip,
        rp.created_at,
        rp.data_hora::date as data_referencia
      from registro_ponto rp
      inner join usuario u
        on u.id = rp.usuario_id
      where rp.usuario_id = $1
        and u.empresa_id = $2
        and rp.data_hora::date between $3::date and $4::date
      order by rp.data_hora asc, rp.id asc
    `;
  },

  get_horarios_usuario: () => {
    return `
      select
        ht.id as horario_trabalho_id,
        ht.nome,
        ht.descricao,
        ht.carga_horaria_diaria_minutos,
        ht.carga_horaria_semanal_minutos,
        ht.tolerancia_entrada_minutos,
        ht.tolerancia_saida_minutos,
        ht.tolerancia_extra_minutos,
        ht.flexivel,
        htd.dia_semana,
        htd.entrada_1,
        htd.saida_1,
        htd.entrada_2,
        htd.saida_2,
        htd.carga_prevista_minutos
      from usuario_horario uh
      inner join horario_trabalho ht
        on ht.id = uh.horario_trabalho_id
      left join horario_trabalho_dia htd
        on htd.horario_trabalho_id = ht.id
       and htd.ativo = true
      where uh.usuario_id = $1
        and uh.ativo = true
        and ht.ativo = true
      order by uh.id asc, htd.dia_semana asc nulls last
    `;
  },

  get_day_off_data: () => {
    return `
      select
        id,
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status,
        created_at
      from day_off
      where usuario_id = $1
        and data_referencia = $2::date
        and status = 'aprovado'
      order by id desc
    `;
  },

  get_day_off_periodo: () => {
    return `
      select
        id,
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status,
        created_at
      from day_off
      where usuario_id = $1
        and data_referencia between $2::date and $3::date
      order by data_referencia asc, id asc
    `;
  },

  get_day_off_by_id: () => {
    return `
      select
        d.id,
        d.usuario_id,
        u.empresa_id,
        u.nome as usuario_nome,
        d.data_referencia,
        d.tipo,
        d.observacao,
        d.status,
        d.created_at
      from day_off d
      inner join usuario u
        on u.id = d.usuario_id
      where d.id = $1
        and u.empresa_id = $2
      limit 1
    `;
  },

  get_day_off_usuario_lista: () => {
    return `
      select
        d.id,
        d.usuario_id,
        u.nome as usuario_nome,
        u.empresa_id,
        d.data_referencia,
        d.tipo,
        d.observacao,
        d.status,
        d.created_at
      from day_off d
      inner join usuario u
        on u.id = d.usuario_id
      where u.empresa_id = $1
        and ($2::bigint is null or d.usuario_id = $2)
        and ($3::date is null or d.data_referencia >= $3::date)
        and ($4::date is null or d.data_referencia <= $4::date)
      order by d.data_referencia desc, d.id desc
    `;
  },

  get_day_off_usuario_data: () => {
    return `
      select
        id,
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status,
        created_at
      from day_off
      where usuario_id = $1
        and data_referencia = $2::date
        and ($3::bigint is null or id <> $3)
      order by id desc
      limit 1
    `;
  },

  inserir_day_off: () => {
    return `
      insert into day_off (
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status
      ) values ($1, $2, $3, $4, $5)
      returning
        id,
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status,
        created_at
    `;
  },

  atualizar_day_off: () => {
    return `
      update day_off
      set
        data_referencia = $2,
        tipo = $3,
        observacao = $4,
        status = $5
      where id = $1
      returning
        id,
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status,
        created_at
    `;
  },

  deletar_day_off: () => {
    return `
      delete from day_off
      where id = $1
      returning
        id,
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status,
        created_at
    `;
  },

  deletar_day_off_usuario_data: () => {
    return `
      delete from day_off
      where usuario_id = $1
        and data_referencia = $2::date
      returning
        id,
        usuario_id,
        data_referencia,
        tipo,
        observacao,
        status,
        created_at
    `;
  },

  get_feriado_data: () => {
    return `
      select
        id,
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
      from feriado
      where empresa_id = $1
        and data_referencia = $2::date
        and ativo = true
    `;
  },

  get_feriado_by_id: () => {
    return `
      select
        id,
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
      from feriado
      where id = $1
        and empresa_id = $2
      limit 1
    `;
  },

  get_feriados_lista: () => {
    return `
      select
        id,
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
      from feriado
      where empresa_id = $1
        and ($2::date is null or data_referencia >= $2::date)
        and ($3::date is null or data_referencia <= $3::date)
      order by data_referencia desc, id desc
    `;
  },

  get_feriado_empresa_data: () => {
    return `
      select
        id,
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
      from feriado
      where empresa_id = $1
        and data_referencia = $2::date
        and ($3::bigint is null or id <> $3)
        and ativo = true
      order by id desc
      limit 1
    `;
  },

  inserir_feriado: () => {
    return `
      insert into feriado (
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
      ) values ($1, $2, $3, $4, $5)
      returning
        id,
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
    `;
  },

  atualizar_feriado: () => {
    return `
      update feriado
      set
        data_referencia = $2,
        descricao = $3,
        tipo = $4,
        ativo = $5
      where id = $1
      returning
        id,
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
    `;
  },

  deletar_feriado: () => {
    return `
      delete from feriado
      where id = $1
      returning
        id,
        empresa_id,
        data_referencia,
        descricao,
        tipo,
        ativo
    `;
  },

  get_usuarios_empresa: () => {
    return `
      select
        id
      from usuario
      where empresa_id = $1
        and ativo = true
      order by id asc
    `;
  },

  get_ferias_data: () => {
    return `
      select
        sf.id,
        sf.usuario_id,
        sf.periodo_ferias_id,
        sf.data_inicio,
        sf.data_fim,
        sf.quantidade_dias,
        sf.status,
        sf.aprovado_por,
        sf.aprovado_em,
        sf.observacao,
        sf.created_at
      from solicitacao_ferias sf
      where sf.usuario_id = $1
        and sf.status = 'aprovado'
        and $2::date between sf.data_inicio and sf.data_fim
      order by sf.id desc
      limit 1
    `;
  },

  get_ferias_by_id: () => {
    return `
      select
        sf.id,
        sf.usuario_id,
        u.empresa_id,
        u.nome as usuario_nome,
        sf.periodo_ferias_id,
        sf.data_inicio,
        sf.data_fim,
        sf.quantidade_dias,
        sf.status,
        sf.aprovado_por,
        sf.aprovado_em,
        sf.observacao,
        sf.created_at
      from solicitacao_ferias sf
      inner join usuario u
        on u.id = sf.usuario_id
      where sf.id = $1
        and u.empresa_id = $2
      limit 1
    `;
  },

  get_ferias_usuario_lista: () => {
    return `
      select
        sf.id,
        sf.usuario_id,
        u.nome as usuario_nome,
        u.empresa_id,
        sf.periodo_ferias_id,
        pf.periodo_aquisitivo_inicio,
        pf.periodo_aquisitivo_fim,
        pf.saldo_dias,
        pf.status as periodo_status,
        sf.data_inicio,
        sf.data_fim,
        sf.quantidade_dias,
        sf.status,
        sf.aprovado_por,
        sf.aprovado_em,
        sf.observacao,
        sf.created_at
      from solicitacao_ferias sf
      inner join usuario u
        on u.id = sf.usuario_id
      inner join periodo_ferias pf
        on pf.id = sf.periodo_ferias_id
      where u.empresa_id = $1
        and ($2::bigint is null or sf.usuario_id = $2)
        and ($3::date is null or sf.data_inicio >= $3::date)
        and ($4::date is null or sf.data_fim <= $4::date)
      order by sf.data_inicio desc, sf.id desc
    `;
  },

  get_ferias_usuario_conflito: () => {
    return `
      select
        id,
        usuario_id,
        data_inicio,
        data_fim,
        quantidade_dias,
        status
      from solicitacao_ferias
      where usuario_id = $1
        and daterange(data_inicio, data_fim + 1, '[)') && daterange($2::date, $3::date + 1, '[)')
        and ($4::bigint is null or id <> $4)
        and status <> 'cancelado'
      order by data_inicio asc, id asc
      limit 1
    `;
  },

  get_periodo_ferias_by_id: () => {
    return `
      select
        id,
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
      from periodo_ferias
      where id = $1
        and usuario_id = $2
      limit 1
    `;
  },

  get_periodo_ferias_disponivel: () => {
    return `
      select
        id,
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
      from periodo_ferias
      where usuario_id = $1
        and saldo_dias >= $2
        and status in ('disponivel', 'parcial')
      order by periodo_aquisitivo_inicio asc, id asc
      limit 1
    `;
  },

  get_periodo_ferias_by_id_empresa: () => {
    return `
      select
        pf.id,
        pf.usuario_id,
        u.nome as usuario_nome,
        u.empresa_id,
        pf.periodo_aquisitivo_inicio,
        pf.periodo_aquisitivo_fim,
        pf.saldo_dias,
        pf.status
      from periodo_ferias pf
      inner join usuario u
        on u.id = pf.usuario_id
      where pf.id = $1
        and u.empresa_id = $2
      limit 1
    `;
  },

  get_periodos_ferias_usuario_lista: () => {
    return `
      select
        pf.id,
        pf.usuario_id,
        u.nome as usuario_nome,
        u.empresa_id,
        pf.periodo_aquisitivo_inicio,
        pf.periodo_aquisitivo_fim,
        pf.saldo_dias,
        pf.status
      from periodo_ferias pf
      inner join usuario u
        on u.id = pf.usuario_id
      where u.empresa_id = $1
        and ($2::bigint is null or pf.usuario_id = $2)
        and ($3::date is null or pf.periodo_aquisitivo_inicio >= $3::date)
        and ($4::date is null or pf.periodo_aquisitivo_fim <= $4::date)
      order by pf.periodo_aquisitivo_inicio desc, pf.id desc
    `;
  },

  get_periodo_ferias_usuario_conflito: () => {
    return `
      select
        id,
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
      from periodo_ferias
      where usuario_id = $1
        and daterange(periodo_aquisitivo_inicio, periodo_aquisitivo_fim + 1, '[)')
          && daterange($2::date, $3::date + 1, '[)')
        and ($4::bigint is null or id <> $4)
      order by periodo_aquisitivo_inicio asc, id asc
      limit 1
    `;
  },

  inserir_periodo_ferias: () => {
    return `
      insert into periodo_ferias (
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
      ) values ($1, $2, $3, $4, $5)
      returning
        id,
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
    `;
  },

  atualizar_periodo_ferias: () => {
    return `
      update periodo_ferias
      set
        periodo_aquisitivo_inicio = $2,
        periodo_aquisitivo_fim = $3,
        saldo_dias = $4,
        status = $5
      where id = $1
      returning
        id,
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
    `;
  },

  atualizar_saldo_periodo_ferias: () => {
    return `
      update periodo_ferias
      set
        saldo_dias = $2,
        status = $3
      where id = $1
      returning
        id,
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
    `;
  },

  get_periodo_ferias_vinculos: () => {
    return `
      select
        count(*)::int as total
      from solicitacao_ferias
      where periodo_ferias_id = $1
    `;
  },

  deletar_periodo_ferias: () => {
    return `
      delete from periodo_ferias
      where id = $1
      returning
        id,
        usuario_id,
        periodo_aquisitivo_inicio,
        periodo_aquisitivo_fim,
        saldo_dias,
        status
    `;
  },

  inserir_ferias: () => {
    return `
      insert into solicitacao_ferias (
        usuario_id,
        periodo_ferias_id,
        data_inicio,
        data_fim,
        quantidade_dias,
        status,
        aprovado_por,
        aprovado_em,
        observacao
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning
        id,
        usuario_id,
        periodo_ferias_id,
        data_inicio,
        data_fim,
        quantidade_dias,
        status,
        aprovado_por,
        aprovado_em,
        observacao,
        created_at
    `;
  },

  atualizar_ferias: () => {
    return `
      update solicitacao_ferias
      set
        periodo_ferias_id = $2,
        data_inicio = $3,
        data_fim = $4,
        quantidade_dias = $5,
        status = $6,
        aprovado_por = $7,
        aprovado_em = $8,
        observacao = $9
      where id = $1
      returning
        id,
        usuario_id,
        periodo_ferias_id,
        data_inicio,
        data_fim,
        quantidade_dias,
        status,
        aprovado_por,
        aprovado_em,
        observacao,
        created_at
    `;
  },

  deletar_ferias: () => {
    return `
      delete from solicitacao_ferias
      where id = $1
      returning
        id,
        usuario_id,
        periodo_ferias_id,
        data_inicio,
        data_fim,
        quantidade_dias,
        status,
        aprovado_por,
        aprovado_em,
        observacao,
        created_at
    `;
  },

  get_justificativas_data: () => {
    return `
      select
        j.id,
        j.usuario_id,
        j.tipo_justificativa_id,
        jt.descricao as tipo,
        jt.descricao as tipo_descricao,
        jt.has_text,
        j.data_inicio,
        j.data_fim,
        j.descricao,
        j.status,
        j.aprovado_por,
        j.aprovado_em,
        j.motivo_recusa,
        j.created_at
      from justificativa j
      left join justificativa_tipo jt
        on jt.id = j.tipo_justificativa_id
      where j.usuario_id = $1
        and j.status = 'aprovado'
        and $2::date between j.data_inicio::date and j.data_fim::date
      order by j.data_inicio asc, j.id asc
    `;
  },

  get_justificativa_tipo_select: () => {
    return `
      select
        id,
        descricao,
        has_text,
        has_anexo
      from justificativa_tipo
      where ativo = true
      order by descricao asc, id asc
    `;
  },

  get_justificativa_tipo_by_id: () => {
    return `
      select
        id,
        descricao,
        has_text, 
        has_anexo
      from justificativa_tipo
      where id = $1
        and ativo = true
    `;
  },

  get_justificativas_lista: () => {
    return `
      select
        j.id,
        j.usuario_id,
        u.nome as usuario_nome,
        u.empresa_id,
        j.tipo_justificativa_id,
        jt.descricao as tipo,
        jt.descricao as tipo_descricao,
        jt.has_text,
        j.data_inicio,
        j.data_fim,
        j.descricao,
        j.status,
        j.aprovado_por,
        ua.nome as aprovado_por_nome,
        j.aprovado_em,
        j.motivo_recusa,
        j.created_at,
        coalesce(
          json_agg(
            json_build_object(
              'id', ja.id,
              'nome_arquivo', ja.nome_arquivo,
              'url', ja.url,
              'mime_type', ja.mime_type,
              'created_at', ja.created_at
            )
          ) filter (where ja.id is not null),
          '[]'::json
        ) as anexos
      from justificativa j
      inner join usuario u
        on u.id = j.usuario_id
      left join usuario ua
        on ua.id = j.aprovado_por
      left join justificativa_tipo jt
        on jt.id = j.tipo_justificativa_id
      left join justificativa_anexo ja
        on ja.justificativa_id = j.id
      where u.empresa_id = $1
        and ($2::bigint is null or j.usuario_id = $2)
        and ($3::text is null or j.status = $3)
        and ($4::date is null or j.data_inicio::date >= $4::date)
        and ($5::date is null or j.data_fim::date <= $5::date)
      group by
        j.id,
        u.nome,
        u.empresa_id,
        jt.descricao,
        jt.has_text,
        ua.nome
      order by j.created_at desc, j.id desc
    `;
  },

  get_justificativa_by_id: () => {
    return `
      select
        j.id,
        j.usuario_id,
        u.empresa_id,
        j.tipo_justificativa_id,
        jt.descricao as tipo,
        jt.descricao as tipo_descricao,
        jt.has_text,
        j.data_inicio,
        j.data_fim,
        j.descricao,
        j.status,
        j.aprovado_por,
        j.aprovado_em,
        j.motivo_recusa,
        j.created_at
      from justificativa j
      inner join usuario u
        on u.id = j.usuario_id
      left join justificativa_tipo jt
        on jt.id = j.tipo_justificativa_id
      where j.id = $1
        and u.empresa_id = $2
    `;
  },

  atualizar_status_justificativa: () => {
    return `
      update justificativa
      set
        status = $2,
        aprovado_por = $3,
        aprovado_em = now(),
        motivo_recusa = $4
      where id = $1
      returning
        id,
        usuario_id,
        tipo_justificativa_id,
        data_inicio,
        data_fim,
        descricao,
        status,
        aprovado_por,
        aprovado_em,
        motivo_recusa,
        created_at
    `;
  },

  upsert_apuracao_ponto_diaria: () => {
    return `
      insert into apuracao_ponto_diaria (
        usuario_id,
        data_referencia,
        minutos_previstos,
        minutos_trabalhados,
        minutos_abonados,
        minutos_extras,
        minutos_falta,
        saldo_minutos,
        status
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (usuario_id, data_referencia)
      do update set
        minutos_previstos = excluded.minutos_previstos,
        minutos_trabalhados = excluded.minutos_trabalhados,
        minutos_abonados = excluded.minutos_abonados,
        minutos_extras = excluded.minutos_extras,
        minutos_falta = excluded.minutos_falta,
        saldo_minutos = excluded.saldo_minutos,
        status = excluded.status
      returning
        id,
        usuario_id,
        data_referencia,
        minutos_previstos,
        minutos_trabalhados,
        minutos_abonados,
        minutos_extras,
        minutos_falta,
        saldo_minutos,
        status
    `;
  },

  get_apuracao_periodo: () => {
    return `
      select
        apd.id,
        apd.usuario_id,
        apd.data_referencia,
        apd.minutos_previstos,
        apd.minutos_trabalhados,
        apd.minutos_abonados,
        apd.minutos_extras,
        apd.minutos_falta,
        apd.saldo_minutos,
        apd.status
      from apuracao_ponto_diaria apd
      inner join usuario u
        on u.id = apd.usuario_id
      where apd.usuario_id = $1
        and u.empresa_id = $2
        and apd.data_referencia between $3::date and $4::date
      order by apd.data_referencia asc
    `;
  },

  limpar_banco_horas_apuracao: () => {
    return `
      delete from banco_horas_lancamento
      where usuario_id = $1
        and data_referencia = $2::date
        and origem = 'apuracao_diaria'
    `;
  },

  inserir_banco_horas_lancamento: () => {
    return `
      insert into banco_horas_lancamento (
        usuario_id,
        data_referencia,
        tipo,
        minutos,
        origem,
        referencia_id,
        observacao
      ) values ($1, $2, $3, $4, $5, $6, $7)
      returning
        id,
        usuario_id,
        data_referencia,
        tipo,
        minutos,
        origem,
        referencia_id,
        observacao,
        created_at
    `;
  },

  get_banco_horas_periodo: () => {
    return `
      select
        id,
        usuario_id,
        data_referencia,
        tipo,
        minutos,
        origem,
        referencia_id,
        observacao,
        created_at
      from banco_horas_lancamento
      where usuario_id = $1
        and data_referencia between $2::date and $3::date
      order by data_referencia asc, id asc
    `;
  },

  get_banco_horas_saldo: () => {
    return `
      select
        coalesce(sum(
          case
            when tipo = 'credito' then minutos
            when tipo = 'debito' then minutos * -1
            else 0
          end
        ), 0) as saldo_minutos
      from banco_horas_lancamento
      where usuario_id = $1
    `;
  },

  inserir_justificativa: () => {
    return `
      insert into justificativa (
        usuario_id,
        tipo_justificativa_id,
        data_inicio,
        data_fim,
        descricao,
        status
      ) values ($1, $2, $3, $4, $5, $6)
      returning
        id,
        usuario_id,
        tipo_justificativa_id,
        data_inicio,
        data_fim,
        descricao,
        status,
        aprovado_por,
        aprovado_em,
        motivo_recusa,
        created_at
    `;
  },

  inserir_justificativa_anexo: () => {
    return `
      insert into justificativa_anexo (
        justificativa_id,
        nome_arquivo,
        url,
        mime_type
      ) values ($1, $2, $3, $4)
      returning
        id,
        justificativa_id,
        nome_arquivo,
        url,
        mime_type,
        created_at
    `;
  }
};

module.exports = models;
