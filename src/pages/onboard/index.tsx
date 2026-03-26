import { useState, useRef, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import { XiaoZhi } from '../../components/XiaoZhi'
import { callCloud } from '../../services/cloud'
import './index.scss'

interface Message {
  role: 'bot' | 'user'
  text: string
  opts?: string[]
  multi?: boolean
}

const FLOW = [
  { bot: '你好！我是小知 🌿\n先来了解一下你吧，这样我才能给你最准确的建议。\n\n请问你的年龄段是？', opts: ['18-25岁','26-30岁','31-40岁','40岁以上'] },
  { bot: '好的～请问你的性别是？', opts: ['女','男'] },
  { bot: '你现在大概的身高体重是多少？\n（比如 165cm / 58kg）', opts: ['165cm / 58kg','170cm / 70kg','自己输入'] },
  { bot: '你有以下健康情况吗？（可多选）', opts: ['血糖偏高','高血压','高血脂','痛风','多囊卵巢','桥本甲状腺炎','都没有'], multi: true },
  { bot: '你对哪些食物过敏？', opts: ['海鲜','花生','乳制品','麸质','都不过敏'] },
  { bot: '你的主要饮食目标是？', opts: ['减重','增重/增肌','控制血糖','均衡健康'] },
  { bot: '太棒了！我已为你建立专属健康档案 ✨', done: true },
]

// conditions 关键词映射
const CONDITION_MAP: Record<string, string> = {
  '血糖偏高': 'hyperglycemia',
  '高血压': 'hypertension',
  '高血脂': 'hyperlipidemia',
  '痛风': 'gout',
  '多囊卵巢': 'pcos',
  '桥本甲状腺炎': 'hashimoto',
}

export default function Onboard() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputVal, setInputVal] = useState('')
  const [step, setStep] = useState(0)
  const [showProfile, setShowProfile] = useState(false)
  const [answers, setAnswers] = useState<string[]>([])
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const scrollRef = useRef<any>(null)
  const recorderRef = useRef<any>(null)
  const shouldTranscribeRef = useRef(false)
  const voiceStateRef = useRef<'idle' | 'recording' | 'transcribing'>('idle')
  const { setProfile, syncProfileToCloud } = useUserStore()

  function setVS(s: 'idle' | 'recording' | 'transcribing') {
    voiceStateRef.current = s
    setVoiceState(s)
  }

  useEffect(() => {
    setTimeout(() => pushBot(FLOW[0]), 300)
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
        } else {
          Taro.showToast({ title: '未能识别，请重试', icon: 'none' })
        }
      } catch (e: any) {
        setVS('idle')
        const detail = (e && e.errMsg) ? e.errMsg : String(e)
        Taro.showModal({ title: '识别失败', content: detail, showCancel: false })
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
    if (voiceStateRef.current !== 'idle' || !recorderRef.current) return
    shouldTranscribeRef.current = false
    setVS('recording')
    recorderRef.current.start({ duration: 30000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000, format: 'mp3' })
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

  function pushBot(s: typeof FLOW[0]) {
    setMessages(prev => [...prev, { role: 'bot', text: s.bot, opts: s.opts, multi: s.multi }])
    if ((s as any).done) {
      setTimeout(() => buildProfile(), 400)
    }
  }

  function pushUser(text: string) {
    setMessages(prev => [...prev, { role: 'user', text }])
  }

  function pickOpt(text: string, isMulti?: boolean) {
    if (isMulti) return // multi handled separately
    pushUser(text)
    const nextStep = step + 1
    setAnswers(prev => { const a=[...prev]; a[step]=text; return a })
    setStep(nextStep)
    if (nextStep < FLOW.length) setTimeout(() => pushBot(FLOW[nextStep]), 600)
  }

  function sendInput() {
    const v = inputVal.trim()
    if (!v) return
    pickOpt(v)
    setInputVal('')
  }

  function buildProfile() {
    const conditions = answers[3]
      ? answers[3].split(',').map(s=>CONDITION_MAP[s.trim()]).filter(Boolean)
      : []
    const allergies = answers[4] === '都不过敏' ? [] : (answers[4] || '').split(',').map(s=>s.trim()).filter(Boolean)
    setProfile({ conditions, allergies })
    // Cloud sync (fire and forget)
    const updated = useUserStore.getState().profile
    if (updated) syncProfileToCloud(updated).catch(() => {})
    setShowProfile(true)
  }

  return (
    <View className="onboard">
      {/* Header */}
      <View className="ob-header">
        <XiaoZhi mood="idle" size={76} className="ob-av" />
        <View className="ob-info">
          <Text className="ob-name">小知</Text>
          <Text className="ob-sub">建立健康档案，获取专属饮食方案</Text>
        </View>
        <View className="ob-skip" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>跳过</View>
      </View>

      {/* Progress */}
      <View className="ob-progress">
        {FLOW.slice(0,-1).map((_,i) => (
          <View key={i} className={`prog-dot ${i < step ? 'done' : i === step ? 'cur' : ''}`} />
        ))}
      </View>

      {/* Messages */}
      <ScrollView className="ob-msgs" scrollY scrollIntoView={`msg-${messages.length-1}`}>
        {messages.map((m, i) => (
          <View key={i} id={`msg-${i}`} className={`msg msg-${m.role}`}>
            <View className={`bbl bbl-${m.role}`}>{m.text}</View>
            {m.opts && (
              <View className="qrs">
                {m.opts.map(o => (
                  <View key={o} className="qr" onClick={() => pickOpt(o, m.multi)}>{o}</View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Profile card */}
        {showProfile && (
          <View className="prof-card">
            <Text className="prof-title">📋 你的健康档案</Text>
            <View className="prof-row"><Text>饮食目标</Text><Text>{answers[5] || '均衡健康'}</Text></View>
            <View className="prof-row"><Text>过敏源</Text><Text>{answers[4] || '无'}</Text></View>
            <View className="prof-row"><Text>健康情况</Text><Text>{answers[3] || '无'}</Text></View>
            <View className="start-btn" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
              <Text>开始使用 →</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      {!showProfile && (
        <View className="ob-input-bar">
          <Input
            className="ob-input"
            value={inputVal}
            onInput={e => setInputVal(e.detail.value)}
            onConfirm={sendInput}
            placeholder="输入或点击快捷回复…"
          />
          <View
            className="ob-mic"
            onClick={handleMicTap}
          >
            <Text className="ob-mic-icon">🎤</Text>
          </View>
          <View className="ob-send" onClick={sendInput}>↑</View>
        </View>
      )}

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
