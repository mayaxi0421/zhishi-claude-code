import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import './index.scss'

// ── Disease data ───────────────────────────────────────────────────────────

interface DiseaseMetric { l: string; v: string; warn: boolean }
interface DiseaseData {
  name: string
  icon: string
  metrics: DiseaseMetric[]
  principles: string[]
  supps: string[]
}

const DISEASE_MAP: Record<string, DiseaseData> = {
  hyperglycemia: {
    name: '高血糖/糖尿病前期',
    icon: '🩸',
    metrics: [
      { l: '空腹血糖', v: '6.8 mmol/L', warn: true },
      { l: '餐后2h', v: '9.2 mmol/L', warn: true },
    ],
    principles: ['严格低GI，白米换糙米', '每餐碳水<40g', '进食顺序：蔬菜→蛋白→主食'],
    supps: ['铬 400μg/天', 'Omega-3 2g/天', '维生素B族'],
  },
  hypertension: {
    name: '高血压',
    icon: '❤️',
    metrics: [
      { l: '晨间血压', v: '128/82 mmHg', warn: true },
      { l: '夜间血压', v: '118/76 mmHg', warn: false },
    ],
    principles: ['每日钠<2000mg', 'DASH饮食多钾多镁', '限酒戒烟'],
    supps: ['镁 400mg/天', '辅酶Q10 100mg/天', '增加钾（香蕉菠菜）'],
  },
  pcos: {
    name: '多囊卵巢综合征',
    icon: '🌸',
    metrics: [
      { l: '体重', v: '58 kg', warn: false },
      { l: '腰围', v: '72 cm', warn: false },
    ],
    principles: ['低GI抗炎饮食', '控制乳制品', '增加膳食纤维'],
    supps: ['肌醇 4g/天', '维生素D 2000IU', 'Omega-3 1g/天'],
  },
  hashimoto: {
    name: '桥本甲状腺炎',
    icon: '🦋',
    metrics: [
      { l: 'TSH', v: '3.2 mIU/L', warn: false },
      { l: '体重趋势', v: '稳定', warn: false },
    ],
    principles: ['适量限制生十字花科', '避免碘过量', '可尝试无麸质'],
    supps: ['硒 200μg/天', '维生素D 3000IU', '锌 15mg/天'],
  },
}

// ── Supplement reminders mock data ────────────────────────────────────────

interface Supplement { name: string; time: string; done: boolean }

const HEALTHY_SUPPS: Supplement[] = [
  { name: '维生素D 2000IU', time: '早餐后', done: true },
  { name: 'Omega-3 1g', time: '午餐后', done: false },
  { name: '镁 300mg', time: '睡前', done: false },
]

const CHRONIC_SUPPS: Supplement[] = [
  { name: '铬 400μg', time: '早餐前', done: true },
  { name: 'Omega-3 2g', time: '午餐后', done: true },
  { name: '维生素B族', time: '早餐后', done: false },
  { name: '镁 400mg', time: '睡前', done: false },
  { name: '辅酶Q10 100mg', time: '早餐后', done: false },
]

// ── Disease card component ─────────────────────────────────────────────────

interface DiseaseCardProps {
  data: DiseaseData
  expanded: boolean
  onToggle: () => void
}

