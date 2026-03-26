import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import './index.scss'

const MEAL_COLORS: Record<string, string> = {
  breakfast: '#FEF9C3',
  lunch:     '#DCFCE7',
  dinner:    '#FEE2E2',
  snack:     '#F3F4F6',
}
const MEAL_EMOJIS: Record<string, string> = {
  breakfast: '🥣',
  lunch:     '🥗',
  dinner:    '🍜',
  snack:     '🍎',
}
const MEAL_NAMES: Record<string, string> = {
  breakfast: '早餐',
  lunch:     '午餐',
  dinner:    '晚餐',
  snack:     '加餐',
}

const PLAN_MEALS: Record<string, { breakfast: string; lunch: string; dinner: string }> = {
  '减脂增肌方案': {
    breakfast: '燕麦粥 + 水煮蛋 2个 + 低脂牛奶',
    lunch:     '鸡胸肉 200g + 西兰花 + 糙米饭 100g',
    dinner:    '清蒸鱼 150g + 绿叶蔬菜 + 少量主食',
  },
  '地中海饮食': {
    breakfast: '全麦面包 + 牛油果 + 番茄片',
    lunch:     '金枪鱼沙拉 + 橄榄油 + 全麦意面',
    dinner:    '烤三文鱼 + 彩椒炒蔬菜 + 藜麦',
  },
  '低GI饮食': {
    breakfast: '燕麦粥 + 蓝莓 + 原味坚果一把',
    lunch:     '糙米饭 + 豆腐炒菜 + 绿叶菜',
    dinner:    '蒸红薯 + 水煮蛋 + 蔬菜汤',
  },
}

const PLANS = [
  { ico:'💪', title:'减脂增肌方案', desc:'高蛋白低碳水·4周', tag:'推荐', tc:'#10B981', tb:'#ECFDF5',
    detail:'每日蛋白质 ≥ 120g，碳水 < 150g，优先鸡胸肉、鸡蛋、绿叶菜。适合想在 4 周内明显减脂的用户。' },
  { ico:'🫒', title:'地中海饮食',   desc:'均衡营养·长期健康', tag:'热门', tc:'#3B82F6', tb:'#EFF6FF',
    detail:'以橄榄油、鱼类、全谷物、蔬果为主。长期坚持可降低心血管疾病风险，适合日常健康维护。' },
  { ico:'🌾', title:'低GI饮食',     desc:'稳定血糖·持久饱腹', tag:'新上线', tc:'#8B5CF6', tb:'#FAF5FF',
    detail:'用糙米、燕麦替换白米，减少精制糖，搭配足量蛋白质。血糖平稳，饱腹感持久，适合血糖偏高人群。' },
]

