import { useState, useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import { XiaoZhi, XiaoZhiMood } from '../../components/XiaoZhi'
import { callCloud } from '../../services/cloud'
import { useUserStore } from '../../store/userStore'
import './index.scss'

interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
  time: string
}

type VoiceState = 'idle' | 'recording' | 'transcribing'

const QUICK_CHIPS = [
  '今天能吃火锅吗？',
  '减重早餐推荐',
  '膳食纤维不足怎么办',
  '血糖偏高饮食建议',
]

const CHAT_KEY = 'chatHistory'

function getTimeStr() {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

function makeWelcome(): Message {
  return {
    id: 'welcome',
    role: 'bot',
    content: '你好！我是小知 🌿\n\n我已读取你的健康档案，可以根据你的身体状况、饮食目标和今日进食情况为你提供个性化建议。\n\n有什么想问的？',
    time: getTimeStr(),
  }
}

export default function Assistant() {
  const { profile } = useUserStore()
  const [messages, setMessages] = useState<Message[]>([makeWelcome()])
  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [headerMood, setHeaderMood] = useState<XiaoZhiMood>('idle')
  const [scrollId, setScrollId] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')

  const recorderRef = useRef<any>(null)
  const shouldTranscribeRef = useRef(false)
  const voiceStateRef = useRef<VoiceState>('idle')

  function setVS(s: VoiceState) {
    voiceStateRef.current = s
    setVoiceState(s)
  }

  // Load chat history on mount
  useEffect(() => {
    try {
      const saved = Taro.getStorageSync(CHAT_KEY)
      if (saved) {
        const hist = JSON.parse(saved) as Message[]
        if (hist.length > 0) setMessages(hist)
      }
    } catch {}
  }, [])

  // Scroll + save history when messages change
  useEffect(() => {
    setScrollId('msg-' + (messages.length - 1))
    setTimeout(() => setScrollId('msg-end'), 100)
    if (messages.length > 1) {
      Taro.setStorageSync(CHAT_KEY, JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    const rm = Taro.getRecorderManager()
    recorderRef.current = rm

    rm.onStop(async (res: any) => {
      if (!shouldTranscribeRef.current) return
      shouldTranscribeRef.current = false
      try {
        const base64 = Taro.getFileSystemManager().readFileSync(res.tempFilePath, 'base64') as string
        const result = await callCloud('transcribe', { audioBase64: base64, format: 'mp3' })
        setVS('idle')
        if (result && result.text) {
          setInputVal(result.text)
        } else if (result && result.error === 'credentials_missing') {
          Taro.showToast({ title: '语音功能未配置', icon: 'none', duration: 2500 })
        } else {
          const hint = (result && result.error) ? result.error.substring(0, 20) : '未能识别，请重试'
          Taro.showToast({ title: hint, icon: 'none', duration: 2500 })
        }
      } catch (e: any) {
        setVS('idle')
        Taro.showModal({ title: '识别失败', content: e?.errMsg ?? String(e), showCancel: false })
      }
    })

    rm.onError(() => {
      setVS('idle')
      Taro.showModal({
        title: '需要麦克风权限',
        content: '请在设置中开启麦克风权限以使用语音输入',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res: any) => { if (res.confirm) Taro.openSetting() },
      })
    })
  }, [])

  function handleMicTap() {
    if (voiceStateRef.current !== 'idle') return
    const rm = recorderRef.current
    if (!rm) return
    shouldTranscribeRef.current = false
    setVS('recording')
    rm.start({ duration: 30000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' })
  }

  function handleVoiceComplete() {
    const rm = recorderRef.current
    if (!rm || voiceStateRef.current !== 'recording') return
    shouldTranscribeRef.current = true
    setVS('transcribing')
    rm.stop()
  }

  function handleVoiceCancel() {
    const rm = recorderRef.current
    if (!rm) return
    shouldTranscribeRef.current = false
    rm.stop()
    setVS('idle')
  }

  async function sendQuery(text: string) {
    if (!text.trim() || isTyping) return

    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text.trim(),
      time: getTimeStr(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputVal('')
    setIsTyping(true)
    setHeaderMood('thinking')

    try {
      // Build history for cloud (exclude welcome, convert to API role format)
      const historyMsgs = newMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

      const result = await callCloud('chat', { messages: historyMsgs, profile })

      const botMsg: Message = {
        id: 'msg-' + (Date.now() + 1),
        role: 'bot',
        content: result?.content ?? '抱歉，暂时无法回答，请稍后再试～',
        time: getTimeStr(),
      }
      setMessages(prev => [...prev, botMsg])
      setHeaderMood('happy')
      setTimeout(() => setHeaderMood('idle'), 3000)
    } catch (e: any) {
      Taro.showModal({ title: '发送失败', content: e?.errMsg ?? String(e), showCancel: false })
      setHeaderMood('idle')
    } finally {
      setIsTyping(false)
    }
  }

  function clearHistory() {
    Taro.showModal({
      title: '清空对话',
      content: '确定清空所有聊天记录？',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync(CHAT_KEY)
          setMessages([makeWelcome()])
        }
      },
    })
  }

  return (
    <View className="ast-page">
      {/* Header */}
      <View className="ast-header">
        <XiaoZhi mood={headerMood} size={140} className="ast-header-char" />
        <View className="ast-header-info">
          <Text className="ast-title">小知</Text>
          <Text className="ast-subtitle">
            {headerMood === 'thinking' ? '思考中…' : '你的 AI 营养助手'}
          </Text>
          <View className={`ast-status-dot ast-status-dot--${headerMood}`} />
        </View>
        <View className="ast-clear-btn" onClick={clearHistory}>
          <Text className="ast-clear-text">清空</Text>
        </View>
      </View>

      {/* Quick chips */}
      <View className="ast-chips-row">
        {QUICK_CHIPS.map(chip => (
          <View key={chip} className="ast-chip" onClick={() => sendQuery(chip)}>
            <Text className="ast-chip-text">{chip}</Text>
          </View>
        ))}
      </View>

      {/* Messages */}
      <ScrollView className="ast-messages" scrollY scrollIntoView={scrollId} scrollWithAnimation>
        <View className="ast-messages-inner">
          {messages.map((msg, idx) => (
            <View
              key={msg.id}
              id={`msg-${idx}`}
              className={`ast-msg-row ast-msg-row--${msg.role}`}
            >
              {msg.role === 'bot' && (
                <XiaoZhi mood="idle" size={60} className="ast-bot-avatar" />
              )}
              <View className="ast-bubble-wrap">
                <View className={`ast-bubble ast-bubble--${msg.role}`}>
                  <Text className={`ast-bubble-text ast-bubble-text--${msg.role}`}>
                    {msg.content}
                  </Text>
                </View>
                <Text className="ast-msg-time">{msg.time}</Text>
              </View>
            </View>
          ))}

          {isTyping && (
            <View className="ast-msg-row ast-msg-row--bot">
              <XiaoZhi mood="thinking" size={60} className="ast-bot-avatar" />
              <View className="ast-bubble ast-bubble--bot ast-bubble--typing">
                <View className="ast-typing-dots">
                  <View className="ast-dot ast-dot--1" />
                  <View className="ast-dot ast-dot--2" />
                  <View className="ast-dot ast-dot--3" />
                </View>
              </View>
            </View>
          )}

          <View id="msg-end" style={{ height: '4rpx' }} />
        </View>
      </ScrollView>

      {/* Input bar */}
      <View className="ast-input-bar">
        <View className="ast-input-wrap">
          <Input
            className="ast-input"
            value={inputVal}
            onInput={e => setInputVal(e.detail.value)}
            onConfirm={() => sendQuery(inputVal)}
            placeholder="输入你的问题…"
            placeholderClass="ast-input-placeholder"
            confirmType="send"
          />
        </View>
        <View className="ast-mic-btn" onClick={handleMicTap}>
          <Text className="ast-mic-icon">🎤</Text>
        </View>
        <View
          className={`ast-send-btn ${inputVal.trim() ? 'ast-send-btn--active' : ''}`}
          onClick={() => sendQuery(inputVal)}
        >
          <Text className="ast-send-text">发送</Text>
        </View>
      </View>

      {/* Voice overlay */}
      {voiceState !== 'idle' && (
        <View className="ast-voice-overlay">
          <View className="ast-voice-panel">
            {voiceState === 'transcribing' ? (
              <>
                <View className="ast-voice-ring ast-voice-ring--transcribing">
                  <Text className="ast-voice-ring-icon">✨</Text>
                </View>
                <Text className="ast-voice-status">识别中…</Text>
                <View className="ast-vdots">
                  <View className="ast-vdot ast-vdot--1" />
                  <View className="ast-vdot ast-vdot--2" />
                  <View className="ast-vdot ast-vdot--3" />
                </View>
              </>
            ) : (
              <>
                <View className="ast-voice-ring">
                  <Text className="ast-voice-ring-icon">🎤</Text>
                </View>
                <View className="ast-wave-bars">
                  {[1,2,3,4,5,6,7].map(i => (
                    <View key={i} className={`ast-wave-bar ast-wave-bar--${i}`} />
                  ))}
                </View>
                <Text className="ast-voice-status">录音中</Text>
                <View className="ast-voice-btns">
                  <View className="ast-voice-btn ast-voice-btn--cancel" onClick={handleVoiceCancel}>
                    <Text className="ast-voice-btn-text">取消</Text>
                  </View>
                  <View className="ast-voice-btn ast-voice-btn--done" onClick={handleVoiceComplete}>
                    <Text className="ast-voice-btn-text">完成</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
