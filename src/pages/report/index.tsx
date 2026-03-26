import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import './index.scss'

interface DayData {
  day: string
  kcal: number
  hit: boolean
}

const WEEK_DATA: DayData[] = [
  { day: '一', kcal: 1510, hit: true },
  { day: '二', kcal: 1545, hit: true },
  { day: '三', kcal: 1820, hit: false },
  { day: '四', kcal: 1490, hit: true },
  { day: '五', kcal: 1530, hit: true },
  { day: '六', kcal: 0,    hit: false },
  { day: '日', kcal: 0,    hit: false },
]

const SCORE = 82
const TARGET_KCAL = 1600
const MAX_BAR_KCAL = 2100

interface NutrientData {
  name: string
  pct: number
  color: string
  over?: boolean
  low?: boolean
}

const NUTRIENTS: NutrientData[] = [
  { name: '蛋白质',  pct: 92,  color: '#10B981' },
  { name: '碳水',   pct: 108, color: '#F59E0B', over: true },
  { name: '脂肪',   pct: 78,  color: '#3B82F6' },
  { name: '膳食纤维', pct: 55, color: '#8B5CF6', low: true },
  { name: '钠',     pct: 115, color: '#EF4444', over: true },
]

// Today is Saturday (index 5, day '六') in the mock week
const TODAY_IDX = 5

export default function Report() {
  const [weekOffset] = useState(0)
  const { todayLog, loadFromStorage } = useUserStore()

  useEffect(() => { loadFromStorage() }, [])

  // Show empty state if no meal records at all
  const hasData = todayLog && todayLog.meals.length > 0

  const hitDays = WEEK_DATA.filter(d => d.hit).length
  const loggedDays = WEEK_DATA.filter(d => d.kcal > 0).length

  // Status per day: 'hit' | 'over' | 'empty' | 'today'
  function dayStatus(d: DayData, idx: number): 'hit' | 'over' | 'empty' | 'today-hit' | 'today-miss' {
    const isToday = idx === TODAY_IDX
    if (d.kcal === 0) return isToday ? 'today-miss' : 'empty'
    if (d.hit) return isToday ? 'today-hit' : 'hit'
    return 'over'
  }

  if (!hasData) {
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

  return (
    <ScrollView className="rpt-scroll" scrollY>
      {/* Header */}
      <View className="rpt-header">
        <View className="rpt-header-top">
          <View className="rpt-nav-btn" onClick={() => Taro.showToast({ title: '上周', icon: 'none' })}>
            <Text className="rpt-nav-arrow">‹</Text>
          </View>
          <View className="rpt-header-center">
            <Text className="rpt-title">📊 本周报告</Text>
            <Text className="rpt-week-label">3月17日 — 3月23日</Text>
          </View>
          <View className="rpt-nav-btn" onClick={() => Taro.showToast({ title: '下周', icon: 'none' })}>
            <Text className="rpt-nav-arrow">›</Text>
          </View>
        </View>

        {/* Day dots row */}
        <View className="rpt-days-row">
          {WEEK_DATA.map((d, i) => {
            const st = dayStatus(d, i)
            return (
              <View key={d.day} className="rpt-day-col">
                <Text className="rpt-day-label">{d.day}</Text>
                <View className={`rpt-day-dot rpt-day-dot--${st}`}>
                  {st === 'hit' || st === 'today-hit'
                    ? <Text className="rpt-day-icon">✓</Text>
                    : st === 'over'
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
      <View className="rpt-score-card">
        <View className="rpt-score-circle">
          <Text className="rpt-score-num">{SCORE}</Text>
          <Text className="rpt-score-denom">/100</Text>
        </View>
        <View className="rpt-score-info">
          <Text className="rpt-score-title">本周表现良好 🎉</Text>
          <Text className="rpt-score-line">✅ {hitDays}/7 天达到热量目标</Text>
          <Text className="rpt-score-line">📅 {loggedDays}/7 天有饮食记录</Text>
          <Text className="rpt-score-line">⚠️ 周三热量超标 14%</Text>
          <Text className="rpt-score-line">📉 膳食纤维持续不足</Text>
        </View>
      </View>

      {/* Calorie bar chart */}
      <View className="rpt-section-card">
        <Text className="rpt-section-title">每日热量（kcal）</Text>
        {/* Target line hint */}
        <View className="rpt-target-hint">
          <View className="rpt-target-line" />
          <Text className="rpt-target-label">目标 {TARGET_KCAL} kcal</Text>
          <View className="rpt-target-line" />
        </View>
        {/* Bars row — flex end so bars grow from bottom */}
        <View className="rpt-bars-row">
          {WEEK_DATA.map((d, i) => {
            const BAR_MAX_H = 200 // rpx (CSS height of bar area)
            const barH = d.kcal > 0 ? Math.round(Math.min((d.kcal / MAX_BAR_KCAL), 1) * BAR_MAX_H) : 4
            const isOver = d.kcal > TARGET_KCAL
            const isToday = i === TODAY_IDX
            const barColor = d.kcal === 0
              ? '#E5E7EB'
              : isOver
              ? '#EF4444'
              : isToday
              ? '#059669'
              : '#10B981'
            return (
              <View key={d.day} className="rpt-bar-col">
                {d.kcal > 0 && (
                  <Text className="rpt-bar-kcal">{d.kcal}</Text>
                )}
                <View className="rpt-bar-spacer" />
                <View
                  className="rpt-bar-fill"
                  style={{ height: `${barH}rpx`, background: barColor }}
                />
                <Text className={`rpt-bar-label ${isToday ? 'rpt-bar-label--today' : ''}`}>
                  {isToday ? '今' : d.day}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Nutrient bars */}
      <View className="rpt-section-card">
        <Text className="rpt-section-title">营养素达成率</Text>
        <View className="rpt-nutrients">
          {NUTRIENTS.map(n => {
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
                    <Text className="rpt-nutrient-pct" style={{ color: pctColor }}>
                      {n.pct}%
                    </Text>
                  </View>
                </View>
                <View className="rpt-nutrient-track">
                  <View
                    className="rpt-nutrient-fill"
                    style={{ width: `${barW}%`, background: barColor }}
                  />
                  {n.pct > 100 && (
                    <View className="rpt-nutrient-over-mark" />
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* AI weekly comment */}
      <View className="rpt-ai-card">
        <Text className="rpt-ai-header">🤖 AI 周报点评</Text>
        <Text className="rpt-ai-body">
          本周整体表现不错，热量控制稳定，5/7 天达成目标！需要重点关注：
          {'\n\n'}
          1️⃣ 膳食纤维长期不足（55%），建议每天增加一份深色蔬菜和一份粗粮。
          {'\n\n'}
          2️⃣ 钠摄入偏高（115%），减少加工食品和外卖频率。
          {'\n\n'}
          3️⃣ 碳水化合物波动大，周三超标明显，建议外出用餐时主动减少主食份量。
          {'\n\n'}
          💪 继续保持！下周可以尝试每天多走 2000 步帮助热量平衡。
        </Text>
      </View>

      <View className="rpt-bottom-space" />
    </ScrollView>
  )
}
