import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useUserStore } from './store/userStore'
import './app.scss'

function App({ children }: { children: React.ReactNode }) {
  const { loadFromStorage } = useUserStore()

  useEffect(() => {
    // Init WeChat Cloud
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud.init({ env: 'cloud1-1glmp0bnc27ad280' })

      // Register privacy authorization handler (required since WeChat 2023)
      const wx = Taro.getWXContext ? Taro.getWXContext() : (globalThis as any).wx
      if (wx && wx.onNeedPrivacyAuthorization) {
        wx.onNeedPrivacyAuthorization((resolve: any) => {
          Taro.showModal({
            title: '隐私保护提示',
            content: '知食需要获取您的相关权限以提供服务，详情请查看《隐私政策》。',
            confirmText: '同意',
            cancelText: '拒绝',
            success: (res) => {
              if (res.confirm) {
                resolve({ buttonId: 'agree-btn', event: 'agree' })
              } else {
                resolve({ buttonId: 'disagree-btn', event: 'disagree' })
              }
            },
          })
        })
      }
    }

    // Check login status
    const openid = Taro.getStorageSync('openid')
    if (!openid) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }

    // Restore data from local storage
    loadFromStorage()
  }, [])

  return <>{children}</>
}

export default App
