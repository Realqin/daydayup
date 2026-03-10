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
import Svg, { Path, Circle, Ellipse } from "react-native-svg";
import { api, Category, KnowledgePoint } from "./src/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type Step = "login" | "onboard" | "home";
const Tab = createBottomTabNavigator();

/** 后台静默请求通知权限并上报 token */
async function registerPushInBackground(userId: string) {
  if (!Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api.post(`/app/push-token?user_id=${userId}`, { token, platform: Platform.OS });
  } catch {}
}

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
      registerPushInBackground(data.user_id);
      setStep(data.has_onboarded ? "home" : "onboard");
    } catch (e) {
      Alert.alert("登录失败", String(e));
    }
  };

  if (step === "login") {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginBgShape1} />
        <View style={styles.loginBgShape2} />
        <View style={styles.loginContent}>
          <View style={styles.loginIllustration}>
            <MeditationIllustration />
          </View>
          <Text style={styles.loginTitle}>拾刻</Text>
          <Text style={styles.loginSlogan}>拾取片刻光阴，收获点滴智慧</Text>
          <TouchableOpacity style={styles.wechatBtn} onPress={handleWechatLogin}>
            <Text style={styles.wechatIcon}>💬</Text>
            <Text style={styles.wechatBtnText}>微信快捷登录</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="dark" />
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