function DiseaseCard({ data, expanded, onToggle }: DiseaseCardProps) {
  function logMetric() {
    Taro.showModal({
      title: '录入今日指标',
      content: `请前往专业设备记录 ${data.name} 相关指标`,
      showCancel: false,
      confirmText: '知道了',
    })
  }

  return (
    <View className="prf-disease-card">
      <View className="prf-disease-header" onClick={onToggle}>
        <View className="prf-disease-icon-box">
          <Text className="prf-disease-icon">{data.icon}</Text>
        </View>
        <View className="prf-disease-title-wrap">
          <Text className="prf-disease-name">{data.name}</Text>
          <View className="prf-disease-badge">
            <Text className="prf-disease-badge-text">管理中</Text>
          </View>
        </View>
        <Text className="prf-disease-chevron">{expanded ? '∨' : '›'}</Text>
      </View>

      {expanded && (
        <View className="prf-disease-body">
          {/* Metrics */}
          <View className="prf-metrics-row">
            {data.metrics.map((m, i) => (
              <View key={i} className={`prf-metric-cell ${m.warn ? 'prf-metric-cell--warn' : ''}`}>
                <Text className="prf-metric-label">{m.l}</Text>
                <Text className={`prf-metric-value ${m.warn ? 'prf-metric-value--warn' : ''}`}>
                  {m.v}
                </Text>
                {m.warn && <Text className="prf-metric-warn-tag">偏高</Text>}
              </View>
            ))}
          </View>

          {/* Log button */}
          <View className="prf-log-btn" onClick={logMetric}>
            <Text className="prf-log-btn-text">+ 录入今日指标</Text>
          </View>

          {/* Dietary principles */}
          <View className="prf-principles">
            <Text className="prf-principles-title">核心饮食原则</Text>
            {data.principles.map((p, i) => (
              <View key={i} className="prf-principle-row">
                <View className="prf-principle-dot" />
                <Text className="prf-principle-text">{p}</Text>
              </View>
            ))}
          </View>

          {/* Supplement pills */}
          <View className="prf-supp-pills">
            {data.supps.map((s, i) => (
              <View key={i} className="prf-supp-pill">
                <Text className="prf-supp-pill-text">💊 {s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Profile() {
  const { profile, loadFromStorage } = useUserStore()
  const [supps, setSupps] = useState<Supplement[]>([])
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    hyperglycemia: true,
    hypertension: false,
  })

  useEffect(() => {
    loadFromStorage()
  }, [])

  const hasProfile = !!(profile?.height && profile?.weight)

  // Determine layout
  const conditions = profile?.conditions ?? []
  const isHealthy = conditions.length === 0 || profile?.isHealthy === true

  useEffect(() => {
    setSupps(isHealthy ? [...HEALTHY_SUPPS] : [...CHRONIC_SUPPS])
  }, [isHealthy])

  const h = profile?.height ?? 0
  const w = profile?.weight ?? 0
  const bmi = h > 0 ? (w / ((h / 100) ** 2)).toFixed(1) : '--'

  const goalMap: Record<string, string> = {
    lose: '减重',
    gain: '增肌',
    maintain: '维持体重',
    health: '健康管理',
  }
  const goalLabel = goalMap[profile?.goal ?? ''] ?? '--'

  function toggleSupp(idx: number) {
    setSupps(prev => prev.map((s, i) => i === idx ? { ...s, done: !s.done } : s))
  }

  function toggleCard(key: string) {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const activeConditions = conditions.filter(c => DISEASE_MAP[c])

  const allergyLabels: Record<string, string> = {
    seafood: '海鲜', peanut: '花生', milk: '牛奶', egg: '鸡蛋',
    soy: '大豆', wheat: '小麦/麸质', nut: '坚果', shellfish: '贝壳类',
  }
  const allergies = (profile?.allergies ?? []).map(a => allergyLabels[a] ?? a)

  // Empty state for new users
  if (!hasProfile) {
    return (
      <ScrollView className="prf-scroll" scrollY>
        <View className="prf-empty">
          <Text className="prf-empty-emoji">🌱</Text>
          <Text className="prf-empty-title">还没有健康档案</Text>
          <Text className="prf-empty-desc">建立档案后，小知才能给你个性化的饮食建议</Text>
          <View className="prf-empty-btn" onClick={() => Taro.navigateTo({ url: '/pages/onboard/index' })}>
            <Text className="prf-empty-btn-text">立即建立档案</Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView className="prf-scroll" scrollY>
      {/* Hero */}
      <View className={`prf-hero ${isHealthy ? 'prf-hero--healthy' : 'prf-hero--chronic'}`}>
        <View className="prf-avatar">
          <Text className="prf-avatar-emoji">{isHealthy ? '😊' : '💪'}</Text>
        </View>
        <Text className="prf-name">{profile?.name ?? '健康用户'}</Text>
        <Text className="prf-join">已坚持 1 天 🔥</Text>
        {!isHealthy && (
          <View className="prf-hero-tags">
            {activeConditions.map(c => (
              <View key={c} className="prf-hero-tag">
                <Text className="prf-hero-tag-text">{DISEASE_MAP[c]?.icon} {DISEASE_MAP[c]?.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Stats row */}
      <View className="prf-stats-row">
        {[
          { label: '身高', value: `${h}`, unit: 'cm' },
          { label: '体重', value: `${w}`, unit: 'kg' },
          { label: 'BMI', value: bmi, unit: '' },
          { label: '目标', value: goalLabel, unit: '' },
        ].map(s => (
          <View key={s.label} className="prf-stat-cell">
            <View className="prf-stat-val-row">
              <Text className="prf-stat-val">{s.value}</Text>
              {s.unit ? <Text className="prf-stat-unit">{s.unit}</Text> : null}
            </View>
            <Text className="prf-stat-label">{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── HEALTHY LAYOUT ─────────────────────────────── */}
      {isHealthy && (
        <>
          {/* 健康目标 */}
          <View className="prf-section-card">
            <Text className="prf-section-title">🎯 健康目标</Text>
            <View className="prf-goal-rows">
              <View className="prf-goal-row">
                <Text className="prf-goal-icon">🍽</Text>
                <View className="prf-goal-info">
                  <Text className="prf-goal-label">饮食目标</Text>
                  <Text className="prf-goal-value">{goalLabel}</Text>
                </View>
              </View>
              <View className="prf-goal-row">
                <Text className="prf-goal-icon">🔥</Text>
                <View className="prf-goal-info">
                  <Text className="prf-goal-label">每日热量目标</Text>
                  <Text className="prf-goal-value">{profile?.dailyCalories ?? 1600} kcal</Text>
                </View>
              </View>
              <View className="prf-goal-row">
                <Text className="prf-goal-icon">🏃</Text>
                <View className="prf-goal-info">
                  <Text className="prf-goal-label">运动计划</Text>
                  <Text className="prf-goal-value">每周 3-4 次有氧 + 力量训练</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 饮食偏好 */}
          <View className="prf-section-card">
            <Text className="prf-section-title">🥗 饮食偏好</Text>
            <View className="prf-pref-chips">
              {['高蛋白', '低碳水', '地中海风格', '少油少盐'].map(t => (
                <View key={t} className="prf-pref-chip">
                  <Text className="prf-pref-chip-text">{t}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* ── BOTH LAYOUTS: Allergies ───────────────────── */}
      <View className="prf-section-card">
        <Text className="prf-section-title">⚠️ 过敏源</Text>
        {allergies.length > 0 ? (
          <View className="prf-allergy-chips">
            {allergies.map(a => (
              <View key={a} className="prf-allergy-chip">
                <Text className="prf-allergy-chip-text">🚫 {a}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="prf-empty-text">暂无记录的过敏源</Text>
        )}
      </View>

      {/* ── CHRONIC LAYOUT: Disease cards ─────────────── */}
      {!isHealthy && (
        <View className="prf-diseases-section">
          <Text className="prf-diseases-heading">🏥 慢病管理</Text>
          {activeConditions.map(c => {
            const data = DISEASE_MAP[c]
            if (!data) return null
            return (
              <DiseaseCard
                key={c}
                data={data}
                expanded={!!expandedCards[c]}
                onToggle={() => toggleCard(c)}
              />
            )
          })}
        </View>
      )}

      {/* ── BOTH LAYOUTS: Supplement reminders ──────────── */}
      <View className="prf-section-card">
        <Text className="prf-section-title">💊 营养补剂提醒</Text>
        <View className="prf-supps-list">
          {supps.map((s, i) => (
            <View key={i} className="prf-supp-row" onClick={() => toggleSupp(i)}>
              <View className={`prf-supp-check ${s.done ? 'prf-supp-check--done' : ''}`}>
                {s.done && <Text className="prf-supp-check-icon">✓</Text>}
              </View>
              <View className="prf-supp-info">
                <Text className={`prf-supp-name ${s.done ? 'prf-supp-name--done' : ''}`}>
                  {s.name}
                </Text>
                <Text className="prf-supp-time">{s.time}</Text>
              </View>
              {s.done && <Text className="prf-supp-done-tag">已服用</Text>}
            </View>
          ))}
        </View>
      </View>

      {/* Chat update card */}
      <View className="prf-chat-card">
        <View className="prf-chat-left">
          <Text className="prf-chat-icon">💬</Text>
          <View>
            <Text className="prf-chat-title">更新健康档案</Text>
            <Text className="prf-chat-sub">与 AI 对话，更新你的身体状况</Text>
          </View>
        </View>
        <View
          className="prf-chat-btn"
          onClick={() => Taro.navigateTo({ url: '/pages/assistant/index' })}
        >
          <Text className="prf-chat-btn-text">去更新</Text>
        </View>
      </View>

      <View className="prf-bottom-space" />
    </ScrollView>
  )
}
