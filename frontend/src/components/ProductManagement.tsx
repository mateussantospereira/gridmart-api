import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import type { Product } from "../types";
import { formatCentsToBRL, parseBRLToCents } from "../utils/formatters";
import {
  BoxIcon,
  RefreshIcon,
  PlusIcon,
  SearchIcon,
  CheckIcon,
  AlertIcon,
  TrashIcon,
} from "./Icons";

export const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    priceStr: "",
  });
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await api.getProducts();
      setProducts(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao conectar com a base de produtos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      barcode: "",
      name: "",
      priceStr: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      barcode: product.barcode,
      name: product.name,
      priceStr: (product.priceInCents / 100).toFixed(2).replace(".", ","),
    });
    setIsModalOpen(true);
  };

  const generateRandomBarcode = () => {
    const random12 = "789" + Math.floor(100000000 + Math.random() * 900000000).toString();
    setFormData((prev) => ({ ...prev, barcode: random12 }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceInCents = parseBRLToCents(formData.priceStr);

    if (!formData.name.trim()) {
      setErrorMessage("Informe a descrição do produto.");
      return;
    }
    if (!formData.barcode.trim()) {
      setErrorMessage("Informe o código de barras EAN.");
      return;
    }
    if (priceInCents <= 0) {
      setErrorMessage("O valor unitário deve ser maior que zero.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          barcode: formData.barcode.trim(),
          name: formData.name.trim(),
          priceInCents,
        });
        setSuccessMessage("Registro atualizado no catálogo.");
      } else {
        await api.createProduct({
          barcode: formData.barcode.trim(),
          name: formData.name.trim(),
          priceInCents,
        });
        setSuccessMessage("Novo produto registrado com sucesso.");
      }

      setIsModalOpen(false);
      loadProducts();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Falha ao salvar produto.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Confirma a exclusão do produto "${name}"?`)) {
      return;
    }

    try {
      setErrorMessage(null);
      await api.deleteProduct(id);
      setSuccessMessage("Item removido do inventário.");
      loadProducts();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Não foi possível excluir o item.");
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm)
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            <BoxIcon size={18} />
            Inventário & Catálogo
          </h2>
          <p className="panel-desc">
            Base de dados de produtos sincronizada com os leitores de autoatendimento.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={loadProducts} className="btn btn-secondary btn-sm" title="Recarregar">
            <RefreshIcon size={14} />
            Sincronizar
          </button>
          <button onClick={openCreateModal} className="btn btn-primary btn-sm">
            <PlusIcon size={14} />
            Cadastrar Produto
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success">
          <CheckIcon size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger">
          <AlertIcon size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Barra de Busca */}
      <div style={{ marginBottom: "1rem", position: "relative" }}>
        <div style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
          <SearchIcon size={15} />
        </div>
        <input
          type="text"
          className="input"
          placeholder="Buscar por descrição ou código de barras..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ paddingLeft: "2.3rem" }}
        />
      </div>

      {/* Tabela de Produtos */}
      <div className="table-container">
        {loading ? (
          <p style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Carregando inventário...
          </p>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            {searchTerm
              ? "Nenhum produto atende aos critérios de pesquisa."
              : "Nenhum item cadastrado no sistema. Clique em 'Cadastrar Produto' para iniciar."}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "70px" }}>ID</th>
                <th>Código de Barras</th>
                <th>Descrição do Produto</th>
                <th style={{ width: "140px" }}>Preço Unitário</th>
                <th style={{ textAlign: "right", width: "160px" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((prod) => (
                <tr key={prod.id}>
                  <td style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    #{prod.id}
                  </td>
                  <td>
                    <span className="table-code">{prod.barcode}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {prod.name}
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>
                    {formatCentsToBRL(prod.priceInCents)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                      <button
                        onClick={() => openEditModal(prod)}
                        className="btn btn-secondary btn-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="btn btn-danger btn-sm"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "1.25rem" }}>
              {editingProduct ? "Editar Produto" : "Novo Cadastro de Produto"}
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="form-group">
                <label className="form-label">Descrição do Produto</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Água Mineral 500ml"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <label className="form-label" style={{ margin: 0 }}>Código de Barras (EAN-13)</label>
                  {!editingProduct && (
                    <button
                      type="button"
                      onClick={generateRandomBarcode}
                      className="btn btn-outline btn-sm"
                      style={{ padding: "0.15rem 0.45rem", fontSize: "0.75rem" }}
                    >
                      Gerar Aleatório
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: 7891234567890"
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, barcode: e.target.value }))
                  }
                  style={{ fontFamily: "var(--font-mono)" }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preço Unitário (R$)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="0,00"
                  value={formData.priceStr}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, priceStr: e.target.value }))
                  }
                  style={{ fontFamily: "var(--font-mono)" }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Confirmar e Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
