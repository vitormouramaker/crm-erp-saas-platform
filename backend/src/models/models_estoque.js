const models = {
  verify_fabricante: () => {
    return `
        select * from fabricante where cnpj_cpf = $1 and empresa_id = $2
        `;
  },
  verify_fabricante_by_name: () => {
    return `
        select id, cnpj_cpf as cnpj, nome as name, contato as "contactPerson", telefone as phone, email
        from fabricante
        where upper(nome) = upper($1) and empresa_id = $2
        limit 1
        `;
  },
  create_fabricante: () => {
    return `
        INSERT INTO public.fabricante(
	        nome, cnpj_cpf, telefone, email, empresa_id, contato)
	    VALUES ($1, $2, $3, $4, $5, $6)
        returning id, cnpj_cpf as cnpj, nome as name, contato as "contactPerson", telefone as phone, email;
        `;
  },

  list_fabricante: () => {
    return `
        select 
        id,
        nome as name,
        cnpj_cpf as cnpj,
        contato as  "contactPerson",
        telefone as phone,
        email
        from fabricante where empresa_id = $1
        `;
  },

  resolve_filial: () => {
    return `
        select id
        from empresa_filial
        where empresa_id = $1
          and (
            id = $2
            or upper(trim(nome)) = upper(trim($3))
          )
        order by
          case when id = $2 then 0 else 1 end,
          case when primaria = true then 0 else 1 end,
          id asc
        limit 1
        `;
  },

  verify_fabricante: () => {
    return `
        select 
        id,
        nome as name,
        contato as  contactPerson,
        telefone as phone,
        email
        from fabricante where empresa_id = $2 and cnpj_cpf = $1
        `;
  },

  update_fabricante: () => {
    return `
        update fabricante set nome = $1, telefone = $2, email = $3, contato = $5 where id = $4
        `;
  },

  delete_fabricante: () => {
    return `
        delete from fabricante where id = $1
        `;
  },

  expurgar_produtos: () => {
    return `
        delete from produto where fabricante_id = $1
        `;
  },

  listar_produtos: () => {
    /*
      Esta query otimizada:
      1. Usa CTE (WITH Paginados) para performance.
      2. Agrega categorias E estoque (stockByFilial) usando json_agg.
      3. Faz a contagem total de produtos (COUNT(*) OVER()) sem ser afetada pelo LIMIT.
      4. Aceita $1 (empresa_id), $2 (limite) e $3 (offset) como parâmetros.
    */
    return `
    WITH Paginados AS (
      SELECT 
          p.id,
          p.nome as name,
          p.cd_barra as sku,
          f.nome as "supplierName",
          p.preco as "costPrice",
          p.preco_venda as "salePrice",
		  p.preco_promocional as "promotionPrice",
		  p.inicio_promocao as "promoStartDate",
		  p.fim_promocao as "promoEndDate",
      u.nome as "offerCreatedBy",
		  
          case when p.unidade_medida = 'PESO' then true else false end as "isSoldByWeight",
          
          -- 1. Contagem total
          COUNT(*) OVER() as "totalProdutos",

          -- 2. Categorias (como já estava)
          COALESCE(
              json_agg(
                  DISTINCT jsonb_build_object('id', c.id, 'name', c.nome)
              ) FILTER (WHERE c.id IS NOT NULL), 
              '[]'
          ) as categories,
          
          -- 3. Estoque (Agregado)
          COALESCE(
              json_agg(
                  DISTINCT jsonb_build_object(
                      'id', pe.filial_id,
                      'filial', ef.nome, 
                      'mainStock', pe.qt_estoque, 
                      'showcaseStock', pe.qt_vitrine
                  )
              ) FILTER (
                WHERE pe.produto_id IS NOT NULL
                  AND pe.filial_id IS NOT NULL
                  AND ef.id IS NOT NULL
              ),
              '[]'
          ) as "stockByFilial"

      FROM produto p
      LEFT JOIN produto_categoria pc ON pc.produto_id = p.id
      LEFT JOIN categoria c ON c.id = pc.categoria_id
      LEFT JOIN fabricante f ON f.id = p.fabricante_id
      LEFT JOIN produto_estoque pe ON pe.produto_id = p.id
      LEFT JOIN empresa_filial ef ON ef.id = pe.filial_id
      LEFT JOIN usuario u ON u.id = p.usuario_promocao
      WHERE p.empresa_id = $1 -- $1 = empresa_id
        AND (
            p.nome ILIKE $4 OR
            p.cd_barra ILIKE $4
        ) -- $4 = likePesquisa
      GROUP BY p.id, f.nome, u.nome
      )
      SELECT * FROM Paginados
      ORDER BY name ASC
      LIMIT $2 -- $2 = limite
      OFFSET $3; -- $3 = offset
    `;
  },

  get_estoque_filial: () => {
    return `
        select 
            pe.filial_id as id,
            ef.nome as filial,
            pe.qt_estoque as "mainStock",
            pe.qt_vitrine as "showcaseStock"
        from produto_estoque pe
        left join empresa_filial ef on
            ef.id = pe.filial_id
        where 
            produto_id = $1
            and pe.filial_id is not null
        `;
  },

  listar_movimentacao: () => {
    return `
        select
            pem.data_movimentacao as data,
            pemt.descricao as type,
            pem.quantidade as quantity,
            u.nome as user,
            pem.observacao as reason,
            pem.filial_id as "fromFilial"
        from produto_estoque_movimentacao pem
        left join produto_estoque_movimentacao_tipo pemt on
            pemt.id = pem.movimentacao_tipo_id
        left join usuario u on
            u.id = pem.usuario_id
        where pem.produto_id = $1
        `;
  },

  valida_produto: () => {
    return `
        select * from produto where cd_barra = $1 and empresa_id = $2
        `;
  },

  insert_produto: () => {
    return `
        insert into produto (nome, cd_barra, preco, preco_venda, empresa_id, fabricante_id, unidade_medida)
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          (
            select id
            from fabricante
            where empresa_id = $5
              and upper(trim(nome)) = upper(trim($6))
            order by id asc
            limit 1
          ),
          $7
        )
        returning id
        `;
  },

  insert_estoque: () => {
    return `
        INSERT INTO public.produto_estoque(
	produto_id, filial_id, empresa_id, tot_it, qt_estoque, qt_vitrine)
	VALUES ($1, $2, $3, $4, $5, $6);
        `;
  },

  get_ultimo_produto: () =>{
    return `
      select 
        id,
        cd_barra,
        cd_barra as sku
      from produto 
      where empresa_id = $1 
      order by id desc
      limit 1
    `
  },

  get_produto_by_id: () => {
    return `
        select 
            p.id,
            p.nome as name,
            p.cd_barra as sku,
            c.nome as category,
            f.nome as "supplierName",
            p.preco as "costPrice",
            p.preco_venda as "salePrice"
        from produto p
        left join produto_categoria pc on
            pc.produto_id = p.id
        left join categoria c on
            c.id = pc.categoria_id
        left join fabricante f on
            f.id = p.fabricante_id
        where 
            p.id = $1 and
            p.empresa_id = $2
        `;
  },

  delete_product: () => {
    return `
        delete from produto where id = $1
        `;
  },

  update_produto: () => {
    return `
        update produto set 
          nome = $1, 
          preco = $2, 
          preco_venda = $3, 
          fabricante_id = (
            select id
            from fabricante
            where empresa_id = $11
              and upper(trim(nome)) = upper(trim($4))
            order by id asc
            limit 1
          ),
          cd_barra = COALESCE($5, cd_barra),
          preco_promocional = $7,
          inicio_promocao = $8,
          fim_promocao = $9,
          usuario_promocao = $10
        where id = $6
          and empresa_id = $11
        `;
  },

  insert_produto_categoria: () => {
    return `insert into produto_categoria (categoria_id, produto_id) values ($1, $2)`;
  },

  get_categorias: () => {
    return `select 
c.id, c.nome as name 
from produto_categoria 
left join categoria c on
c.id = categoria_id
where produto_id = $1`;
  },

  busca_fabricante: () => {
    // Retorna o ID e o NOME, pois o frontend precisará do ID para salvar.
    return "select id, nome as name from fabricante where nome ilike $1 and empresa_id = $2 limit 20";
  },

  // =========================================================
  // ================= QUERIES FALTANTES =====================
  // =========================================================

  insert_pedido_compra: () => {
    return `
    INSERT INTO public.entrada(
      usuario_id, filial_id, empresa_id, status, data_recebimento
    )
    VALUES ($1, $2, $3, $4, current_timestamp)
    RETURNING id;
    `;
  },

  insert_produto_entrada: () => {
    // CORRIGIDO: Adicionado $5 (custo_unitario)
    return `
    INSERT INTO public.produto_entrada(
      produto_id, entrada_id, fornecedor_id, quantidade, custo_unitario
    )
    VALUES ($1, $2, $3, $4, $5);
    `;
  },

  get_lista_entrada: () => {
    // Query para listar todos os pedidos
    return `
    SELECT 
      pc.id,
      f.nome as "supplierName",
      ef.nome as filial,
      pc.status,
      pc.data_criacao,
      u_sol.nome as "solicitado_por",
      pc.data_recebimento,
      u_rec.nome as "recebido_por",
      (SELECT SUM(pci.quantidade * pci.custo_unitario) FROM produto_entrada pci WHERE pci.entrada_id = pc.id) as "totalValue",
      (SELECT SUM(pci.quantidade) FROM produto_entrada pci WHERE pci.entrada_id = pc.id) as "totalItems"
    FROM entrada pc
    LEFT JOIN usuario u_sol ON u_sol.id = pc.usuario_id
    LEFT JOIN usuario u_rec ON u_rec.id = pc.usuario_recebedor_id
    LEFT JOIN empresa_filial ef ON ef.id = pc.filial_id
    -- Pega o fornecedor do *primeiro item* (assumindo 1 fornecedor por pedido)
    LEFT JOIN produto_entrada pci_f ON pci_f.entrada_id = pc.id
    LEFT JOIN fabricante f ON f.id = pci_f.fornecedor_id
    WHERE pc.empresa_id = $1
    GROUP BY pc.id, f.nome, ef.nome, u_sol.nome, u_rec.nome
    ORDER BY pc.data_criacao DESC;
    `;
  },

  get_lista_entrada_id: () => {
    // Query para buscar 1 pedido (usado após a criação)
    return `
    SELECT 
      pc.id,
      f.nome as "supplierName",
      ef.nome as filial,
      pc.status,
      pc.data_criacao,
      u_sol.nome as "solicitado_por",
      pc.data_recebimento,
      u_rec.nome as "recebido_por",
      (SELECT SUM(pci.quantidade * pci.custo_unitario) FROM produto_entrada pci WHERE pci.entrada_id = pc.id) as "totalValue"
    FROM entrada pc
    LEFT JOIN usuario u_sol ON u_sol.id = pc.usuario_id
    LEFT JOIN usuario u_rec ON u_rec.id = pc.usuario_recebedor_id
    LEFT JOIN empresa_filial ef ON ef.id = pc.filial_id
    LEFT JOIN produto_entrada pci_f ON pci_f.entrada_id = pc.id
    LEFT JOIN fabricante f ON f.id = pci_f.fornecedor_id
    WHERE pc.id = $1
    GROUP BY pc.id, f.nome, ef.nome, u_sol.nome, u_rec.nome;

    `;
  },

  get_items_entrada: () => {
    // Query para listar os itens de 1 pedido
    return `
    SELECT 
      pci.produto_id as "productId",
      p.nome as "productName",
      p.cd_barra as sku,
      pci.quantidade,
      pci.custo_unitario as "costPrice"
    FROM produto_entrada pci
    LEFT JOIN produto p ON p.id = pci.produto_id
    WHERE pci.entrada_id = $1;
    `;
  },

  receber_pedido: () => {
    return `
    UPDATE entrada
    SET status = 'Recebido',
        usuario_recebedor_id = $2,
        data_recebimento = current_timestamp
    WHERE id = $1;
    `;
  },

  get_produto_entrada_by_id: () => {
    // Query para pegar os itens e filial para dar entrada no estoque
    return `
    SELECT 
      pci.produto_id,
      pc.empresa_id,
      pc.filial_id,
      pci.quantidade
    FROM produto_Entrada pci
    LEFT JOIN entrada pc ON pc.id = pci.entrada_id
    WHERE pci.entrada_id = $1;
    `;
  },

  // NOVA QUERY: Atualiza a quantidade direta no banco (CUIDADO: Sem histórico de movimentação)
  update_estoque_manual: () => {
    return `
      UPDATE produto_estoque 
      SET qt_estoque = $3, qt_vitrine = $4, ultima_att = NOW()
      WHERE produto_id = $1 AND filial_id = $2
    `;
  },

  // Caso a filial não existisse para esse produto, insere (Upsert manual)
  insert_estoque_manual: () => {
    return `
      INSERT INTO produto_estoque (produto_id, filial_id, empresa_id, tot_it, qt_estoque, qt_vitrine)
      VALUES ($1, $2, $3, $6 , $4, $5)
      ON CONFLICT (produto_id, filial_id, empresa_id) 
      DO UPDATE SET
        tot_it = EXCLUDED.tot_it,
        qt_estoque = EXCLUDED.qt_estoque,
        qt_vitrine = EXCLUDED.qt_vitrine,
        ultima_att = NOW();
      `;
  },

  create_promotion: () => {
    return `
    update produto set preco_promocional = $2, inicio_promocao = $3, fim_promocao = $4, usuario_promocao = $5 where id = $1
    `;
  },

  remove_promotion: async () => {
    return `
     update produto set preco_promocional = null, inicio_promocao = null, fim_promocao = null where id = $1
    `;
  },
};

module.exports = models;
