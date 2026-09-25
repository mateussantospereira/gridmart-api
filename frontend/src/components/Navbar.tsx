import React from "react";
import { CartIcon, DoorIcon, BoxIcon } from "./Icons";

interface NavbarProps {
  activeTab: "totem" | "access" | "products";
  setActiveTab: (tab: "totem" | "access" | "products") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-icon-box">
          <CartIcon size={20} />
        </div>
        <div>
          <div className="brand-title">
            GridMart
            <span className="brand-tag">Terminal</span>
          </div>
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span>Loja Autônoma · Operacional</span>
          </div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === "totem" ? "active" : ""}`}
          onClick={() => setActiveTab("totem")}
        >
          <CartIcon size={16} />
          Autoatendimento
        </button>
        <button
          className={`nav-tab-btn ${activeTab === "access" ? "active" : ""}`}
          onClick={() => setActiveTab("access")}
        >
          <DoorIcon size={16} />
          Controle de Acesso
        </button>
        <button
          className={`nav-tab-btn ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          <BoxIcon size={16} />
          Catálogo & Estoque
        </button>
      </nav>
    </header>
  );
};
