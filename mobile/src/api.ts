import axios from "axios";
import { Platform } from "react-native";

// Android 模拟器中 localhost 指向模拟器自身，需用 10.0.2.2 访问宿主机
// 真机调试时需改为电脑的局域网 IP，如 http://192.168.1.100:8000/api/v1
const getApiBase = () => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000/api/v1";
  }
  return "http://localhost:8000/api/v1";
};
const API_BASE = getApiBase();

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
