import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export interface Category {
  id: string;
  name: string;
  icon: string;
  is_free: boolean;
  sort_order: number;
}

export interface KnowledgePoint {
  id: string;
  category_id: string;
  title: string;
  content: string;
  extra: string | null;
  push_date: string;
}
