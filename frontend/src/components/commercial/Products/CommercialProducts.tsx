import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiFileText,
  FiImage,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import { useToast } from "../../../contexts/ToastContext";
import {
  createCommercialProduct,
  deleteCommercialProductDocument,
  deleteCommercialProductImage,
  deleteCommercialProduct,
  getCommercialProducts,
  subscribeToCommercialDataChanged,
  uploadCommercialProductDocument,
  uploadCommercialProductImages,
  updateCommercialProduct,
  type CommercialDomainProduct,
  type CommercialProductDocument,
  type CommercialProductImage,
} from "../../../service/commercialService";
import "./CommercialProducts.css";

type CommercialProductsProps = {
  embedded?: boolean;
};

type ProductModalSection = "product_data" | "product_media";

export function CommercialProducts({
  embedded = false,
}: CommercialProductsProps) {
  const { addToast } = useToast();
  const [products, setProducts] = useState<CommercialDomainProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalSection, setActiveModalSection] =
    useState<ProductModalSection>("product_data");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingDocument, setPendingDocument] = useState<File | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getCommercialProducts();
      setProducts((list || []).filter((item) => item.ativo !== false));
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar produtos.",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(
    () => subscribeToCommercialDataChanged(() => void loadProducts()),
    [loadProducts],
  );

  const resetForm = () => {
    setEditingProductId(null);
    setName("");
    setDescription("");
    setPrice("");
    setPendingImages([]);
    setPendingDocument(null);
  };

  const openCreateModal = () => {
    resetForm();
    setActiveModalSection("product_data");
    setIsModalOpen(true);
  };

  const sortedProducts = useMemo(
    () =>
      [...products].sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
      ),
    [products],
  );
  const currentEditingProduct = useMemo(
    () =>
      editingProductId
        ? products.find((item) => Number(item.id) === Number(editingProductId)) ||
          null
        : null,
    [editingProductId, products],
  );

  const handleSave = async () => {
    const normalizedName = name.trim();
    const parsedPrice = Number(String(price || "0").replace(",", "."));

    if (!normalizedName) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Informe o nome do produto.",
      });
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Informe um preco valido.",
      });
      return;
    }
    const totalExistingImages = editingProductId
      ? products.find((item) => Number(item.id) === Number(editingProductId))
          ?.imagens?.length || 0
      : 0;
    if (totalExistingImages + pendingImages.length > 3) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Cada produto pode ter no maximo 3 imagens.",
      });
      return;
    }

    setSaving(true);
    try {
      let savedProduct: CommercialDomainProduct;
      if (editingProductId) {
        savedProduct = await updateCommercialProduct(editingProductId, {
          name: normalizedName,
          description: description.trim() || undefined,
          price: parsedPrice,
        });
        if (pendingImages.length) {
          savedProduct = await uploadCommercialProductImages(
            editingProductId,
            pendingImages,
          );
        }
        if (pendingDocument) {
          savedProduct = await uploadCommercialProductDocument(
            editingProductId,
            pendingDocument,
          );
        }
        addToast({
          type: "success",
          title: "Sucesso",
          description: "Produto atualizado.",
        });
      } else {
        savedProduct = await createCommercialProduct({
          name: normalizedName,
          description: description.trim() || undefined,
          price: parsedPrice,
        });
        if (pendingImages.length) {
          savedProduct = await uploadCommercialProductImages(
            Number(savedProduct.id),
            pendingImages,
          );
        }
        if (pendingDocument) {
          savedProduct = await uploadCommercialProductDocument(
            Number(savedProduct.id),
            pendingDocument,
          );
        }
        addToast({
          type: "success",
          title: "Sucesso",
          description: "Produto criado.",
        });
      }

      resetForm();
      setIsModalOpen(false);
      await loadProducts();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o produto.",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (product: CommercialDomainProduct) => {
    setEditingProductId(Number(product.id));
    setName(product.nome || "");
    setDescription(product.descricao || "");
    setPrice(String(Number(product.preco_base || 0)));
    setPendingImages([]);
    setPendingDocument(null);
    setActiveModalSection("product_data");
    setIsModalOpen(true);
  };

  const validateAndAddFiles = (files: File[]) => {
    const currentExistingImages = editingProductId
      ? products.find((item) => Number(item.id) === Number(editingProductId))
          ?.imagens?.length || 0
      : 0;
    const nextTotal =
      currentExistingImages + pendingImages.length + files.length;
    if (nextTotal > 3) {
      addToast({
        type: "error",
        title: "Limite excedido",
        description: "Você pode manter no máximo 3 imagens por produto.",
      });
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        addToast({
          type: "error",
          title: "Arquivo invalido",
          description: "Envie apenas imagens.",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        addToast({
          type: "error",
          title: "Arquivo muito grande",
          description: "Cada imagem deve ter no maximo 10MB.",
        });
        return;
      }
    }

    setPendingImages((prev) => [...prev, ...files]);
  };

  const handlePendingImageSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length) {
      validateAndAddFiles(files);
    }
    event.target.value = "";
  };

  const handleRemovePendingImage = (index: number) => {
    setPendingImages((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleDeleteExistingImage = async (image: CommercialProductImage) => {
    if (!editingProductId || !image.id) return;
    if (!window.confirm("Remover esta imagem do produto?")) return;

    try {
      const updated = await deleteCommercialProductImage(Number(image.id));
      setProducts((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(updated.id) ? updated : item,
        ),
      );
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Imagem removida.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel remover a imagem.",
      });
    }
  };

  const handlePendingDocumentSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      event.target.value = "";
      return;
    }
    if (file.type !== "application/pdf") {
      addToast({
        type: "error",
        title: "Arquivo invalido",
        description: "Envie apenas arquivos PDF.",
      });
      event.target.value = "";
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      addToast({
        type: "error",
        title: "Arquivo muito grande",
        description: "O documento deve ter no maximo 60MB.",
      });
      event.target.value = "";
      return;
    }
    const currentProduct = editingProductId
      ? products.find((item) => Number(item.id) === Number(editingProductId))
      : null;
    if (currentProduct?.documento) {
      addToast({
        type: "error",
        title: "Limite excedido",
        description: "Cada produto pode ter no maximo 1 documento PDF.",
      });
      event.target.value = "";
      return;
    }
    setPendingDocument(file);
    event.target.value = "";
  };

  const handleDeleteExistingDocument = async (
    document: CommercialProductDocument,
  ) => {
    if (!editingProductId || !document.id) return;
    if (!window.confirm("Remover este documento do produto?")) return;

    try {
      const updated = await deleteCommercialProductDocument(
        Number(document.id),
      );
      setProducts((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(updated.id) ? updated : item,
        ),
      );
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Documento removido.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel remover o documento.",
      });
    }
  };

  const handleDeleteEditingProduct = async () => {
    if (!editingProductId) return;
    if (!window.confirm(`Excluir o produto "${name || "sem nome"}"?`)) return;

    try {
      await deleteCommercialProduct(editingProductId);
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Produto removido.",
      });
      resetForm();
      setIsModalOpen(false);
      await loadProducts();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel excluir o produto.",
      });
    }
  };

  return (
    <div
      className={`commercial-products ${embedded ? "commercial-products--embedded" : ""}`}
    >
      <div className="products-card">
        <div className="products-card-header">
          <div>
            <h3>Produtos cadastrados</h3>
            <span className="products-card-count">
              {sortedProducts.length}{" "}
              {sortedProducts.length === 1 ? "produto" : "produtos"}
            </span>
          </div>
          <button
            type="button"
            className="products-primary-btn products-create-button"
            onClick={openCreateModal}
          >
            + Novo produto
          </button>
        </div>

        {loading ? (
          <p>Carregando produtos...</p>
        ) : !sortedProducts.length ? (
          <p>Nenhum produto cadastrado.</p>
        ) : (
          <div className="products-list">
            {sortedProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-card-header">
                  <div className="product-card-identity">
                    <p className="product-card-name">{product.nome}</p>
                    <div>
                      {product.imagens?.length ? (
                        <span className="product-card-badge product-card-badge--media">
                          <FiImage size={12} /> {product.imagens.length}
                        </span>
                      ) : null}
                      {product.documento ? (
                        <span className="product-card-badge product-card-badge--document">
                          <FiFileText size={12} /> PDF
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <p className="product-card-description">
                  {product.descricao || "Sem descrição"}
                </p>

                <dl className="product-card-meta">
                  <div>
                    <dt>Preço</dt>
                    <dd>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(Number(product.preco_base || 0))}
                    </dd>
                  </div>
                  <div>
                    <dt>Imagens</dt>
                    <dd>{product.imagens?.length || 0}</dd>
                  </div>
                  <div>
                    <dt>Documento</dt>
                    <dd>
                      {product.documento ? "PDF vinculado" : "Sem documento"}
                    </dd>
                  </div>
                </dl>
                
                {product.imagens?.length ? (
                  <div className="product-thumbnail-row">
                    {product.imagens.slice(0, 3).map((image) => (
                      <img
                        key={image.id}
                        src={image.url}
                        alt={image.nome_arquivo || product.nome}
                        className="product-thumbnail"
                        loading="lazy"
                      />
                    ))}
                  </div>
                ) : null}

                <div className="product-card-actions">
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => startEdit(product)}
                    title="Editar produto"
                    aria-label="Editar produto"
                  >
                    <FiEdit2 aria-hidden="true" />
                    <span>Editar</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {isModalOpen ? (
        <div
          className="products-modal-backdrop"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="products-modal" onClick={(e) => e.stopPropagation()}>
            <div className="products-modal-header">
              <h3>{editingProductId ? "Editar produto" : "Novo produto"}</h3>
              <button
                type="button"
                className="products-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="products-modal-layout">
              <aside className="products-modal-sidebar" aria-label="Secoes do produto">
                <button
                  type="button"
                  className={
                    activeModalSection === "product_data"
                      ? "products-modal-nav-item is-active"
                      : "products-modal-nav-item"
                  }
                  onClick={() => setActiveModalSection("product_data")}
                >
                  Dados do produto
                </button>
                <button
                  type="button"
                  className={
                    activeModalSection === "product_media"
                      ? "products-modal-nav-item is-active"
                      : "products-modal-nav-item"
                  }
                  onClick={() => setActiveModalSection("product_media")}
                >
                  Midias do produto
                </button>
              </aside>

              <div className="products-modal-panel">
                {activeModalSection === "product_data" ? (
                  <section className="products-modal-section-card">
                    <div className="products-modal-section-header">
                      <div>
                        <h4>Dados do produto</h4>
                        <p>Configure nome, descrição e preço base.</p>
                      </div>
                    </div>

                    <div className="products-form-grid products-form-grid-modal">
                      <label className="products-field-group">
                        <span>Nome do produto</span>
                        <input
                          type="text"
                          placeholder="Nome do produto"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </label>
                      <label className="products-field-group">
                        <span>Descrição</span>
                        <input
                          type="text"
                          placeholder="Descrição (opcional)"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </label>
                      <label className="products-field-group">
                        <span>Preço base</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Preço base"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {activeModalSection === "product_media" ? (
                  <section className="products-modal-section-card">
                    <div className="products-modal-section-header">
                      <div>
                        <h4>Midias do produto</h4>
                        <p>Gerencie imagens e documento PDF vinculados ao produto.</p>
                      </div>
                    </div>

                    <div className="product-images-section">
                      <div className="product-images-header">
                        <div>
                          <h4>Imagens do produto</h4>
                          <p>Você pode manter até 3 imagens de no máximo 10MB cada.</p>
                        </div>
                        <label className="product-image-upload">
                          <FiUpload size={14} />
                          <span>Adicionar imagens</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePendingImageSelect}
                          />
                        </label>
                      </div>

                      {currentEditingProduct?.imagens?.length ? (
                        <div className="product-images-grid">
                          {(currentEditingProduct.imagens || []).map((image) => (
                            <div
                              key={`modal-existing-${image.id}`}
                              className="product-image-card"
                            >
                              <img src={image.url} alt={image.nome_arquivo || name} />
                              <button
                                type="button"
                                className="product-image-remove"
                                onClick={() => void handleDeleteExistingImage(image)}
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {pendingImages.length ? (
                        <div className="product-images-grid">
                          {pendingImages.map((file, index) => (
                            <div
                              key={`modal-pending-${file.name}-${index}`}
                              className="product-image-card"
                            >
                              <img src={URL.createObjectURL(file)} alt={file.name} />
                              <button
                                type="button"
                                className="product-image-remove"
                                onClick={() => handleRemovePendingImage(index)}
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="product-images-section">
                      <div className="product-images-header">
                        <div>
                          <h4>Documento do produto</h4>
                          <p>Cada produto pode ter 1 PDF de no máximo 60MB.</p>
                        </div>
                        <label className="product-image-upload">
                          <FiUpload size={14} />
                          <span>Adicionar documento</span>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={handlePendingDocumentSelect}
                          />
                        </label>
                      </div>

                      {currentEditingProduct?.documento ? (
                        <div className="product-document-card">
                          <div className="product-document-card__icon">
                            <FiFileText />
                          </div>
                          <div className="product-document-card__content">
                            <strong>{currentEditingProduct.documento.nome_arquivo}</strong>
                            <a
                              href={currentEditingProduct.documento.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir PDF
                            </a>
                          </div>
                          <button
                            type="button"
                            className="product-image-remove product-document-remove"
                            onClick={() =>
                              void handleDeleteExistingDocument(
                                currentEditingProduct.documento as CommercialProductDocument,
                              )
                            }
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      ) : null}

                      {pendingDocument ? (
                        <div className="product-document-card">
                          <div className="product-document-card__icon">
                            <FiFileText />
                          </div>
                          <div className="product-document-card__content">
                            <strong>{pendingDocument.name}</strong>
                            <span>Documento pronto para upload</span>
                          </div>
                          <button
                            type="button"
                            className="product-image-remove product-document-remove"
                            onClick={() => setPendingDocument(null)}
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            <div className="products-form-grid products-form-grid-modal">
              <input
                type="text"
                placeholder="Nome do produto"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Preco base"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="product-images-section">
              <div className="product-images-header">
                <div>
                  <h4>Imagens do produto</h4>
                  <p>Você pode manter até 3 imagens de no máximo 10MB cada.</p>
                </div>
                <label className="product-image-upload">
                  <FiUpload size={14} />
                  <span>Adicionar imagens</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePendingImageSelect}
                  />
                </label>
              </div>

              {editingProductId &&
              products.find(
                (item) => Number(item.id) === Number(editingProductId),
              )?.imagens?.length ? (
                <div className="product-images-grid">
                  {(
                    products.find(
                      (item) => Number(item.id) === Number(editingProductId),
                    )?.imagens || []
                  ).map((image) => (
                    <div
                      key={`existing-${image.id}`}
                      className="product-image-card"
                    >
                      <img src={image.url} alt={image.nome_arquivo || name} />
                      <button
                        type="button"
                        className="product-image-remove"
                        onClick={() => void handleDeleteExistingImage(image)}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {pendingImages.length ? (
                <div className="product-images-grid">
                  {pendingImages.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="product-image-card"
                    >
                      <img src={URL.createObjectURL(file)} alt={file.name} />
                      <button
                        type="button"
                        className="product-image-remove"
                        onClick={() => handleRemovePendingImage(index)}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="product-images-section">
              <div className="product-images-header">
                <div>
                  <h4>Documento do produto</h4>
                  <p>Cada produto pode ter 1 PDF de no máximo 60MB.</p>
                </div>
                <label className="product-image-upload">
                  <FiUpload size={14} />
                  <span>Adicionar documento</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePendingDocumentSelect}
                  />
                </label>
              </div>

              {editingProductId &&
              products.find(
                (item) => Number(item.id) === Number(editingProductId),
              )?.documento ? (
                <div className="product-document-card">
                  <div className="product-document-card__icon">
                    <FiFileText />
                  </div>
                  <div className="product-document-card__content">
                    <strong>
                      {
                        products.find(
                          (item) =>
                            Number(item.id) === Number(editingProductId),
                        )?.documento?.nome_arquivo
                      }
                    </strong>
                    <a
                      href={
                        products.find(
                          (item) =>
                            Number(item.id) === Number(editingProductId),
                        )?.documento?.url || "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir PDF
                    </a>
                  </div>
                  <button
                    type="button"
                    className="product-image-remove product-document-remove"
                    onClick={() =>
                      void handleDeleteExistingDocument(
                        products.find(
                          (item) =>
                            Number(item.id) === Number(editingProductId),
                        )?.documento as CommercialProductDocument,
                      )
                    }
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ) : null}

              {pendingDocument ? (
                <div className="product-document-card">
                  <div className="product-document-card__icon">
                    <FiFileText />
                  </div>
                  <div className="product-document-card__content">
                    <strong>{pendingDocument.name}</strong>
                    <span>Documento pronto para upload</span>
                  </div>
                  <button
                    type="button"
                    className="product-image-remove product-document-remove"
                    onClick={() => setPendingDocument(null)}
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="products-form-actions">
              {editingProductId ? (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => void handleDeleteEditingProduct()}
                  disabled={saving}
                >
                  Excluir
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="products-primary-btn"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving
                  ? "Salvando..."
                  : editingProductId
                    ? "Salvar"
                    : "Criar produto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CommercialProducts;
