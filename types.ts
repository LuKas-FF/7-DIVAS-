
export enum UserRole {
  ADMIN = 'ADMIN',
  ESTOQUE_EXPEDICAO = 'ESTOQUE_EXPEDICAO',
  ENTRADA_INSUMOS = 'ENTRADA_INSUMOS',
  FINANCEIRO = 'FINANCEIRO',
  GERENCIA = 'GERENCIA',
  TI = 'TI' // Perfil de Manutenção
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  avatar?: string;
  status: 'ATIVO' | 'INATIVO';
}

export interface AppConfig {
  companyName: string;
  logoText: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  stores: Store[];
  gasWebAppUrl?: string; // URL do Google Apps Script
}

export interface Store {
  id: string;
  name: string;
  status: 'ATIVA' | 'INATIVA';
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  minStock: number;
  currentStock: number;
  imageUrl?: string;
}

export interface RawMaterialEntry {
  id: string;
  item: string;
  quantity: number;
  value?: number;
  supplier: string;
  date: string;
  userId: string;
  unit?: string;
}

export type TransactionType = 'ENTRY' | 'EXIT' | 'PRODUCTION' | 'SALE' | 'MATERIA_PRIMA';

export interface Transaction {
  id: string;
  productId?: string;
  type: TransactionType;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  timestamp: string; 
  userId: string;
  storeId?: string;
  rawMaterialId?: string;
}
