const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const { requireTenantOwnership, requireMasterOrPermission } = require("../security/tenant_guard");
const execute = require("../services/execute_estoque");
const utils = require("../utils/templates");

//////////////////////////////fabricante//////////////////////////////////////////////////////

rota.post("/cadastro_fabricante", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const nome = String(data.name || "").trim();
    const cnpj = String(data.cnpj || "").trim();

    if (!nome) {
      return res.json(utils.jsonMount(false, {}, "Informe o nome do fornecedor."));
    }

    const verifyByName = await execute.execute_verify_fabricante_by_name(
      nome,
      data.empresa_id
    );
    if (verifyByName.length > 0) {
      return res.json(
        utils.jsonMount(true, verifyByName[0], "Fornecedor ja cadastrado!")
      );
    }

    if (cnpj) {
      const verify = await execute.execute_verify_fabricante(
        cnpj,
        data.empresa_id
      );
      if (verify.length > 0) {
        return res.json(
          utils.jsonMount(true, verify[0], "Fornecedor ja cadastrado!")
        );
      }
    }
    const fabric = await execute.execute_create_fabricante(
      nome,
      cnpj,
      data.phone || "",
      data.email || "",
      data.empresa_id,
      data.contactPerson || ""
    );
    return res.json(
      utils.jsonMount(true, fabric[0], "Fornecedor criado com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastro_fabricante"));
  }
});

