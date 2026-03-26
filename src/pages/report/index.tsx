import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import './index.scss'

interface DayData {
  day: string
  date: string   // YYYY-MM-DD
  kcal: number
  protein: number
  carbs: number
  fat: number
  hit: boolean   // within target range
  over: boolean  // > target * 1.1
}

// ── Week helpers ──────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getWeekRange(offset: number): { start: Date; label: string } {
  const now = new Date()
  const dow = now.getDay() // 0=Sun
  const toMon = dow === 0 ? -6 : 1 - dow
  const mon = new Date(now)
  mon.setDate(now.getDate() + toMon + offset * 7)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`
  return { start: mon, label: `${fmt(mon)} — ${fmt(sun)}` }
}

function loadWeekData(start: Date, target: number): DayData[] {
  const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dateStr = toDateStr(d)
    try {
      const raw = Taro.getStorageSync('todayLog_' + dateStr)
      const log = raw ? JSON.parse(raw) : null
      const kcal = log?.totalCalories ?? 0
      const protein = (log?.meals ?? []).reduce((s: number, m: any) => s + (m.protein || 0), 0)
      const carbs   = (log?.meals ?? []).reduce((s: number, m: any) => s + (m.carbs   || 0), 0)
      const fat     = (log?.meals ?? []).reduce((s: number, m: any) => s + (m.fat     || 0), 0)
      return {
        day: DAY_LABELS[i],
        date: dateStr,
        kcal,
        protein,
        carbs,
        fat,
        hit: kcal > 0 && kcal <= target * 1.1,
        over: kcal > target * 1.1,
      }
    } catch {
      return { day: DAY_LABELS[i], date: dateStr, kcal: 0, protein: 0, carbs: 0, fat: 0, hit: false, over: false }
    }
  })
}

// ── Score calculation ─────────────────────────────────────────────────────

function calcScore(data: DayData[], target: number): number {
  const logged = data.filter(d => d.kcal > 0).length
  const hit    = data.filter(d => d.hit).length
  const over   = data.filter(d => d.over).length
  if (logged === 0) return 0
  // Base: 50 + (hit/logged)*40 - overPenalty
  const base = 50 + Math.round((hit / Math.max(logged, 1)) * 40) - over * 5
  return Math.max(40, Math.min(100, base))
}

// ── Nutrient targets ──────────────────────────────────────────────────────

interface NutrientData {
  name: string
  pct: number
  color: string
  over: boolean
  low: boolean
}

function calcNutrients(data: DayData[], dailyCals: number, weight: number): NutrientData[] {
  const logged = data.filter(d => d.kcal > 0)
  if (logged.length === 0) return []

  const days = logged.length
  const avgProtein = logged.reduce((s, d) => s + d.protein, 0) / days
  const avgCarbs   = logged.reduce((s, d) => s + d.carbs,   0) / days
  const avgFat     = logged.reduce((s, d) => s + d.fat,     0) / days

  // Targets (per day)
  const tProtein = weight > 0 ? weight * 1.4 : dailyCals * 0.25 / 4
  const tCarbs   = dailyCals * 0.45 / 4
  const tFat     = dailyCals * 0.30 / 9

  const pct = (actual: number, target: number) =>
    target > 0 ? Math.round((actual / target) * 100) : 0

  return [
    { name: '蛋白质', pct: pct(avgProtein, tProtein), color: '#10B981', over: pct(avgProtein, tProtein) > 115, low: pct(avgProtein, tProtein) < 80 },
    { name: '碳水',   pct: pct(avgCarbs,   tCarbs),   color: '#F59E0B', over: pct(avgCarbs,   tCarbs)   > 110, low: pct(avgCarbs,   tCarbs)   < 70 },
    { name: '脂肪',   pct: pct(avgFat,     tFat),     color: '#3B82F6', over: pct(avgFat,     tFat)     > 115, low: pct(avgFat,     tFat)     < 70 },
  ]
}

// ── AI comment (rule-based) ───────────────────────────────────────────────

function genComment(data: DayData[], score: number, nutrients: NutrientData[], target: number): string {
  const logged  = data.filter(d => d.kcal > 0).length
  const hit     = data.filter(d => d.hit).length
  const over    = data.filter(d => d.over)
  const missing = 7 - logged

  if (logged === 0) return '本周还没有饮食记录。每天拍一张食物照片，小知就能帮你分析营养状况！'

  const lines: string[] = []

  // Opening
  if (score >= 85) lines.push(`本周表现出色，${hit}/7 天达到热量目标 🎉 继续保持！`)
  else if (score >= 65) lines.push(`本周整体不错，${hit}/7 天达成热量目标，还有提升空间。`)
  else lines.push(`本周饮食波动较大，${hit}/7 天达成目标，我们一起调整一下。`)

  // Missing days
  if (missing > 0) lines.push(`\n📅 有 ${missing} 天没有记录饮食，养成每日拍照的习惯能帮助你更好地掌控营养摄入。`)

  // Over target
  if (over.length > 0) {
    const overDays = over.map(d => `周${d.day}`).join('、')
    lines.push(`\n⚠️ ${overDays} 热量超标，超出目标 ${target} kcal 较多，注意控制外出用餐的主食和油脂量。`)
  }

  // Nutrient tips
  const lowNutrients  = nutrients.filter(n => n.low)
  const overNutrients = nutrients.filter(n => n.over)
  if (lowNutrients.length > 0)  lines.push(`\n📉 ${lowNutrients.map(n => n.name).join('、')}摄入不足，可增加${lowNutrients[0].name === '蛋白质' ? '鸡胸肉、鸡蛋、豆类' : '全谷物和深色蔬菜'}。`)
  if (overNutrients.length > 0) lines.push(`\n📈 ${overNutrients.map(n => n.name).join('、')}摄入偏多，减少精制主食和高脂食品。`)

  // Encouragement
  if (score >= 80) lines.push('\n💪 下周继续，逐步让健康饮食成为习惯！')
  else lines.push('\n🌱 每一天的小改变都在积累，不要气馁，下周一起加油！')

  return lines.join('')
}

// ── Main component ────────────────────────────────────────────────────────

export default function Report() {
  const { profile, todayLog, loadFromStorage } = useUserStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekData,   setWeekData]   = useState<DayData[]>([])
  const [weekLabel,  setWeekLabel]  = useState('')

  const target      = profile?.dailyCalories ?? 1600
  const weight      = profile?.weight        ?? 60
  const today       = toDateStr(new Date())
  const MAX_BAR_H   = 200  // rpx

  useEffect(() => { loadFromStorage() }, [])

  useEffect(() => {
    const { start, label } = getWeekRange(weekOffset)
    setWeekLabel(label)
    setWeekData(loadWeekData(start, target))
  }, [weekOffset, target, todayLog])  // re-calc when today's log updates

  const loggedDays  = weekData.filter(d => d.kcal > 0).length
  const hitDays     = weekData.filter(d => d.hit).length
  const overDays    = weekData.filter(d => d.over)
  const score       = calcScore(weekData, target)
  const nutrients   = calcNutrients(weekData, target, weight)
  const comment     = genComment(weekData, score, nutrients, target)
  const maxKcal     = Math.max(...weekData.map(d => d.kcal), target * 1.2, 100)

  // Empty state: current week, no data at all
  if (weekOffset === 0 && loggedDays === 0) {
    return (
      <ScrollView className="rpt-scroll" scrollY>
        <View className="rpt-empty">
          <Text className="rpt-empty-emoji">📊</Text>
          <Text className="rpt-empty-title">还没有饮食数据</Text>
          <Text className="rpt-empty-desc">记录 3 天以上的饮食后，小知将为你生成专属周报</Text>
          <View className="rpt-empty-btn" onClick={() => Taro.switchTab({ url: '/pages/camera/index' })}>
            <Text className="rpt-empty-btn-text">去记录第一餐</Text>
          </View>
        </View>
      </ScrollView>
    )
  }

  function dayStatus(d: DayData): 'hit' | 'over' | 'empty' | 'today-hit' | 'today-miss' | 'today-over' {
    const isToday = d.date === today
    if (d.kcal === 0) return isToday ? 'today-miss' : 'empty'
    if (d.over)  return isToday ? 'today-over' : 'over'
    if (d.hit)   return isToday ? 'today-hit'  : 'hit'
    return 'hit'
  }

  function scoreLabel(): string {
    if (score >= 90) return '本周表现卓越 🏆'
    if (score >= 80) return '本周表现良好 🎉'
    if (score >= 65) return '继续努力 💪'
    return '需要改善 🌱'
  }

  return (
    <ScrollView className="rpt-scroll" scrollY>
      {/* Header */}
      <View className="rpt-header">
        <View className="rpt-header-top">
          <View className="rpt-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>
            <Text className="rpt-nav-arrow">‹</Text>
          </View>
          <View className="rpt-header-center">
            <Text className="rpt-title">📊 {weekOffset === 0 ? '本周报告' : weekOffset === -1 ? '上周报告' : `${Math.abs(weekOffset)}周前报告`}</Text>
            <Text className="rpt-week-label">{weekLabel}</Text>
          </View>
          <View
            className={`rpt-nav-btn ${weekOffset >= 0 ? 'rpt-nav-btn--disabled' : ''}`}
            onClick={() => { if (weekOffset < 0) setWeekOffset(o => o + 1) }}
          >
            <Text className="rpt-nav-arrow">›</Text>
          </View>
        </View>

        {/* Day dots */}
        <View className="rpt-days-row">
          {weekData.map((d) => {
            const st = dayStatus(d)
            return (
              <View key={d.day} className="rpt-day-col">
                <Text className="rpt-day-label">{d.day}</Text>
                <View className={`rpt-day-dot rpt-day-dot--${st}`}>
                  {(st === 'hit' || st === 'today-hit')
                    ? <Text className="rpt-day-icon">✓</Text>
                    : (st === 'over' || st === 'today-over')
                    ? <Text className="rpt-day-icon rpt-day-icon--warn">!</Text>
                    : <Text className="rpt-day-icon rpt-day-icon--empty">–</Text>
                  }
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* Score card */}
      {loggedDays > 0 && (
        <View className="rpt-score-card">
          <View className="rpt-score-circle">
            <Text className="rpt-score-num">{score}</Text>
            <Text className="rpt-score-denom">/100</Text>
          </View>
          <View className="rpt-score-info">
            <Text className="rpt-score-title">{scoreLabel()}</Text>
            <Text className="rpt-score-line">✅ {hitDays}/7 天达到热量目标</Text>
            <Text className="rpt-score-line">📅 {loggedDays}/7 天有饮食记录</Text>
            {overDays.length > 0 && (
              <Text className="rpt-score-line">⚠️ {overDays.map(d => `周${d.day}`).join('、')}热量超标</Text>
            )}
            {loggedDays < 3 && (
              <Text className="rpt-score-line">💡 记录满 3 天分析更准确</Text>
            )}
          </View>
        </View>
      )}

      {/* Empty week (past weeks) */}
      {loggedDays === 0 && weekOffset < 0 && (
        <View className="rpt-score-card rpt-score-card--empty">
          <Text className="rpt-score-empty-text">这周没有饮食记录</Text>
        </View>
      )}

      {/* Calorie bar chart */}
      <View className="rpt-section-card">
        <Text className="rpt-section-title">每日热量（kcal）</Text>
        <View className="rpt-target-hint">
          <View className="rpt-target-line" />
          <Text className="rpt-target-label">目标 {target} kcal</Text>
          <View className="rpt-target-line" />
        </View>
        <View className="rpt-bars-row">
          {weekData.map((d) => {
            const barH = d.kcal > 0 ? Math.round(Math.min(d.kcal / maxKcal, 1) * MAX_BAR_H) : 4
            const isToday = d.date === today
            const barColor = d.kcal === 0 ? '#E5E7EB' : d.over ? '#EF4444' : isToday ? '#059669' : '#10B981'
            return (
              <View key={d.day} className="rpt-bar-col">
                {d.kcal > 0 && <Text className="rpt-bar-kcal">{d.kcal}</Text>}
                <View className="rpt-bar-spacer" />
                <View className="rpt-bar-fill" style={{ height: `${barH}rpx`, background: barColor }} />
                <Text className={`rpt-bar-label ${isToday ? 'rpt-bar-label--today' : ''}`}>
                  {isToday ? '今' : d.day}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Nutrient bars (only when there's enough data) */}
      {nutrients.length > 0 && (
        <View className="rpt-section-card">
          <Text className="rpt-section-title">营养素达成率（日均）</Text>
          <View className="rpt-nutrients">
            {nutrients.map(n => {
              const barW = Math.min(n.pct, 100)
              const barColor = n.over ? '#F59E0B' : n.low ? '#EF4444' : n.color
              const pctColor = n.over ? '#D97706' : n.low ? '#DC2626' : n.color
              return (
                <View key={n.name} className="rpt-nutrient-row">
                  <View className="rpt-nutrient-header">
                    <Text className="rpt-nutrient-name">{n.name}</Text>
                    <View className="rpt-nutrient-tag-wrap">
                      {n.over && <Text className="rpt-tag rpt-tag--over">超标</Text>}
                      {n.low  && <Text className="rpt-tag rpt-tag--low">不足</Text>}
                      <Text className="rpt-nutrient-pct" style={{ color: pctColor }}>{n.pct}%</Text>
                    </View>
                  </View>
                  <View className="rpt-nutrient-track">
                    <View className="rpt-nutrient-fill" style={{ width: `${barW}%`, background: barColor }} />
                    {n.pct > 100 && <View className="rpt-nutrient-over-mark" />}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* AI comment */}
      <View className="rpt-ai-card">
        <Text className="rpt-ai-header">🤖 AI 周报点评</Text>
        <Text className="rpt-ai-body">{comment}</Text>
      </View>

      <View className="rpt-bottom-space" />
    </ScrollView>
  )
}
