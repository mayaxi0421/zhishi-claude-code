import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import './index.scss'

// ── Disease data ───────────────────────────────────────────────────────────

interface MetricField { key: string; label: string; unit: string; placeholder: string; warnHigh?: number; warnLow?: number }

const DISEASE_METRIC_FIELDS: Record<string, MetricField[]> = {
  hyperglycemia: [
    { key: 'fasting',  label: '空腹血糖',  unit: 'mmol/L', placeholder: '如: 5.6', warnHigh: 6.1 },
    { key: 'postmeal', label: '餐后2h血糖', unit: 'mmol/L', placeholder: '如: 7.8', warnHigh: 7.8 },
  ],
  hypertension: [
    { key: 'systolic',  label: '收缩压', unit: 'mmHg', placeholder: '如: 120', warnHigh: 130 },
    { key: 'diastolic', label: '舒张压', unit: 'mmHg', placeholder: '如: 80',  warnHigh: 85  },
  ],
  pcos: [
    { key: 'weight', label: '体重', unit: 'kg', placeholder: '如: 58.5' },
    { key: 'waist',  label: '腰围', unit: 'cm', placeholder: '如: 72'   },
  ],
  hashimoto: [
    { key: 'tsh', label: 'TSH', unit: 'mIU/L', placeholder: '如: 2.5', warnHigh: 4.5, warnLow: 0.4 },
  ],
  gout: [
    { key: 'uric_acid', label: '尿酸', unit: 'μmol/L', placeholder: '如: 380', warnHigh: 420 },
  ],
  hyperlipidemia: [
    { key: 'cholesterol',   label: '总胆固醇', unit: 'mmol/L', placeholder: '如: 5.2', warnHigh: 5.2 },
    { key: 'triglycerides', label: '甘油三酯', unit: 'mmol/L', placeholder: '如: 1.7', warnHigh: 1.7 },
  ],
}

interface DiseaseData {
  name: string
  icon: string
  principles: string[]
  supps: string[]
}

const DISEASE_MAP: Record<string, DiseaseData> = {
  hyperglycemia: {
    name: '高血糖/糖尿病前期', icon: '🩸',
    principles: ['严格低GI，白米换糙米', '每餐碳水<40g', '进食顺序：蔬菜→蛋白→主食'],
    supps: ['铬 400μg/天', 'Omega-3 2g/天', '维生素B族'],
  },
  hypertension: {
    name: '高血压', icon: '❤️',
    principles: ['每日钠<2000mg', 'DASH饮食多钾多镁', '限酒戒烟'],
    supps: ['镁 400mg/天', '辅酶Q10 100mg/天', '增加钾（香蕉菠菜）'],
  },
  pcos: {
    name: '多囊卵巢综合征', icon: '🌸',
    principles: ['低GI抗炎饮食', '控制乳制品', '增加膳食纤维'],
    supps: ['肌醇 4g/天', '维生素D 2000IU', 'Omega-3 1g/天'],
  },
  hashimoto: {
    name: '桥本甲状腺炎', icon: '🦋',
    principles: ['适量限制生十字花科', '避免碘过量', '可尝试无麸质'],
    supps: ['硒 200μg/天', '维生素D 3000IU', '锌 15mg/天'],
  },
  gout: {
    name: '痛风', icon: '🦵',
    principles: ['避免高嘌呤食物（内脏、海鲜）', '多喝水促进尿酸排泄', '限制酒精尤其啤酒'],
    supps: ['维生素C 500mg/天', '叶酸 400μg/天'],
  },
  hyperlipidemia: {
    name: '高血脂', icon: '🫀',
    principles: ['减少饱和脂肪和反式脂肪', '增加可溶性膳食纤维', '多吃深海鱼'],
    supps: ['Omega-3 2g/天', '植物固醇 2g/天', '辅酶Q10 100mg/天'],
  },
}

// ── Supplement data ───────────────────────────────────────────────────────

interface Supplement { name: string; time: string; done: boolean }

const HEALTHY_SUPPS: Supplement[] = [
  { name: '维生素D 2000IU', time: '早餐后', done: false },
  { name: 'Omega-3 1g',    time: '午餐后', done: false },
  { name: '镁 300mg',      time: '睡前',   done: false },
]