/** 冥想人物插画 - 黑白线条风格 */
function MeditationIllustration() {
  return (
    <Svg width={180} height={200} viewBox="0 0 180 200">
      <Circle cx="90" cy="45" r="28" stroke="#333" strokeWidth="2" fill="none" />
      <Path
        d="M 62 73 Q 90 95 118 73 L 118 120 Q 90 140 62 120 Z"
        stroke="#333"
        strokeWidth="2"
        fill="none"
      />
      <Path d="M 75 95 L 65 130 M 105 95 L 115 130" stroke="#333" strokeWidth="2" fill="none" />
      <Ellipse cx="90" cy="155" rx="50" ry="12" stroke="#333" strokeWidth="2" fill="none" />
      <Path d="M 70 95 L 55 105 M 110 95 L 125 105" stroke="#333" strokeWidth="2" fill="none" />
    </Svg>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showOnboardHint, setShowOnboardHint] = useState(false);
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

  const selectOnboard = (c: Category) => {
    if (!c.is_free && !isVip) {
      setPayModal({ category: c, type: "category" });
      return;
    }
    setSelectedId((prev) => (prev === c.id ? null : c.id));
  };

  const confirmOnboard = async () => {
    if (!selectedId) return;
    await api.post(`/app/subscribe?user_id=${userId}&category_id=${selectedId}`);
    await api.post(`/app/onboard-done?user_id=${userId}`);
    setShowOnboardHint(true);
  };

  const dismissOnboardHint = () => {
    setShowOnboardHint(false);
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

  // 首次引导：选择知识类型（单选）
  if (mode === "onboard") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>选择知识类型</Text>
        <Text style={styles.subtitle}>选择你感兴趣的知识领域，免费类型直接选</Text>
        {loading ? (
          <Text style={styles.subtitle}>加载中...</Text>
        ) : (
          <ScrollView style={styles.list}>
            {categories.map((c) => {
              const locked = !c.is_free && !isVip;
              const selected = selectedId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.card,
                    locked && styles.cardLocked,
                    selected && styles.cardSelected,
                  ]}
                  onPress={() => selectOnboard(c)}
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
                  {selected && <Text style={styles.check}>✓</Text>}
                  {locked && !selected && <Text style={styles.lockIcon}>🔒</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <TouchableOpacity
          style={[styles.btn, !selectedId && styles.btnDisabled]}
          onPress={confirmOnboard}
          disabled={!selectedId}
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
            if (categoryId) setSelectedId(categoryId);
            setPayModal(null);
            onVipChange(true);
            loadOnboardCategories();
          }}
        />
        <Modal visible={showOnboardHint} transparent animationType="fade">
          <View style={styles.modalMask}>
            <View style={styles.onboardHintModal}>
              <Text style={styles.onboardHintText}>知识要进入我们的脑海咯</Text>
              <TouchableOpacity style={styles.modalBtnGet} onPress={dismissOnboardHint}>
                <Text style={styles.modalBtnGetText}>好的</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
type ExamQuestion = {
  question_id: string;
  title: string;
  options: string[];
  correct_answer: string;
};

function ExamTab({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [moduleCategories, setModuleCategories] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [showModulePicker, setShowModulePicker] = useState(false);
  const [exam, setExam] = useState<{
    exam_id: string;
    exam_type: string;
    questions: ExamQuestion[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const startPlacementExam = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post(
        `/app/exam/start?user_id=${userId}&exam_type=placement&size=10`
      );
      setExam(data);
      setAnswers({});
    } catch (e: any) {
      Alert.alert("提示", e?.response?.data?.detail || "暂无可出题，请先在后台维护问题");
    } finally {
      setLoading(false);
    }
  };

  const loadModuleCategories = async () => {
    try {
      const { data } = await api.get(`/app/exam/categories?user_id=${userId}`);
      setModuleCategories(data);
      setShowModulePicker(true);
    } catch (e: any) {
      Alert.alert("提示", e?.response?.data?.detail || "加载失败");
    }
  };

  const startModuleExam = async (categoryId: string) => {
    setShowModulePicker(false);
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post(
        `/app/exam/start?user_id=${userId}&exam_type=module&category_id=${categoryId}&size=10`
      );
      setExam(data);
      setAnswers({});
    } catch (e: any) {
      Alert.alert("提示", e?.response?.data?.detail || "暂无可出题");
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

  const toggleOption = (questionId: string, optionLetter: string) => {
    setAnswers((prev) => {
      const cur = prev[questionId] || "";
      const letters = cur.split("").filter(Boolean);
      if (letters.includes(optionLetter)) {
        return { ...prev, [questionId]: letters.filter((l) => l !== optionLetter).sort().join("") };
      }
      return { ...prev, [questionId]: [...letters, optionLetter].sort().join("") };
    });
  };

  const selectSingleOption = (questionId: string, optionLetter: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionLetter }));
  };

  if (result) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>考试结果</Text>
        <Text style={styles.subtitle}>
          得分 {result.score} / {result.total}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => setResult(null)}>
          <Text style={styles.btnText}>返回</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (showModulePicker) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>选择知识模块</Text>
        <Text style={styles.subtitle}>选择要考试的模块</Text>
        <ScrollView style={styles.list}>
          {moduleCategories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.card}
              onPress={() => startModuleExam(c.id)}
            >
              <Text style={styles.cardIcon}>{c.icon}</Text>
              <Text style={styles.cardName}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.modalBtn, styles.modalBtnLater, { marginTop: 16, alignSelf: "center" }]}
          onPress={() => setShowModulePicker(false)}
        >
          <Text>返回</Text>
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
          {exam.questions.map((q, i) => {
            const selected = answers[q.question_id] || "";
            const isMulti = q.correct_answer.length > 1;
            const optionLetters = "ABCDEFGH".slice(0, q.options.length);
            return (
              <View key={q.question_id} style={styles.examCard}>
                <Text style={styles.examQ}>第 {i + 1} 题：{q.title}</Text>
                {q.options.map((opt, j) => {
                  const letter = optionLetters[j];
                  const isSelected = isMulti ? selected.includes(letter) : selected === letter;
                  return (
                    <TouchableOpacity
                      key={j}
                      style={[
                        styles.examOption,
                        isSelected && styles.examOptionSelected,
                      ]}
                      onPress={() =>
                        isMulti ? toggleOption(q.question_id, letter) : selectSingleOption(q.question_id, letter)
                      }
                    >
                      <Text style={[styles.examOptionText, isSelected && styles.examOptionTextSelected]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 12, padding: 16 }}>
          <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={submitExam}>
            <Text style={styles.btnText}>交卷</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.modalBtnLater, { flex: 1 }]}
            onPress={() => setExam(null)}
          >
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
      <View style={{ gap: 12, width: "100%", maxWidth: 280, alignSelf: "center" }}>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={startPlacementExam}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? "加载中..." : "摸底考试"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={loadModuleCategories}
          disabled={loading}
        >
          <Text style={styles.btnText}>模块考试</Text>
        </TouchableOpacity>
      </View>
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
  const [totalDays, setTotalDays] = useState(0);
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
        setTotalDays(r2.data.total_days ?? r2.data.curve?.length ?? 0);
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
      <Text style={styles.sectionTitle}>打卡日历</Text>
      <Text style={styles.subtitle}>累计打卡 {totalDays} 天</Text>
      {curve.length === 0 ? (
        <Text style={styles.subtitle}>暂无打卡记录，点击 Get 开始学习</Text>
      ) : (
        <View style={styles.calendarGrid}>
          {curve.slice(-42).map((d) => (
            <View
              key={d.date}
              style={[styles.calendarCell, d.count > 0 && styles.calendarCellChecked]}
            >
              <Text style={[styles.calendarCellText, d.count > 0 && styles.calendarCellTextChecked]}>
                {d.date.slice(8)}
              </Text>
            </View>
          ))}
        </View>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: "#fff" },
  loginBgShape1: {
    position: "absolute",
    top: -40,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255, 200, 200, 0.4)",
  },
  loginBgShape2: {
    position: "absolute",
    top: "35%",
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 220, 220, 0.35)",
  },
  loginContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loginIllustration: { marginBottom: 24 },
  loginTitle: { fontSize: 32, fontWeight: "bold", color: "#1a1a2e", marginBottom: 8 },
  loginSlogan: { fontSize: 15, color: "#666", textAlign: "center", marginBottom: 48 },
  wechatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07C160",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
  },
  wechatIcon: { fontSize: 20 },
  wechatBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
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
  onboardHintModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  onboardHintText: { fontSize: 18, color: "#333", marginBottom: 20 },
  modalActions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  modalBtnLater: { backgroundColor: "#f0f0f0" },
  modalBtnGet: { backgroundColor: "#4A90D9" },
  modalBtnGetText: { color: "#fff", fontWeight: "600" },
  examCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12 },
  examQ: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  examLabel: { fontSize: 12, color: "#666", marginTop: 8 },
  examInput: { padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8, marginTop: 4 },
  examOption: {
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  examOptionSelected: { backgroundColor: "#E8F5E9", borderColor: "#4A90D9" },
  examOptionText: { fontSize: 15, color: "#333" },
  examOptionTextSelected: { color: "#4A90D9", fontWeight: "500" },
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
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  calendarCell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCellChecked: { backgroundColor: "#4A90D9" },
  calendarCellText: { fontSize: 12, color: "#999" },
  calendarCellTextChecked: { color: "#fff", fontWeight: "600" },
  profileCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 16 },
});
