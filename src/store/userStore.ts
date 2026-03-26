import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { callCloud } from '../services/cloud'

export interface UserProfile {
  name?: string
  age?: string
  gender?: 'male' | 'female'
  height?: number   // cm
  weight?: number   // kg
  goal?: 'lose' | 'gain' | 'maintain' | 'health'
  conditions: string[]   // e.g. ['hyperglycemia', 'hypertension']
  allergies: string[]    // e.g. ['seafood', 'peanut']
  dailyCalories?: number
  isHealthy?: boolean    // true = no conditions
}

export interface DailyLog {
  date: string
  meals: MealRecord[]
  totalCalories: number
}

export interface MealRecord {
  id: string
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  imageUrl?: string
  time: string
}

interface UserState {
  profile: UserProfile | null
  todayLog: DailyLog | null
  openid: string
  nickname: string
  avatarUrl: string
  isLoggedIn: boolean
  setProfile: (p: Partial<UserProfile>) => void
  addMealRecord: (m: MealRecord) => void
  loadFromStorage: () => void
  setLogin: (openid: string, nickname: string, avatarUrl: string) => void
  syncProfileToCloud: (profile: UserProfile) => Promise<void>
  loadProfileFromCloud: () => Promise<void>
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  todayLog: null,
  openid: '',
  nickname: '',
  avatarUrl: '',
  isLoggedIn: false,

  setLogin: (openid, nickname, avatarUrl) => {
    set({ openid, nickname, avatarUrl, isLoggedIn: true })
    Taro.setStorageSync('openid', openid)
    Taro.setStorageSync('nickname', nickname)
    Taro.setStorageSync('avatarUrl', avatarUrl)
  },

  setProfile: (p) => {
    const current = get().profile || { conditions: [], allergies: [] }
    const updated = { ...current, ...p }
    // 根据是否有疾病自动设置 isHealthy
    updated.isHealthy = updated.conditions.length === 0
    // 根据目标和性别推算每日热量目标
    if (!updated.dailyCalories && updated.weight && updated.height && updated.age) {
      const bmr = updated.gender === 'female'
        ? 10 * updated.weight + 6.25 * updated.height - 5 * parseInt(updated.age) - 161
        : 10 * updated.weight + 6.25 * updated.height - 5 * parseInt(updated.age) + 5
      updated.dailyCalories = updated.goal === 'lose'
        ? Math.round(bmr * 1.2 - 300)
        : Math.round(bmr * 1.375)
    }
    set({ profile: updated })
    Taro.setStorageSync('userProfile', JSON.stringify(updated))
  },

  addMealRecord: (meal) => {
    const today = new Date().toISOString().split('T')[0]
    const log = get().todayLog || { date: today, meals: [], totalCalories: 0 }
    const updated = {
      ...log,
      meals: [...log.meals, meal],
      totalCalories: log.totalCalories + meal.calories,
    }
    set({ todayLog: updated })
    Taro.setStorageSync('todayLog_' + today, JSON.stringify(updated))
  },

  loadFromStorage: () => {
    try {
      const raw = Taro.getStorageSync('userProfile')
      if (raw) set({ profile: JSON.parse(raw) })
      const today = new Date().toISOString().split('T')[0]
      const logRaw = Taro.getStorageSync('todayLog_' + today)
      if (logRaw) set({ todayLog: JSON.parse(logRaw) })
      // Restore login state
      const openid = Taro.getStorageSync('openid')
      const nickname = Taro.getStorageSync('nickname') || ''
      const avatarUrl = Taro.getStorageSync('avatarUrl') || ''
      if (openid) {
        set({ openid, nickname, avatarUrl, isLoggedIn: true })
      }
    } catch (e) {
      console.error('loadFromStorage error', e)
    }
  },

  syncProfileToCloud: async (profile) => {
    try {
      await callCloud('profile', { action: 'save', profile })
    } catch (e) {
      console.error('syncProfileToCloud error', e)
    }
  },

  loadProfileFromCloud: async () => {
    try {
      const res = await callCloud('profile', { action: 'load' })
      if (res?.profile) {
        set({ profile: res.profile })
        Taro.setStorageSync('userProfile', JSON.stringify(res.profile))
      }
    } catch (e) {
      console.error('loadProfileFromCloud error', e)
    }
  },
}))
