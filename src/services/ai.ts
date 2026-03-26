/**
 * AI 服务层 —— 所有 Claude API 调用统一走云函数，
 * 前端只调用此文件中的函数，不直接接触 API Key。
 */
import Taro from '@tarojs/taro'

// 云函数名称常量
const CF_CHAT      = 'chat'      // 建档对话 + 助手问答
const CF_RECOGNIZE = 'recognize' // 食物图片识别
const CF_NUTRITION = 'nutrition' // 营养数据查询

/** 发送对话消息（建档 / 助手） */
export async function sendMessage(params: {
  message: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt?: string
}): Promise<string> {
  const res = await Taro.cloud.callFunction({
    name: CF_CHAT,
    data: params,
  }) as any
  if (res.result?.error) throw new Error(res.result.error)
  return res.result.text as string
}

/** 食物图片识别 */
export async function recognizeFood(imageBase64: string): Promise<FoodRecognitionResult> {
  const res = await Taro.cloud.callFunction({
    name: CF_RECOGNIZE,
    data: { imageBase64 },
  }) as any
  if (res.result?.error) throw new Error(res.result.error)
  return res.result as FoodRecognitionResult
}

/** 根据用户档案生成个性化建议 */
export async function getPersonalizedAdvice(params: {
  profileSummary: string
  todayIntake: { calories: number; protein: number; carbs: number; fat: number }
  targetCalories: number
}): Promise<string> {
  const res = await Taro.cloud.callFunction({
    name: CF_CHAT,
    data: {
      message: '请根据今日饮食情况生成简短的个性化建议（不超过60字）',
      systemPrompt: `用户健康档案：${params.profileSummary}。今日摄入：热量${params.todayIntake.calories}kcal/目标${params.targetCalories}kcal，蛋白质${params.todayIntake.protein}g，碳水${params.todayIntake.carbs}g，脂肪${params.todayIntake.fat}g。`,
      history: [],
    },
  }) as any
  return res.result?.text ?? ''
}

export interface FoodRecognitionResult {
  name: string
  servingDesc: string   // e.g. "1碗（约350g）"
  calories: number
  protein: number
  carbs: number
  fat: number
  allergens: string[]  // 识别到的过敏源
  trafficLight: TrafficLightItem[]
  personalAdvice: string
}

export interface TrafficLightItem {
  level: 'green' | 'amber' | 'red'
  text: string
}