const CHRONIC_SUPPS: Supplement[] = [
  { name: '铬 400μg',      time: '早餐前', done: false },
  { name: 'Omega-3 2g',    time: '午餐后', done: false },
  { name: '维生素B族',      time: '早餐后', done: false },
  { name: '镁 400mg',      time: '睡前',   done: false },
  { name: '辅酶Q10 100mg', time: '早餐后', done: false },
]

// ── Metric storage helpers ────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }
function metricKey(condition: string) { return `metrics_${todayStr()}_${condition}` }

function loadTodayMetrics(conditions: string[]): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  for (const c of conditions) {
    try {
      const raw = Taro.getStorageSync(metricKey(c))
      if (raw) result[c] = JSON.parse(raw)
    } catch {}
  }
  return result
}

function isMetricWarn(field: MetricField, value: string): boolean {
  const v = parseFloat(value)
  if (isNaN(v)) return false
  if (field.warnHigh !== undefined && v > field.warnHigh) return true
  if (field.warnLow  !== undefined && v < field.warnLow)  return true
  return false
}

// ── Disease card ──────────────────────────────────────────────────────────

interface DiseaseCardProps {
  conditionKey: string
  data: DiseaseData
  fields: MetricField[]
  todayValues: Record<string, string>
  expanded: boolean
  onToggle: () => void
  onLogMetric: () => void
}

