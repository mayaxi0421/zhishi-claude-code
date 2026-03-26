import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import { callCloud } from '../../services/cloud'
import './index.scss'

export default function Login() {
  const { setLogin } = useUserStore()
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (loading) return
    setLoading(true)
    try {
      const loginRes = await callCloud('login', {})
      if (!loginRes?.openid) {
        Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
        setLoading(false)
        return
      }

      const { openid, isNew } = loginRes
      setLogin(openid, '', '')

      if (isNew) {
        Taro.reLaunch({ url: '/pages/onboard/index' })
      } else {
        const profileRaw = Taro.getStorageSync('userProfile')
        if (profileRaw) {
          Taro.switchTab({ url: '/pages/home/index' })
        } else {
          Taro.reLaunch({ url: '/pages/onboard/index' })
        }
      }
    } catch (err) {
      console.error('Login error', err)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
      setLoading(false)
    }
  }

  function goPrivacy() {
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  return (
    <View className="login-page">
      {/* Background gradient */}
      <View className="login-bg" />

      {/* Hero section */}
      <View className="login-hero">
        <View className="login-logo-wrap">
          <Text className="login-logo-emoji">🌱</Text>
        </View>
        <Text className="login-app-name">知食</Text>
        <Text className="login-tagline">拍照识别热量，AI 专属饮食建议</Text>
      </View>

      {/* Bottom section */}
      <View className="login-bottom">
        <Button
          className="login-btn"
          disabled={loading}
          onClick={handleLogin}
        >
          <Text className="login-btn-icon">💬</Text>
          <Text className="login-btn-text">{loading ? '登录中…' : '微信一键登录'}</Text>
        </Button>

        <View className="login-privacy">
          <Text className="login-privacy-text">登录即同意</Text>
          <View onClick={goPrivacy}>
            <Text className="login-privacy-link">《隐私政策》</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