export default function Home() {
  const { profile, todayLog, loadFromStorage } = useUserStore()
  const [hour] = useState(new Date().getHours())
  const [activePlan, setActivePlan] = useState<string | null>(null)

  useEffect(() => {
    loadFromStorage()
    const saved = Taro.getStorageSync('activePlan')
    if (saved) setActivePlan(saved)
  }, [])

  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
  const total    = todayLog?.totalCalories ?? 0
  const target   = profile?.dailyCalories ?? 1600
  const progress = Math.min(total / target, 1)
  const pct = Math.round(progress * 100)
  const hasMeals = !!(todayLog && todayLog.meals.length > 0)
  const isHealthy = profile?.isHealthy !== false

  function goCamera() {
    Taro.switchTab({ url: '/pages/camera/index' })
  }

  function selectPlan(plan: typeof PLANS[0]) {
    Taro.showModal({
      title: plan.ico + ' ' + plan.title,
      content: plan.detail + '\n\n确认开始执行此方案？',
      confirmText: '开始执行',
      cancelText: '再看看',
      success: (res) => {
        if (res.confirm) {
          setActivePlan(plan.title)
          Taro.setStorageSync('activePlan', plan.title)
          Taro.showToast({ title: '方案已启动 🎉', icon: 'success' })
        }
      }
    })
  }

  // Dynamic tip based on actual data
  function getTipText(): { ico: string; text: string; type: string } {
    if (!hasMeals) {
      return { ico: '🌱', text: '记录今天第一餐，小知帮你分析营养搭配', type: 'diet' }
    }
    const protein = todayLog!.meals.reduce((s,m)=>s+m.protein, 0)
    const proteinTarget = 80
    if (total > target * 0.9) {
      return { ico: '⚠️', text: `今日热量已达 ${pct}%，晚餐注意控制份量`, type: 'danger' }
    }
    if (protein < proteinTarget * 0.5) {
      return { ico: '💡', text: `蛋白质只摄入了 ${protein}g，可以加一份鸡胸肉或鸡蛋补充`, type: 'diet' }
    }
    if (activePlan) {
      return { ico: '📋', text: `正在执行「${activePlan}」，今日进度 ${pct}%，继续加油！`, type: 'diet' }
    }
    return { ico: '✅', text: `今日饮食记录良好，热量摄入 ${pct}%，继续保持！`, type: 'diet' }
  }

  const tip = getTipText()

  return (
    <ScrollView className="home-scroll" scrollY>
      {/* Greeting */}
      <View className="greet">
        <View>
          <Text className="greet-title">{greeting}，{profile?.name ?? '朋友'} 👋</Text>
          <Text className="greet-sub">
            {total >= target ? '今日热量目标已达成 🎉' : `今天还差 ${target - total} kcal 达到目标`}
          </Text>
        </View>
        <View className="avatar">😊</View>
      </View>

      {/* Calorie ring */}
      <View className="ring-card">
        <View className="ring-wrap">
          <View
            className="ring-css"
            style={{
              background: `conic-gradient(#10B981 ${pct}%, #F3F4F6 0%)`,
            }}
          >
            <View className="ring-inner">
              <Text className="ring-num">{total}</Text>
              <Text className="ring-label">已摄入</Text>
              <Text className="ring-total">/ {target}</Text>
            </View>
          </View>
        </View>
        <View className="macro-col">
          <Text className="macro-title">今日营养素</Text>
          {[
            { label: '蛋白质', val: todayLog?.meals.reduce((s,m)=>s+m.protein,0)??0, max: 80, color: '#10B981' },
            { label: '碳水',   val: todayLog?.meals.reduce((s,m)=>s+m.carbs,0)??0,   max: 160, color: '#F59E0B' },
            { label: '脂肪',   val: todayLog?.meals.reduce((s,m)=>s+m.fat,0)??0,     max: 50, color: '#3B82F6' },
          ].map(m => (
            <View key={m.label} className="mbar">
              <View className="mbar-lbl">
                <Text>{m.label}</Text>
                <Text>{m.val}/{m.max}g</Text>
              </View>
              <View className="mbar-track">
                <View className="mbar-fill" style={{ width: `${Math.min(m.val/m.max*100,100)}%`, background: m.color }} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Tips — dynamic based on actual data */}
      <View className={`tip-row ${tip.type}`}>
        <Text className="tip-ico">{tip.ico}</Text>
        <Text className="tip-txt">{tip.text}</Text>
      </View>

      {/* Meal plans */}
      {isHealthy && (
        <>
          <View className="sec-title">
            <Text>📋 饮食方案</Text>
            <Text className="sec-more" onClick={() => Taro.switchTab({ url: '/pages/assistant/index' })}>
              更多方案 ›
            </Text>
          </View>
          <ScrollView scrollX className="plan-scroll">
            {PLANS.map(p => {
              const isActive = activePlan === p.title
              return (
                <View
                  key={p.title}
                  className={`plan-card ${isActive ? 'plan-card--active' : ''}`}
                  onClick={() => selectPlan(p)}
                >
                  <Text className="plan-ico">{p.ico}</Text>
                  <Text className="plan-title">{p.title}</Text>
                  <Text className="plan-desc">{p.desc}</Text>
                  <Text className="plan-tag" style={{ color: isActive ? '#fff' : p.tc, background: isActive ? '#10B981' : p.tb }}>
                    {isActive ? '进行中 ✓' : p.tag}
                  </Text>
                </View>
              )
            })}
          </ScrollView>

          {/* Today's recommended meals for active plan */}
          {activePlan && PLAN_MEALS[activePlan] && (
            <View className="plan-today-card">
              <Text className="plan-today-title">🍱 今日推荐餐单</Text>
              <Text className="plan-today-plan-name">{activePlan}</Text>
              {([
                { emoji: '🥣', label: '早餐', meal: PLAN_MEALS[activePlan].breakfast },
                { emoji: '🥗', label: '午餐', meal: PLAN_MEALS[activePlan].lunch },
                { emoji: '🍜', label: '晚餐', meal: PLAN_MEALS[activePlan].dinner },
              ]).map(r => (
                <View key={r.label} className="plan-today-row">
                  <Text className="plan-today-emoji">{r.emoji}</Text>
                  <View className="plan-today-info">
                    <Text className="plan-today-lbl">{r.label}</Text>
                    <Text className="plan-today-meal">{r.meal}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Meal records */}
      <View className="sec-title">
        <Text>今日记录</Text>
        {hasMeals && <Text className="sec-more" onClick={goCamera}>+ 添加</Text>}
      </View>

      {/* Empty state when no meals recorded today */}
      {(!todayLog || todayLog.meals.length === 0) ? (
        <View className="empty-state">
          <Text className="empty-emoji">🌱</Text>
          <Text className="empty-text">今天还没有饮食记录</Text>
          <View className="empty-cta" onClick={goCamera}>
            <Text className="empty-cta-text">+ 拍照记录第一餐</Text>
          </View>
        </View>
      ) : (
        <>
          {(['breakfast','lunch','dinner'] as const).map(type => {
            const record = todayLog?.meals.find(m => m.type === type)
            return (
              <View key={type} className="meal-slot" onClick={goCamera}>
                <View className="meal-ico" style={{ background: MEAL_COLORS[type] }}>
                  <Text>{MEAL_EMOJIS[type]}</Text>
                </View>
                <View className="meal-info">
                  <Text className="meal-nm">{MEAL_NAMES[type]}</Text>
                  <Text className="meal-ds">{record ? record.name : '点击添加'}</Text>
                </View>
                {record && <Text className="meal-kc">{record.calories} kcal</Text>}
                <Text className="meal-arr">›</Text>
              </View>
            )
          })}
          {/* Add snack */}
          <View className="meal-slot meal-add" onClick={goCamera}>
            <View className="meal-ico meal-ico-add"><Text>＋</Text></View>
            <View className="meal-info">
              <Text className="meal-nm meal-nm-muted">记录加餐</Text>
              <Text className="meal-ds">拍照快速识别</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  )
}