function DiseaseCard({ conditionKey, data, fields, todayValues, expanded, onToggle, onLogMetric }: DiseaseCardProps) {
  const hasValues = Object.keys(todayValues).length > 0

  return (
    <View className="prf-disease-card">
      <View className="prf-disease-header" onClick={onToggle}>
        <View className="prf-disease-icon-box">
          <Text className="prf-disease-icon">{data.icon}</Text>
        </View>
        <View className="prf-disease-title-wrap">
          <Text className="prf-disease-name">{data.name}</Text>
          <View className="prf-disease-badge">
            <Text className="prf-disease-badge-text">{hasValues ? '今日已记录' : '管理中'}</Text>
          </View>
        </View>
        <Text className="prf-disease-chevron">{expanded ? '∨' : '›'}</Text>
      </View>

      {expanded && (
        <View className="prf-disease-body">
          {/* Metrics */}
          <View className="prf-metrics-row">
            {fields.map((f) => {
              const val = todayValues[f.key]
              const warn = val ? isMetricWarn(f, val) : false
              return (
                <View key={f.key} className={`prf-metric-cell ${warn ? 'prf-metric-cell--warn' : ''}`}>
                  <Text className="prf-metric-label">{f.label}</Text>
                  <Text className={`prf-metric-value ${warn ? 'prf-metric-value--warn' : ''}`}>
                    {val ? `${val} ${f.unit}` : '--'}
                  </Text>
                  {warn && <Text className="prf-metric-warn-tag">偏高</Text>}
                </View>
              )
            })}
          </View>

          {/* Log button */}
          <View className="prf-log-btn" onClick={onLogMetric}>
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
  const [supps,         setSupps]         = useState<Supplement[]>([])
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const [todayMetrics,  setTodayMetrics]  = useState<Record<string, Record<string, string>>>({})
  const [logModal, setLogModal] = useState<{
    condition: string;
    values: Record<string, string>;
  } | null>(null)

  useEffect(() => { loadFromStorage() }, [])

  const hasProfile  = !!(profile?.height && profile?.weight)
  const conditions  = profile?.conditions ?? []
  const isHealthy   = conditions.length === 0 || profile?.isHealthy === true
  const suppKey     = `supps_${todayStr()}_${isHealthy ? 'h' : 'c'}`

  // Load supplements (today's saved state, else defaults)
  useEffect(() => {
    try {
      const saved = Taro.getStorageSync(suppKey)
      if (saved) {
        setSupps(JSON.parse(saved))
      } else {
        setSupps(isHealthy ? [...HEALTHY_SUPPS] : [...CHRONIC_SUPPS])
      }
    } catch {
      setSupps(isHealthy ? [...HEALTHY_SUPPS] : [...CHRONIC_SUPPS])
    }
  }, [isHealthy, suppKey])

  // Load today's metrics for active conditions
  useEffect(() => {
    const activeConditions = conditions.filter(c => DISEASE_MAP[c])
    if (activeConditions.length > 0) {
      setTodayMetrics(loadTodayMetrics(activeConditions))
    }
  }, [conditions.join(',')])

  const h = profile?.height ?? 0
  const w = profile?.weight ?? 0
  const bmi = h > 0 ? (w / ((h / 100) ** 2)).toFixed(1) : '--'

  const goalMap: Record<string, string> = {
    lose: '减重', gain: '增肌', maintain: '维持体重', health: '健康管理',
  }
  const goalLabel = goalMap[profile?.goal ?? ''] ?? '--'

  function toggleSupp(idx: number) {
    setSupps(prev => {
      const next = prev.map((s, i) => i === idx ? { ...s, done: !s.done } : s)
      Taro.setStorageSync(suppKey, JSON.stringify(next))
      return next
    })
  }

  function toggleCard(key: string) {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function openLogModal(condition: string) {
    const existing = todayMetrics[condition] ?? {}
    setLogModal({ condition, values: { ...existing } })
  }

  function saveMetrics() {
    if (!logModal) return
    const { condition, values } = logModal
    Taro.setStorageSync(metricKey(condition), JSON.stringify(values))
    setTodayMetrics(prev => ({ ...prev, [condition]: values }))
    setLogModal(null)
    Taro.showToast({ title: '记录成功', icon: 'success' })
  }

  const activeConditions = conditions.filter(c => DISEASE_MAP[c])

  const allergyLabels: Record<string, string> = {
    seafood: '海鲜', peanut: '花生', milk: '牛奶', egg: '鸡蛋',
    soy: '大豆', wheat: '小麦/麸质', nut: '坚果', shellfish: '贝壳类',
    乳制品: '乳制品', 麸质: '麸质',
  }
  const allergies = (profile?.allergies ?? []).map(a => allergyLabels[a] ?? a)

  // Empty state
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
          { label: 'BMI',  value: bmi,    unit: '' },
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

      {/* Allergens */}
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
            const data   = DISEASE_MAP[c]
            const fields = DISEASE_METRIC_FIELDS[c] ?? []
            if (!data) return null
            return (
              <DiseaseCard
                key={c}
                conditionKey={c}
                data={data}
                fields={fields}
                todayValues={todayMetrics[c] ?? {}}
                expanded={!!expandedCards[c]}
                onToggle={() => toggleCard(c)}
                onLogMetric={() => openLogModal(c)}
              />
            )
          })}
        </View>
      )}

      {/* Supplement reminders */}
      <View className="prf-section-card">
        <Text className="prf-section-title">💊 今日营养补剂</Text>
        <View className="prf-supps-list">
          {supps.map((s, i) => (
            <View key={i} className="prf-supp-row" onClick={() => toggleSupp(i)}>
              <View className={`prf-supp-check ${s.done ? 'prf-supp-check--done' : ''}`}>
                {s.done && <Text className="prf-supp-check-icon">✓</Text>}
              </View>
              <View className="prf-supp-info">
                <Text className={`prf-supp-name ${s.done ? 'prf-supp-name--done' : ''}`}>{s.name}</Text>
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
        <View className="prf-chat-btn" onClick={() => Taro.navigateTo({ url: '/pages/assistant/index' })}>
          <Text className="prf-chat-btn-text">去更新</Text>
        </View>
      </View>

      <View className="prf-bottom-space" />

      {/* ── Metric log modal ─────────────────────────── */}
      {logModal && (
        <View className="prf-modal-overlay" onClick={() => setLogModal(null)}>
          <View className="prf-modal" onClick={e => e.stopPropagation()}>
            <Text className="prf-modal-title">
              录入今日指标 — {DISEASE_MAP[logModal.condition]?.name}
            </Text>
            {(DISEASE_METRIC_FIELDS[logModal.condition] ?? []).map(field => (
              <View key={field.key} className="prf-modal-field">
                <Text className="prf-modal-label">{field.label}（{field.unit}）</Text>
                <Input
                  className="prf-modal-input"
                  type="digit"
                  value={logModal.values[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onInput={e => setLogModal(prev => prev ? {
                    ...prev,
                    values: { ...prev.values, [field.key]: e.detail.value },
                  } : null)}
                />
              </View>
            ))}
            <View className="prf-modal-btns">
              <View className="prf-modal-cancel" onClick={() => setLogModal(null)}>
                <Text className="prf-modal-btn-text">取消</Text>
              </View>
              <View className="prf-modal-save" onClick={saveMetrics}>
                <Text className="prf-modal-btn-text prf-modal-btn-text--save">保存</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  )
}
