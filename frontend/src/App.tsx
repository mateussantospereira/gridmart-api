import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { TotemCheckout } from "./components/TotemCheckout";
import { AccessControl } from "./components/AccessControl";
import { ProductManagement } from "./components/ProductManagement";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"totem" | "access" | "products">("totem");

  return (
    <div className="app">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="container">
        {activeTab === "totem" && <TotemCheckout />}
        {activeTab === "access" && <AccessControl />}
        {activeTab === "products" && <ProductManagement />}
      </main>
    </div>
  );
};

export default App;
