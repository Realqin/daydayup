import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  Platform,
  TextInput,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { api, Category, KnowledgePoint } from "./src/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type Step = "login" | "permission" | "onboard" | "home";
const Tab = createBottomTabNavigator();

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [step, setStep] = useState<Step>("login");

  const handleWechatLogin = async () => {
    try {
      const { data } = await api.post("/app/wechat-login", { code: "mock-wechat-code" });
      setUserId(data.user_id);
      setIsVip(data.is_vip);
      setHasOnboarded(data.has_onboarded);
      setStep("permission");
    } catch (e) {
      Alert.alert("登录失败", String(e));
    }
  };

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      setStep(hasOnboarded ? "home" : "onboard");
      return;
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要通知权限才能使用拾刻", "请在系统设置中开启通知权限");
      }
    }
    if (userId) {
      try {
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        await api.post(`/app/push-token?user_id=${userId}`, { token, platform: Platform.OS });
      } catch {}
    }
    setStep(hasOnboarded ? "home" : "onboard");
  };

  if (step === "login") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>拾刻</Text>
        <Text style={styles.subtitle}>使用微信账号登录，一起开始微学习</Text>
        <TouchableOpacity style={styles.btn} onPress={handleWechatLogin}>
          <Text style={styles.btnText}>微信登录（模拟）</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (step === "permission") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>开启通知</Text>
        <Text style={styles.subtitle}>每天 1 分钟，无压积累，需要通知提醒你学习</Text>
        <TouchableOpacity style={styles.btn} onPress={registerForPushNotifications}>
          <Text style={styles.btnText}>允许通知</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!userId) return null;

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="知识" options={{ tabBarLabel: "知识" }}>
          {() => (
            <KnowledgeTab
              userId={userId}
              isVip={isVip}
              hasOnboarded={hasOnboarded}
              onFinishedOnboard={() => setHasOnboarded(true)}
              onVipChange={setIsVip}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="考试" options={{ tabBarLabel: "随机考试" }}>
          {() => <ExamTab userId={userId} />}
        </Tab.Screen>
        <Tab.Screen name="我的" options={{ tabBarLabel: "我的" }}>
          {() => <ProfileTab userId={userId} isVip={isVip} onVipChange={setIsVip} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ========== 知识 Tab ==========
function KnowledgeTab({
  userId,
  isVip,
  hasOnboarded,
  onFinishedOnboard,
  onVipChange,
}: {
  userId: string;
  isVip: boolean;
  hasOnboarded: boolean;
  onFinishedOnboard: () => void;
  onVipChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<"onboard" | "list">(hasOnboarded ? "list" : "onboard");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [payModal, setPayModal] = useState<{ category?: Category; type: "category" | "vip" } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<KnowledgePoint & { learned?: boolean } | null>(null);
  const [categoryPoints, setCategoryPoints] = useState<(KnowledgePoint & { learned?: boolean; push_date?: string })[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/app/categories-with-progress?user_id=${userId}`);
      setCategories(data);
    } catch (e) {
      Alert.alert("加载失败", String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadOnboardCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/app/categories");
      setCategories(data);
    } catch (e) {
      Alert.alert("加载失败", String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "onboard") loadOnboardCategories();
    else loadCategories();
  }, [mode, userId]);

  const toggleOnboard = (c: Category) => {
    if (!c.is_free && !isVip) {
      setPayModal({ category: c, type: "category" });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      return next;
    });
  };

  const confirmOnboard = async () => {
    for (const cid of selectedIds) {
      await api.post(`/app/subscribe?user_id=${userId}&category_id=${cid}`);
    }
    await api.post(`/app/onboard-done?user_id=${userId}`);
    onFinishedOnboard();
    setMode("list");
    loadCategories();
  };

  const openCategory = async (c: Category) => {
    if (!c.is_unlocked && !c.is_free && !isVip) {
      setPayModal({ category: c, type: "category" });
      return;
    }
    try {
      const { data } = await api.get(`/app/category/${c.id}/points?user_id=${userId}`);
      setCategoryPoints(data);
      setSelectedCategory(c);
    } catch (e) {
      Alert.alert("加载失败", String(e));
    }
  };

  const handleGet = async () => {
    if (!currentPoint || !userId) return;
    await api.post(`/app/learn?user_id=${userId}`, {
      knowledge_point_id: currentPoint.id,
      action: "get",
    });
    setCurrentPoint(null);
    if (selectedCategory) {
      const { data } = await api.get(`/app/category/${selectedCategory.id}/points?user_id=${userId}`);
      setCategoryPoints(data);
    }
    loadCategories();
  };

  const handleLater = async () => {
    if (!currentPoint || !userId) return;
    await api.post(`/app/learn?user_id=${userId}`, {
      knowledge_point_id: currentPoint.id,
      action: "later",
    });
    setCurrentPoint(null);
    Alert.alert("已加入稍后", "一小时后会再次推送");
  };

  // 首次引导：选择知识类型
  if (mode === "onboard") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>选择知识类型</Text>
        <Text style={styles.subtitle}>可多选，免费类型直接选；付费类型需先开通</Text>
        {loading ? (
          <Text style={styles.subtitle}>加载中...</Text>
        ) : (
          <ScrollView style={styles.list}>
            {categories.map((c) => {
              const locked = !c.is_free && !isVip;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.card,
                    locked && styles.cardLocked,
                    selectedIds.has(c.id) && styles.cardSelected,
                  ]}
                  onPress={() => toggleOnboard(c)}
                >
                  <Text style={[styles.cardIcon, locked && styles.cardLockedText]}>{c.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, locked && styles.cardLockedText]}>{c.name}</Text>
                    {locked && (
                      <Text style={styles.lockHint}>
                        🔒 付费 {(c.price ?? 0) / 100}元
                      </Text>
                    )}
                  </View>
                  {selectedIds.has(c.id) && <Text style={styles.check}>✓</Text>}
                  {locked && !selectedIds.has(c.id) && <Text style={styles.lockIcon}>🔒</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <TouchableOpacity
          style={[styles.btn, selectedIds.size === 0 && styles.btnDisabled]}
          onPress={confirmOnboard}
          disabled={selectedIds.size === 0}
        >
          <Text style={styles.btnText}>开始学习</Text>
        </TouchableOpacity>
        <PayModal
          visible={!!payModal}
          category={payModal?.category}
          type={payModal?.type ?? "category"}
          onClose={() => setPayModal(null)}
          userId={userId}
          onSuccess={(categoryId?: string) => {
            if (categoryId) setSelectedIds((s) => new Set([...s, categoryId]));
            setPayModal(null);
            onVipChange(true);
            loadCategories();
          }}
        />
        <StatusBar style="auto" />
      </View>
    );
  }

  // 分类列表 / 知识点列表
  if (selectedCategory) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedCategory(null)}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>{selectedCategory.icon} {selectedCategory.name}</Text>
        <ScrollView style={styles.list}>
          {categoryPoints.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.pointCard}
              onPress={() => setCurrentPoint(p)}
            >
              <Text style={styles.pointTitle}>{p.title}</Text>
              <View style={styles.pointMeta}>
                <Text style={styles.pointDate}>{p.push_date}</Text>
                {p.learned && <Text style={styles.learnedBadge}>✓ 已学</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Modal visible={!!currentPoint} transparent animationType="fade">
          <View style={styles.modalMask}>
            <View style={styles.modal}>
              {currentPoint && (
                <>
                  <Text style={styles.modalTitle}>{currentPoint.title}</Text>
                  <ScrollView style={styles.modalContent}>
                    <Text style={styles.modalBody}>{currentPoint.content}</Text>
                  </ScrollView>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnLater]} onPress={handleLater}>
                      <Text>稍后了解</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGet]} onPress={handleGet}>
                      <Text style={styles.modalBtnGetText}>Get!</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
        <StatusBar style="auto" />
      </View>
    );
  }

  // 知识分类列表（首页）
  return (
    <View style={styles.container}>
      <Text style={styles.title}>知识列表</Text>
      <Text style={styles.subtitle}>已开通为正常色，未开通为灰色；包月 VIP 全部可用</Text>
      {loading ? (
        <Text style={styles.subtitle}>加载中...</Text>
      ) : (
        <ScrollView style={styles.list}>
          {categories.map((c) => {
            const locked = !c.is_unlocked;
            const statusText =
              c.status === "finished"
                ? "✓ 已学完"
                : c.status === "in_progress"
                ? "学习中"
                : "未开始";
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.card, locked && styles.cardLocked]}
                onPress={() => openCategory(c)}
              >
                <Text style={[styles.cardIcon, locked && styles.cardLockedText]}>{c.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, locked && styles.cardLockedText]}>{c.name}</Text>
                  <Text style={[styles.cardMeta, locked && styles.cardLockedText]}>
                    {c.learned_count}/{c.total_count} · {statusText}
                  </Text>
                </View>
                {locked && <Text style={styles.lockIcon}>🔒</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <PayModal
        visible={!!payModal}
        category={payModal?.category}
        type={payModal?.type ?? "category"}
        onClose={() => setPayModal(null)}
        userId={userId}
        onSuccess={() => {
          setPayModal(null);
          onVipChange(true);
          loadCategories();
        }}
      />
      <StatusBar style="auto" />
    </View>
  );
}

// ========== 付费弹窗 ==========
function PayModal({
  visible,
  category,
  type,
  onClose,
  userId,
  onSuccess,
}: {
  visible: boolean;
  category?: Category;
  type: "category" | "vip";
  onClose: () => void;
  userId: string;
  onSuccess: (categoryId?: string) => void;
}) {
  const handlePurchaseCategory = async () => {
    if (!category) return;
    try {
      await api.post(`/app/purchase/category?user_id=${userId}`, { category_id: category.id });
      Alert.alert("支付成功", "已开通该模块");
      onSuccess(category.id);
    } catch (e) {
      Alert.alert("支付失败", String(e));
    }
  };

  const handlePurchaseVip = async () => {
    try {
      await api.post(`/app/purchase/vip?user_id=${userId}`, { months: 1 });
      Alert.alert("支付成功", "已开通包月 VIP");
      onSuccess();
    } catch (e) {
      Alert.alert("支付失败", String(e));
    }
  };

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalMask}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>
            {type === "vip" ? "开通包月 VIP" : category ? `开通「${category.name}」` : "付费"}
          </Text>
          <Text style={styles.modalBody}>
            {type === "vip"
              ? "¥3.9/月，畅享全部知识模块"
              : `单模块 ¥${((category?.price ?? 0) / 100).toFixed(2)}`}
          </Text>
          <Text style={styles.modalHint}>（当前为模拟支付，直接成功）</Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnLater]} onPress={onClose}>
              <Text>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnGet]}
              onPress={type === "vip" ? handlePurchaseVip : handlePurchaseCategory}
            >
              <Text style={styles.modalBtnGetText}>确认支付</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ========== 考试 Tab ==========
function ExamTab({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState<{
    exam_id: string;
    questions: { question_id: string; title: string; content: string }[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const startExam = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post(`/app/exam/start?user_id=${userId}&size=5`);
      setExam(data);
      setAnswers({});
    } catch (e: any) {
      Alert.alert("提示", e?.response?.data?.detail || "暂无可出题的已学习知识点，请先学习一些内容");
    } finally {
      setLoading(false);
    }
  };

  const submitExam = async () => {
    if (!exam) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/app/exam/submit?user_id=${userId}`, {
        exam_id: exam.exam_id,
        answers: Object.entries(answers).map(([question_id, user_answer]) => ({
          question_id,
          user_answer,
        })),
      });
      setResult(data);
      setExam(null);
    } catch (e) {
      Alert.alert("提交失败", String(e));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>考试结果</Text>
        <Text style={styles.subtitle}>
          得分 {result.score} / {result.total}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={startExam}>
          <Text style={styles.btnText}>再来一次</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (exam) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>随机考试（{exam.questions.length} 题）</Text>
        <ScrollView style={styles.list}>
          {exam.questions.map((q, i) => (
            <View key={q.question_id} style={styles.examCard}>
              <Text style={styles.examQ}>第 {i + 1} 题：{q.title}</Text>
              <Text style={styles.modalBody}>{q.content}</Text>
              <Text style={styles.examLabel}>你的答案（填空/简答）：</Text>
              <TextInput
                style={styles.examInput}
                placeholder="请输入答案"
                value={answers[q.question_id] ?? ""}
                onChangeText={(v) => setAnswers((a) => ({ ...a, [q.question_id]: v }))}
              />
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 12, padding: 16 }}>
          <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={submitExam}>
            <Text style={styles.btnText}>交卷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.modalBtnLater, { flex: 1 }]} onPress={() => setExam(null)}>
            <Text>放弃</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>随机考试</Text>
      <Text style={styles.subtitle}>从已学过的知识点中随机抽题</Text>
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={startExam}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? "加载中..." : "开始考试"}</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </View>
  );
}

// ========== 个人信息 Tab ==========
function ProfileTab({
  userId,
  isVip,
  onVipChange,
}: {
  userId: string;
  isVip: boolean;
  onVipChange: (v: boolean) => void;
}) {
  const [examRecords, setExamRecords] = useState<{ id: string; score: number; total: number; created_at: string }[]>([]);
  const [curve, setCurve] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          api.get(`/app/exam/records?user_id=${userId}&limit=20`),
          api.get(`/app/curve/${userId}`),
        ]);
        setExamRecords(r1.data);
        setCurve(r2.data.curve || []);
      } catch {}
      setLoading(false);
    })();
  }, [userId]);

  const handlePurchaseVip = async () => {
    try {
      await api.post(`/app/purchase/vip?user_id=${userId}`, { months: 1 });
      Alert.alert("支付成功", "已开通包月 VIP");
      onVipChange(true);
    } catch (e) {
      Alert.alert("支付失败", String(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>我的</Text>
      <View style={styles.profileCard}>
        <Text style={styles.cardName}>微信用户</Text>
        <Text style={styles.cardMeta}>{isVip ? "VIP 会员" : "普通用户"}</Text>
        {!isVip && (
          <TouchableOpacity style={[styles.btn, { marginTop: 8 }]} onPress={handlePurchaseVip}>
            <Text style={styles.btnText}>开通 VIP ¥3.9/月</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.sectionTitle}>考试记录</Text>
      {loading ? (
        <Text style={styles.subtitle}>加载中...</Text>
      ) : examRecords.length === 0 ? (
        <Text style={styles.subtitle}>暂无考试记录</Text>
      ) : (
        <ScrollView style={styles.list}>
          {examRecords.map((r) => (
            <View key={r.id} style={styles.examRecordRow}>
              <Text style={styles.cardName}>
                {r.score}/{r.total} 分
              </Text>
              <Text style={styles.cardMeta}>
                {new Date(r.created_at).toLocaleDateString("zh-CN")}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
      <Text style={styles.sectionTitle}>学习曲线（按日统计）</Text>
      {curve.length === 0 ? (
        <Text style={styles.subtitle}>暂无数据</Text>
      ) : (
        <ScrollView horizontal style={{ marginHorizontal: -24, paddingHorizontal: 24 }}>
          <View style={styles.curveContainer}>
            {curve.slice(-14).map((d, i) => (
              <View key={d.date} style={styles.curveBar}>
                <View
                  style={[
                    styles.curveFill,
                    { height: `${Math.min(100, (d.count / Math.max(...curve.map((x) => x.count), 1)) * 80)}%` },
                  ]}
                />
                <Text style={styles.curveLabel}>{d.date.slice(5)}</Text>
                <Text style={styles.curveCount}>{d.count}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA", padding: 24, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1a1a2e", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 16, marginBottom: 12 },
  btn: {
    backgroundColor: "#4A90D9",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: "auto",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: "#4A90D9", fontSize: 16 },
  list: { flex: 1, marginVertical: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardLocked: { backgroundColor: "#e8e8e8", opacity: 0.9 },
  cardLockedText: { color: "#999" },
  cardSelected: { borderColor: "#4A90D9" },
  cardIcon: { fontSize: 28, marginRight: 12 },
  cardName: { fontSize: 16 },
  cardMeta: { fontSize: 12, color: "#999", marginTop: 4 },
  lockHint: { fontSize: 12, color: "#999", marginTop: 2 },
  lockIcon: { fontSize: 18 },
  check: { color: "#4A90D9", fontSize: 18 },
  pointCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12 },
  pointTitle: { fontSize: 16, fontWeight: "500" },
  pointDate: { fontSize: 12, color: "#999" },
  pointMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  learnedBadge: { color: "#4A90D9", fontSize: 12 },
  modalMask: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  modalContent: { maxHeight: 200, marginBottom: 16 },
  modalBody: { fontSize: 16, lineHeight: 24, color: "#333", marginBottom: 8 },
  modalHint: { fontSize: 12, color: "#999", marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  modalBtnLater: { backgroundColor: "#f0f0f0" },
  modalBtnGet: { backgroundColor: "#4A90D9" },
  modalBtnGetText: { color: "#fff", fontWeight: "600" },
  examCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12 },
  examQ: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  examLabel: { fontSize: 12, color: "#666", marginTop: 8 },
  examInput: { padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8, marginTop: 4 },
  examRecordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  curveContainer: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 4 },
  curveBar: { alignItems: "center", width: 28 },
  curveFill: {
    width: 20,
    backgroundColor: "#4A90D9",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  curveLabel: { fontSize: 10, color: "#666", marginTop: 4 },
  curveCount: { fontSize: 10, color: "#4A90D9", fontWeight: "600" },
  profileCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 16 },
});
