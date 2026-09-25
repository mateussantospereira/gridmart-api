import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../services/api";
import type { Product, CartItem, Sale } from "../types";
import { formatCentsToBRL } from "../utils/formatters";
import {
  BarcodeIcon,
  CartIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  AlertIcon,
  BoltIcon,
} from "./Icons";

export const TotemCheckout: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchingBarcode, setSearchingBarcode] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const addToCart = (product: Product) => {
    setErrorMessage(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setErrorMessage(null);
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    try {
      setSearchingBarcode(true);
      setErrorMessage(null);
      const product = await api.getProductByBarcode(barcodeInput.trim());
      addToCart(product);
      setBarcodeInput("");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Produto não localizado para este código de barras."
      );
    } finally {
      setSearchingBarcode(false);
    }
  };

  const totalInCents = cart.reduce(
    (sum, item) => sum + item.product.priceInCents * item.quantity,
    0
  );
  const totalItemsCount = cart.reduce((c, i) => c + i.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      setCheckoutLoading(true);
      setErrorMessage(null);
      const payload = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

      const sale = await api.createSale(payload);
      setActiveSale(sale);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao registrar transação no servidor.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePayPix = async () => {
    if (!activeSale) return;

    try {
      setPaymentLoading(true);
      const updated = await api.paySale(activeSale.id);
      setActiveSale(updated);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao confirmar liquidação Pix.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const copyPixCode = () => {
    if (activeSale?.pixQrCode) {
      navigator.clipboard.writeText(activeSale.pixQrCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    }
  };

  const finishOrder = () => {
    setActiveSale(null);
    setCart([]);
    setErrorMessage(null);
    loadProducts();
  };

  return (
    <div>
      {errorMessage && (
        <div className="alert alert-danger">
          <AlertIcon size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="pos-layout">
        {/* Lado Esquerdo: Leitor e Vitrine */}
        <div>
          <div className="panel" style={{ marginBottom: "1.25rem" }}>
            <div className="panel-header" style={{ marginBottom: "0.85rem" }}>
              <div>
                <h2 className="panel-title">
                  <BarcodeIcon size={18} />
                  Leitor de Código de Barras
                </h2>
                <p className="panel-desc">
                  Aproxime o código do sensor ótico ou digite a sequência numérica abaixo.
                </p>
              </div>
            </div>

            <form onSubmit={handleBarcodeSubmit}>
              <div className="input-scanner">
                <span className="scanner-icon">
                  <BarcodeIcon size={18} />
                </span>
                <input
                  type="text"
                  className="input"
                  placeholder="Escanear ou digitar código EAN (ex: 7891000100101)..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  disabled={searchingBarcode}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ marginLeft: "0.5rem" }}
                  disabled={searchingBarcode || !barcodeInput.trim()}
                >
                  {searchingBarcode ? "Localizando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>

          {/* Catálogo Rápido */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Catálogo Rápido</h3>
                <p className="panel-desc">
                  Selecione itens comuns diretamente na tela sem necessidade de leitor.
                </p>
              </div>
              <span className="badge badge-subtle">{products.length} itens cadastrados</span>
            </div>

            {loadingProducts ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Sincronizando inventário...
              </p>
            ) : products.length === 0 ? (
              <div className="alert alert-warning">
                Nenhum produto cadastrado no banco de dados. Cadastre itens na aba Catálogo.
              </div>
            ) : (
              <div className="catalog-grid">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="catalog-card"
                    onClick={() => addToCart(prod)}
                  >
                    <div>
                      <div className="catalog-card-name">{prod.name}</div>
                      <div className="catalog-card-barcode">{prod.barcode}</div>
                    </div>
                    <div className="catalog-card-price">
                      {formatCentsToBRL(prod.priceInCents)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Comanda / Carrinho de Compras */}
        <div className="receipt-box">
          <div className="receipt-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Comanda Atual</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {totalItemsCount} {totalItemsCount === 1 ? "item registrado" : "itens registrados"}
              </div>
            </div>
            {cart.length > 0 && (
              <button onClick={clearCart} className="btn btn-outline btn-sm">
                Cancelar comanda
              </button>
            )}
          </div>

          <div className="receipt-items">
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                <div style={{ display: "inline-block", marginBottom: "0.75rem", opacity: 0.4 }}>
                  <CartIcon size={32} />
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>Nenhum item na comanda</div>
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  Passe o leitor sobre a embalagem ou clique em um produto ao lado.
                </div>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="receipt-item-row">
                  <div>
                    <div className="receipt-item-title">{item.product.name}</div>
                    <div className="receipt-item-unit">
                      {formatCentsToBRL(item.product.priceInCents)} unit.
                    </div>
                  </div>

                  <div className="receipt-qty-controls">
                    <button
                      className="receipt-qty-btn"
                      onClick={() => updateQuantity(item.product.id, -1)}
                      title="Diminuir"
                    >
                      <MinusIcon size={12} />
                    </button>
                    <span className="receipt-qty-val">{item.quantity}</span>
                    <button
                      className="receipt-qty-btn"
                      onClick={() => updateQuantity(item.product.id, 1)}
                      title="Aumentar"
                    >
                      <PlusIcon size={12} />
                    </button>
                  </div>

                  <div className="receipt-item-total">
                    {formatCentsToBRL(item.product.priceInCents * item.quantity)}
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="btn btn-outline btn-sm"
                    style={{ padding: "0.25rem", color: "var(--text-muted)" }}
                    title="Remover produto"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="receipt-footer">
            <div className="receipt-line">
              <span>Subtotal dos produtos</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatCentsToBRL(totalInCents)}
              </span>
            </div>
            <div className="receipt-line">
              <span>Descontos promocionais</span>
              <span>R$ 0,00</span>
            </div>

            <div className="receipt-total-line">
              <span>Total a pagar</span>
              <span className="receipt-total-amount">
                {formatCentsToBRL(totalInCents)}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: "1rem" }}
              disabled={checkoutLoading || cart.length === 0}
            >
              {checkoutLoading ? "Processando..." : "Prosseguir para Pagamento Pix"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Pagamento Pix */}
      {activeSale && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                {activeSale.status === "PAID"
                  ? "Transação Aprovada"
                  : "Terminal de Pagamento Pix"}
              </div>
              <span className="badge badge-subtle">ID #{activeSale.id}</span>
            </div>

            {activeSale.status === "PAID" ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    backgroundColor: "var(--brand-surface)",
                    color: "var(--brand)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <CheckIcon size={28} />
                </div>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  Pagamento Confirmado
                </h4>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                  A transação de {formatCentsToBRL(activeSale.totalInCents)} foi autorizada com sucesso. Obrigado!
                </p>

                <button
                  onClick={finishOrder}
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%" }}
                >
                  Concluir e Liberar Terminal
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  Abra o aplicativo de sua instituição financeira e aponte a câmera para o QR Code abaixo.
                </p>

                <div className="pix-card">
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {formatCentsToBRL(activeSale.totalInCents)}
                  </div>

                  <div className="pix-qr-frame">
                    {activeSale.pixQrCode ? (
                      <QRCodeSVG value={activeSale.pixQrCode} size={168} />
                    ) : (
                      <div style={{ padding: "2rem", color: "var(--text-muted)" }}>
                        QR Code indisponível
                      </div>
                    )}
                  </div>

                  {activeSale.pixQrCode && (
                    <div className="pix-payload">{activeSale.pixQrCode}</div>
                  )}

                  <button
                    onClick={copyPixCode}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%" }}
                  >
                    {copiedPix ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    {copiedPix ? "Código Pix copiado!" : "Copiar chave Pix copia e cola"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    onClick={() => setActiveSale(null)}
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    disabled={paymentLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePayPix}
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                    disabled={paymentLoading}
                  >
                    <BoltIcon size={16} />
                    {paymentLoading ? "Confirmando..." : "Simular Liquidação Pix"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
