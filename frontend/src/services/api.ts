import type {
  Product,
  AccessCheckResponse,
  AccessRegisterResponse,
  AccessExitResponse,
  Sale,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMsg = `Erro na requisição (${response.status})`;
    try {
      const data = await response.json();
      if (data.error) errorMsg = data.error;
    } catch {
      // response is not json
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // --- Produtos ---
  async getProducts(): Promise<Product[]> {
    return request<Product[]>("/products");
  },

  async getProductById(id: number): Promise<Product> {
    return request<Product>(`/products/${id}`);
  },

  async getProductByBarcode(barcode: string): Promise<Product> {
    return request<Product>(`/products/barcode/${encodeURIComponent(barcode)}`);
  },

  async createProduct(data: { barcode: string; name: string; priceInCents: number }): Promise<Product> {
    return request<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateProduct(id: number, data: Partial<{ barcode: string; name: string; priceInCents: number }>): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteProduct(id: number): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: "DELETE",
    });
  },

  // --- Controle de Acesso ---
  async checkAccess(cpf: string): Promise<AccessCheckResponse> {
    return request<AccessCheckResponse>("/access/check", {
      method: "POST",
      body: JSON.stringify({ cpf }),
    });
  },

  async registerUser(cpf: string, name: string): Promise<AccessRegisterResponse> {
    return request<AccessRegisterResponse>("/access/register", {
      method: "POST",
      body: JSON.stringify({ cpf, name }),
    });
  },

  async exitAccess(cpf?: string): Promise<AccessExitResponse> {
    const body: Record<string, string> = {};
    if (cpf && cpf.trim().length > 0) {
      body.cpf = cpf;
    }
    return request<AccessExitResponse>("/access/exit", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // --- Vendas / Totem ---
  async createSale(items: { productId: number; quantity: number }[], userId?: number): Promise<Sale> {
    return request<Sale>("/sales", {
      method: "POST",
      body: JSON.stringify({ items, userId }),
    });
  },

  async getSale(id: number): Promise<Sale> {
    return request<Sale>(`/sales/${id}`);
  },

  async paySale(id: number): Promise<Sale> {
    return request<Sale>(`/sales/${id}/pay`, {
      method: "POST",
    });
  },
};
