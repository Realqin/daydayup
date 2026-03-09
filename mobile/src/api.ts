import axios from "axios";

const API_BASE = "http://localhost:8000/api/v1"; // 生产环境需替换

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export interface Category {
  id: string;
  name: string;
  icon: string;
  is_free: boolean;
  price?: number | null;
  is_unlocked?: boolean;
  learned_count?: number;
  total_count?: number;
  status?: "not_started" | "in_progress" | "finished";
}

export interface KnowledgePoint {
  id: string;
  title: string;
  content: string;
  category_id: string;
}
