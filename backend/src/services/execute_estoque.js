const models = require("../models/models_estoque");
const { postgres } = require("../server/connect");

const execute = {
  execute_verify_fabricante: async (cnpj, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.verify_fabricante(), [
        cnpj,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
  execute_verify_fabricante_by_name: async (nome, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.verify_fabricante_by_name(), [
        nome,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_resolve_filial_id: async (empresa_id, filial_id, filial_nome) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.resolve_filial(), [
        empresa_id,
        filial_id,
        filial_nome,
      ]);
      return ret.rows[0]?.id || null;
    } finally {
      client.release();
    }
  },

  execute_create_fabricante: async (
    nome,
    cnpj,
    telefone,
    email,
    empresa_id,
    contato
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.create_fabricante(), [
        nome,
        cnpj,
        telefone,
        email,
        empresa_id,
        contato,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_listar_fabricante: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.list_fabricante(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
  execute_update_fabricante: async (
    nome,
    telefone,
    email,
    fabricante_id,
    contato
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.update_fabricante(), [
        nome,
        telefone,
        email,
        fabricante_id,
        contato,
      ]);
    } finally {
      client.release();
    }
  },

  execute_delete_fabricante: async (fabricante_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.delete_fabricante(), [fabricante_id]);
    } finally {
      client.release();
    }
  },

  execute_expurgar_produtos: async (fabricante_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.expurgar_produtos(), [fabricante_id]);
    } finally {
      client.release();
    }
  },

  execute_listar_produtos: async (
    empresa_id,
    pagina,
    limite,
    pesquisa // <-- NOVO
  ) => {
    const client = await postgres.connect();
    try {
      // Calcula o offset
      const offset = (pagina - 1) * limite;
      const likePesquisa = `%${pesquisa}%`;

      // Passa os 3 parâmetros para a query
      const ret = await client.query(models.listar_produtos(), [
        empresa_id,
        limite,
        offset,
        likePesquisa,
      ]);

      // Extrai o total (vem repetido em todas as linhas, pegamos do primeiro)
      const totalProdutos =
        ret.rows.length > 0 ? Number(ret.rows[0].totalProdutos) : 0;

      // Limpa o campo 'totalProdutos' de cada item antes de retornar
      const produtos = ret.rows.map((p) => {
        delete p.totalProdutos;
        return p;
      });

      // Retorna o objeto esperado pelo frontend
      return { produtos, totalProdutos };
    } finally {
      client.release();
    }
  },

  execute_get_estoque_filial: async (produto_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_estoque_filial(), [produto_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_listar_movimentacao: async (produto_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.listar_movimentacao(), [
        produto_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_valida_produto: async (sck, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.valida_produto(), [
        sck,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_insert_produto: async (
    name,
    sku,
    costPrice,
    salePrice,
    empresa_id,
    fabricante,
    peso
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.insert_produto(), [
        name,
        sku,
        costPrice,
        salePrice,
        empresa_id,
        fabricante,
        peso,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_insert_estoque: async (
    id,
    filial_id,
    empresa_id,
    total,
    mainStock,
    howcaseStock
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.insert_estoque(), [
        id,
        filial_id,
        empresa_id,
        total,
        mainStock,
        howcaseStock,
      ]);
    } finally {
      client.release();
    }
  },

  execute_get_produto_by_id: async (produto_id, empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_produto_by_id(), [
        produto_id,
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },


  execute_get_ultimo_produto: async (empresa_id) =>{
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_ultimo_produto(), [
        empresa_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_delete_product: async (produto_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.delete_product(), [produto_id]);
    } finally {
      client.release();
    }
  },

  execute_update_produto: async (
    name,
    costPrice,
    salePrice,
    suplyer,
    sku,
    id,
    promoPrice,
    promoStartDate,
    promoEndDate,
    usuario_id,
    empresa_id
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.update_produto(), [
        name,
        costPrice,
        salePrice,
        suplyer,
        sku,
        id,
        promoPrice,
        promoStartDate,
        promoEndDate,
        usuario_id,
        empresa_id,
      ]);
    } finally {
      client.release();
    }
  },

  execute_insert_produto_categoria: async (categoria_id, produto_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.insert_produto_categoria(), [
        categoria_id,
        produto_id,
      ]);
    } finally {
      client.release();
    }
  },

  execute_get_categorias: async (produto_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_categorias(), [produto_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_busca_fabricante: async (pesquisa, empresa_id) => {
    const client = await postgres.connect();
    try {
      const rearch = "%" + pesquisa + "%";
      const ret = await client.query(models.busca_fabricante(), [rearch, empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_insert_pedido_compra: async (
    usuario_id,
    filial_id = 1,
    empresa_id,
    status
  ) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.insert_pedido_compra(), [
        usuario_id,
        filial_id,
        empresa_id,
        status,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_insert_produto_entrada: async (
    produto_id,
    entrada_id,
    fornecedor_id,
    qt,
    costPrice
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.insert_produto_entrada(), [
        produto_id,
        entrada_id,
        fornecedor_id,
        qt,
        costPrice,
      ]);
    } finally {
      client.release();
    }
  },

  execute_get_lista_entrada: async (empresa_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_lista_entrada(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_lista_entrada_id: async (entrada_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_lista_entrada_id(), [
        entrada_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_items_entrada: async (entrada_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_items_entrada(), [entrada_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
  execute_receber_pedido: async (entrada_id, usuario_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.receber_pedido(), [entrada_id, usuario_id]);
    } finally {
      client.release();
    }
  },

  execute_get_produto_entrada_by_id: async (entrada_id) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_produto_entrada_by_id(), [
        entrada_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_estoque_manual: async (
    produto_id,
    filial_id,
    empresa_id,
    mainStock,
    showcaseStock
  ) => {
    const client = await postgres.connect();
    try {
      const normalizedMainStock = Number(mainStock) || 0;
      const normalizedShowcaseStock = Number(showcaseStock) || 0;
      // Usamos a query de insert com on conflict (upsert) para garantir
      // que se o produto não tinha estoque naquela filial, ele cria.
      await client.query(models.insert_estoque_manual(), [
        produto_id,
        filial_id,
        empresa_id,
        normalizedMainStock,
        normalizedShowcaseStock,
        normalizedMainStock + normalizedShowcaseStock,
      ]);
    } finally {
      client.release();
    }
  },

  execute_insert_estoque_entrada: async (
    produto_id,
    empresa_id,
    filial_id,
    quantidade
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.insert_estoque_entrada(), [
        produto_id,
        empresa_id,
        filial_id,
        quantidade,
        quantidade,
      ]);
    } finally {
      client.release();
    }
  },

  execute_create_promotion: async (
    produto_id,
    valor,
    inicio,
    fim,
    usuario_id
  ) => {
    const client = await postgres.connect();
    try {
      await client.query(models.create_promotion(), [
        produto_id,
        valor,
        inicio,
        fim,
        usuario_id,
      ]);
    } finally {
      client.release();
    }
  },

  execute_remove_promotion: async (produto_id) => {
    const client = await postgres.connect();
    try {
      await client.query(models.remove_promotion(), [produto_id]);
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