rota.post("/lista_fabricante", async (req, res) => {
  try {
    const payload = req.body; // <-- CORREÇÃO A: Pega o objeto { payload: "..." }
    const data = security.jwtdecript(payload); // <-- data agora é descriptografado corretamente

    // CORREÇÃO B: Adiciona a verificação de segurança
    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    // FIM DA CORREÇÃO B

    const fabricantes = await execute.execute_listar_fabricante(
      data.empresa_id
    );
    return res.json(utils.jsonMount(true, fabricantes, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/lista_fabricante"));
  }
});

rota.post("/editar_fabricante", requireTenantOwnership([["id", "fabricante"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    await execute.execute_update_fabricante(
      data.name,
      data.phone,
      data.email,
      data.id,
      data.contactPerson
    );
    return res.json(
      utils.jsonMount(true, {}, "fabricante atualizado com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_fabricante"));
  }
});

rota.post("/deletar_fabricante", requireTenantOwnership([["fabricante_id", "fabricante"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    await execute.execute_delete_fabricante(data.fabricante_id);
    if (data.delete_all === true) {
      await execute.execute_expurgar_produtos(data.fabricante_id);
    }
    return res.json(
      utils.jsonMount(true, {}, "fabricante removido com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_fabricante"));
  }
});

rota.post("/busca_fabricante", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const filial = await execute.execute_busca_fabricante(data.pesquisa, data.empresa_id);
    return res.json(
      utils.jsonMount(true, filial, "fabricante removido com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/busca_fabricante"));
  }
});

/////////////////////////////////////produto///////////////////////////////////////////////////////

rota.post("/cadastro_promocao", requireTenantOwnership([["productId", "produto"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    await execute.execute_create_promotion(
      data.productId,
      data.promoPrice,
      data.promoStartDate,
      data.promoEndDate,
      data.offerCreatedBy
    );
    return res.json(utils.jsonMount(true, {}, "Promoção cadastrada!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastro_promocao"));
  }
});

rota.post("/remover_promocao", requireTenantOwnership([["productId", "produto"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    await execute.execute_remove_promotion(data.productId);
    return res.json(utils.jsonMount(true, {}, "Promoção removida!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/remover_promocao"));
  }
});

rota.post("/cadastro_produto", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const is_peso = data.isSoldByWeight ? "PESO" : "UNIDADE";
    const valida_produto = await execute.execute_valida_produto(
      data.sku,
      data.empresa_id
    );
    if (valida_produto.length > 0) {
      return res.json(utils.jsonMount(false, {}, "SKU ja cadastrada!"));
    }
    const produto = await execute.execute_insert_produto(
      data.name,
      data.sku,
      data.costPrice,
      data.salePrice,
      data.empresa_id,
      data.supplierName,
      is_peso
    );
    for (const stock of data.stockByFilial) {
      const filialId = Number(stock.id);
      if (!Number.isFinite(filialId) || filialId <= 0) continue;

      await execute.execute_insert_estoque(
        produto[0].id,
        filialId,
        data.empresa_id,
        stock.mainStock + stock.showcaseStock,
        stock.mainStock,
        stock.showcaseStock
      );
    }
    await Promise.all(
      data.categories.map(async (categoria) => {
        execute.execute_insert_produto_categoria(categoria.id, produto[0].id);
      })
    );
    const prod = await execute.execute_get_produto_by_id(
      produto[0].id,
      data.empresa_id
    );
    prod[0].stockByFilial = await execute.execute_get_estoque_filial(
      prod[0].id
    );
    prod[0].movementHistory = await execute.execute_listar_movimentacao(
      prod[0].id
    );
    prod[0].categories = await execute.execute_get_categorias(prod[0].id);
    return res.json(utils.jsonMount(true, prod[0], ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastro_produto"));
  }
});


rota.post('/ultimo_produto', async (req,res) =>{
  try{
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const produto = await execute.execute_get_ultimo_produto(data.empresa_id)
    return res.json(utils.jsonMount(true, produto[0] || null, ''))
  }catch(error){
    return res.json(utils.errorHandle(error, "/ultimo_produto"));
  }
})


rota.post("/lista_produtos", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    // Define padrões de paginação se não forem enviados
    const pagina = data.pagina || 1;
    const limite = data.limite || 20;
    const pesquisa = data.pesquisa || "";

    // Chama o executor com os novos parâmetros
    const resultado = await execute.execute_listar_produtos(
      data.empresa_id,
      pagina,
      limite,
      pesquisa
    );
    if (resultado.produtos.length <= 0) {
      return res.json(
        utils.jsonMount(
          false,
          { produtos: [], totalProdutos: 0 },
          "Nenhum produto cadastrado!"
        )
      );
    }

    // REMOVIDO: O loop Promise.all não é mais necessário.
    // A query SQL já traz 'stockByFilial' e 'categories'.

    return res.json(utils.jsonMount(true, resultado, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/lista_produtos"));
  }
});

rota.post("/deletar_produto", requireTenantOwnership([["produto_id", "produto"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    await execute.execute_delete_product(data.produto_id);
    return res.json(utils.jsonMount(true, {}, "Produto removido com sucesso!"));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastro_produto"));
  }
});

rota.post("/editar_produto", requireTenantOwnership([["id", "produto"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const sku = data.sku == null ? null : String(data.sku).trim();

    if (data.sku != null && !sku) {
      return res.json(utils.jsonMount(false, {}, "Informe o SKU do produto."));
    }

    if (sku) {
      const valida_produto = await execute.execute_valida_produto(
        sku,
        data.empresa_id
      );
      const skuJaUsado = valida_produto.some(
        (produto) => Number(produto.id) !== Number(data.id)
      );

      if (skuJaUsado) {
        return res.json(utils.jsonMount(false, {}, "SKU ja cadastrada!"));
      }
    }

    // 1. Atualiza dados básicos + usuario_promocao
    await execute.execute_update_produto(
      data.name,
      data.costPrice,
      data.salePrice,
      data.supplierName,
      sku,
      data.id,
      data.promoPrice,
      data.promoStartDate,
      data.promoEndDate,
      data.offerCreatedBy, // <--- NOVO (Enviado pelo Front)
      data.empresa_id
    );

    // 2. Atualiza o estoque (MANTIDO IGUAL)
    if (data.stockByFilial && Array.isArray(data.stockByFilial)) {
      for (const stock of data.stockByFilial) {
        const requestedFilialId = Number(stock.id);
        const filialId = await execute.execute_resolve_filial_id(
          data.empresa_id,
          Number.isFinite(requestedFilialId) ? requestedFilialId : null,
          stock.filial || stock.name || ""
        );

        if (!filialId) continue;

        await execute.execute_update_estoque_manual(
          data.id,
          filialId,
          data.empresa_id,
          stock.mainStock,
          stock.showcaseStock
        );
      }
    }

    return res.json(
      utils.jsonMount(true, {}, "Dados e estoque atualizados com sucesso!")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_produto"));
  }
});

////////////////////movimentação//////////////////////////////////

rota.post("/cadastro_pedido", requireTenantOwnership([["filial_id", "empresa_filial"], ["supplierId", "fabricante"], ["items[].productId", "produto"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const entrada = await execute.execute_insert_pedido_compra(
      data.usuario_solicitante_id,
      data.filial_id,
      data.empresa_id,
      data.status
    );
    for (const produto of data.items) {
      await execute.execute_insert_produto_entrada(
        produto.productId,
        entrada[0].id,
        data.supplierId,
        produto.quantity,
        produto.costPrice
      );
    }
    const payload_return = await execute.execute_get_lista_entrada_id(
      entrada[0].id
    );
    payload_return[0].items = await execute.execute_get_items_entrada(
      entrada[0].id
    );
    return res.json(utils.jsonMount(true, payload_return[0], ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastro_produto"));
  }
});

rota.post("/listar_pedidos_compra", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    const response_payload = await execute.execute_get_lista_entrada(
      data.empresa_id
    );
    for (i = 0; i < response_payload.length; i++) {
      response_payload[i].items = await execute.execute_get_items_entrada(
        response_payload[i].id
      );
    }
    return res.json(utils.jsonMount(true, response_payload, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_pedidos_compra"));
  }
});

rota.post("/receber_pedido", requireTenantOwnership([["pedido_id", "entrada"]]), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);
    await execute.execute_receber_pedido(data.pedido_id, data.usuario_id);
    const produtos = await await execute.execute_get_produto_entrada_by_id(
      data.pedido_id
    );
    for (const produto of produtos) {
      await execute.execute_insert_estoque_entrada(
        produto.produto_id,
        produto.empresa_id,
        produto.filial_id,
        produto.quantidade
      );
    }
    return res.json(utils.jsonMount(true, {}, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/receber_pedido"));
  }
});

module.exports = rota;
