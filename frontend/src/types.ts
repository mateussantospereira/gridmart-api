export interface Product {
  id: number;
  barcode: string;
  name: string;
  priceInCents: number;
}

export interface AccessCheckResponse {
  registered: boolean;
  allowed: boolean;
  name?: string;
  error?: string;
}

export interface AccessRegisterResponse {
  registered: boolean;
  allowed: boolean;
  name: string;
}

export interface AccessExitResponse {
  allowed: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SaleItem {
  productId: number;
  quantity: number;
  priceInCents: number;
}

export interface Sale {
  id: number;
  userId?: number | null;
  totalInCents: number;
  status: "PENDING" | "PAID" | "EXPIRED";
  pixQrCode: string | null;
  createdAt: string;
  items?: SaleItem[];
}
