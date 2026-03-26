import { useState, useRef, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import { XiaoZhi } from '../../components/XiaoZhi'
import { callCloud } from '../../services/cloud'
import './index.scss'

interface FlowStep {
  key: string
  bot: string
  opts?: string[]
  multi?: boolean
  numUnit?: string
  numMin?: number
  numMax?: number
  numDefault?: number
  done?: boolean
}

const FLOW: FlowStep[] = [
  {
    key: 'age',
    bot: '你好！我是小知 🌿\n先来了解你的基本情况～\n\n请问你的年龄段是？',
    opts: ['18-25岁', '26-30岁', '31-40岁', '40岁以上'],
  },
  { key: 'gender', bot: '请问你的性别是？', opts: ['女', '男'] },
  { key: 'height', bot: '你的身高是多少？', numUnit: 'cm', numMin: 100, numMax: 220, numDefault: 165 },
  { key: 'weight', bot: '你的体重是多少？', numUnit: 'kg', numMin: 30, numMax: 200, numDefault: 60 },
  {
    key: 'conditions',
    bot: '你有以下健康情况吗？\n（可多选，没有就选"都没有"）',
    opts: ['血糖偏高', '高血压', '高血脂', '痛风', '多囊卵巢', '桥本甲状腺炎', '都没有'],
    multi: true,
  },
  {
    key: 'allergies',
    bot: '你对哪些食物过敏？\n（可多选）',
    opts: ['海鲜', '花生', '乳制品', '麸质', '都不过敏'],
    multi: true,
  },
  {
    key: 'goal',
    bot: '你的主要饮食目标是？',
    opts: ['减重', '增重/增肌', '控制血糖', '均衡健康'],
  },
  { key: 'done', bot: '太棒了！我已为你建立专属健康档案 ✨', done: true },
]

const CONDITION_MAP: Record<string, string> = {
  '血糖偏高': 'hyperglycemia', '高血压': 'hypertension', '高血脂': 'hyperlipidemia',
  '痛风': 'gout', '多囊卵巢': 'pcos', '桥本甲状腺炎': 'hashimoto',
}
const GOAL_MAP: Record<string, 'lose' | 'gain' | 'health' | 'maintain'> = {
  '减重': 'lose', '增重/增肌': 'gain', '控制血糖': 'health', '均衡健康': 'maintain',
}

interface ChatMsg { role: 'bot' | 'user'; text: string; stepIdx: number }

export default function Onboard() {
  const [messages,   setMessages]   = useState<ChatMsg[]>([])
  const [step,       setStep]       = useState(0)
  const [answers,    setAnswers]    = useState<Record<string, string>>({})
  const [multiSels,  setMultiSels]  = useState<string[]>([])
  const [numVal,     setNumVal]     = useState(165)
  const [showProfile,setShowProfile]= useState(false)
  const [voiceState, setVoiceState] = useState<'idle'|'recording'|'transcribing'>('idle')

  const answersRef        = useRef<Record<string, string>>({})
  const recorderRef       = useRef<any>(null)
  const shouldTranscribeRef = useRef(false)
  const voiceStateRef     = useRef<'idle'|'recording'|'transcribing'>('idle')
  const { setProfile, syncProfileToCloud } = useUserStore()

  function setVS(s: 'idle'|'recording'|'transcribing') {
    voiceStateRef.current = s; setVoiceState(s)
  }

  useEffect(() => {
    setTimeout(() => pushBotStep(0), 300)
    const rm = Taro.getRecorderManager()
    recorderRef.current = rm
    rm.onStop(async (res: any) => {
      if (!shouldTranscribeRef.current) return
      shouldTranscribeRef.current = false
      try {
        const base64 = Taro.getFileSystemManager().readFileSync(res.tempFilePath, 'base64') as string
        const result = await callCloud('transcribe', { audioBase64: base64, format: 'mp3' })
        setVS('idle')
        if (result?.text) Taro.showToast({ title: result.text, icon: 'none' })
        else Taro.showToast({ title: '未能识别，请重试', icon: 'none' })
      } catch (e: any) {
        setVS('idle')
        Taro.showModal({ title: '识别失败', content: String(e?.errMsg || e), showCancel: false })
      }
    })
    rm.onError(() => {
      setVS('idle')
      Taro.showModal({
        title: '需要麦克风权限', content: '请在设置中开启麦克风权限',
        confirmText: '去设置', cancelText: '取消',
        success: (res: any) => { if (res.confirm) Taro.openSetting() },
      })
    })
  }, [])

  function pushBotStep(idx: number) {
    const s = FLOW[idx]
    setMessages(prev => [...prev, { role: 'bot', text: s.bot, stepIdx: idx }])
    if (s.numDefault !== undefined) setNumVal(s.numDefault)
    if (s.multi) setMultiSels([])
    if (s.done) setTimeout(() => buildProfile(), 400)
  }

  function handleAnswer(text: string, fromStep: number) {
    setMessages(prev => [...prev, { role: 'user', text, stepIdx: fromStep }])
    answersRef.current = { ...answersRef.current, [FLOW[fromStep].key]: text }
    setAnswers({ ...answersRef.current })
    const next = fromStep + 1
    setStep(next)
    if (next < FLOW.length) setTimeout(() => pushBotStep(next), 600)
  }

  function confirmNum(fromStep: number) {
    handleAnswer(`${numVal} ${FLOW[fromStep].numUnit}`, fromStep)
  }

  function toggleMultiSel(opt: string) {
    const isExclusive = opt === '都没有' || opt === '都不过敏'
    if (isExclusive) { setMultiSels([opt]); return }
    setMultiSels(prev => {
      const base = prev.filter(o => o !== '都没有' && o !== '都不过敏')
      return base.includes(opt) ? base.filter(o => o !== opt) : [...base, opt]
    })
  }

  function confirmMulti(fromStep: number) {
    if (multiSels.length === 0) {
      Taro.showToast({ title: '请至少选择一项', icon: 'none' }); return
    }
    const isNone = multiSels[0] === '都没有' || multiSels[0] === '都不过敏'
    handleAnswer(isNone ? multiSels[0] : multiSels.join('、'), fromStep)
  }

  function buildProfile() {
    const a = answersRef.current
    const heightNum = parseFloat(a.height || '0') || 0
    const weightNum = parseFloat(a.weight || '0') || 0
    const condRaw   = a.conditions || ''
    const condArr   = condRaw === '都没有' || !condRaw
      ? [] : condRaw.split('、').map(s => CONDITION_MAP[s.trim()]).filter(Boolean)
    const allergyRaw = a.allergies || ''
    const allergyArr = allergyRaw === '都不过敏' || !allergyRaw
      ? [] : allergyRaw.split('、').map(s => s.trim()).filter(Boolean)

    setProfile({
      age: a.age,
      gender: a.gender === '男' ? 'male' : 'female',
      height: heightNum,
      weight: weightNum,
      conditions: condArr,
      allergies: allergyArr,
      goal: GOAL_MAP[a.goal] || 'maintain',
    })
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
        {FLOW.slice(0, -1).map((_, i) => (
          <View key={i} className={`prog-dot ${i < step ? 'done' : i === step ? 'cur' : ''}`} />
        ))}
      </View>

      {/* Messages */}
      <ScrollView className="ob-msgs" scrollY scrollIntoView={`msg-${messages.length - 1}`}>
        {messages.map((m, i) => {
          const fs = FLOW[m.stepIdx]
          const isActive = m.role === 'bot' && m.stepIdx === step && !showProfile

          return (
            <View key={i} id={`msg-${i}`} className={`msg msg-${m.role}`}>
              <View className={`bbl bbl-${m.role}`}>{m.text}</View>

              {/* Single-select chips (active) */}
              {isActive && fs.opts && !fs.multi && (
                <View className="qrs">
                  {fs.opts.map(o => (
                    <View key={o} className="qr" onClick={() => handleAnswer(o, m.stepIdx)}>{o}</View>
                  ))}
                </View>
              )}

              {/* Multi-select (active) */}
              {isActive && fs.opts && fs.multi && (
                <View className="ob-multi-wrap">
                  <View className="ob-multi-grid">
                    {fs.opts.map(o => {
                      const sel = multiSels.includes(o)
                      return (
                        <View
                          key={o}
                          className={`ob-multi-chip${sel ? ' ob-multi-chip--sel' : ''}`}
                          onClick={() => toggleMultiSel(o)}
                        >
                          <View className={`ob-multi-check${sel ? ' ob-multi-check--sel' : ''}`}>
                            {sel && <Text className="ob-multi-tick">✓</Text>}
                          </View>
                          <Text className="ob-multi-label">{o}</Text>
                        </View>
                      )
                    })}
                  </View>
                  <View
                    className={`ob-multi-confirm${multiSels.length === 0 ? ' ob-multi-confirm--off' : ''}`}
                    onClick={() => confirmMulti(m.stepIdx)}
                  >
                    <Text className="ob-multi-confirm-text">
                      {multiSels.length > 0 ? `确认（已选 ${multiSels.length} 项）` : '请选择后确认'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Number picker (active) */}
              {isActive && fs.numUnit && (
                <View className="ob-num-wrap">
                  <View className="ob-num-row">
                    <View className="ob-num-btn" onClick={() => setNumVal(v => Math.max(fs.numMin!, v - 1))}>
                      <Text className="ob-num-btn-txt">－</Text>
                    </View>
                    <View className="ob-num-display">
                      <Text className="ob-num-val">{numVal}</Text>
                      <Text className="ob-num-unit">{fs.numUnit}</Text>
                    </View>
                    <View className="ob-num-btn" onClick={() => setNumVal(v => Math.min(fs.numMax!, v + 1))}>
                      <Text className="ob-num-btn-txt">＋</Text>
                    </View>
                  </View>
                  <View className="ob-num-fast-row">
                    {[-5, -1, +1, +5].map(d => (
                      <View
                        key={d}
                        className="ob-num-fast"
                        onClick={() => setNumVal(v => Math.min(fs.numMax!, Math.max(fs.numMin!, v + d)))}
                      >
                        <Text className="ob-num-fast-txt">{d > 0 ? `+${d}` : d}</Text>
                      </View>
                    ))}
                  </View>
                  <View className="ob-num-confirm" onClick={() => confirmNum(m.stepIdx)}>
                    <Text className="ob-num-confirm-txt">确认 {numVal} {fs.numUnit}</Text>
                  </View>
                </View>
              )}

              {/* Locked opts (past steps — visual only) */}
              {!isActive && m.role === 'bot' && fs.opts && (
                <View className="qrs qrs--locked">
                  {fs.opts.map(o => (
                    <View key={o} className="qr qr--locked">{o}</View>
                  ))}
                </View>
              )}
            </View>
          )
        })}

        {/* Profile summary card */}
        {showProfile && (
          <View className="prof-card">
            <Text className="prof-title">📋 你的健康档案</Text>
            {[
              ['年龄',       answers.age || '--'],
              ['性别',       answers.gender || '--'],
              ['身高 / 体重', `${answers.height} / ${answers.weight}`],
              ['健康情况',   answers.conditions || '都没有'],
              ['过敏源',     answers.allergies || '无'],
              ['饮食目标',   answers.goal || '均衡健康'],
            ].map(([k, v]) => (
              <View key={k} className="prof-row">
                <Text className="prof-row-key">{k}</Text>
                <Text className="prof-row-val">{v}</Text>
              </View>
            ))}
            <View className="start-btn" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
              <Text>开始使用 →</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Voice overlay (kept for edge cases) */}
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
                  <View className="ast-vdot ast-vdot--1" /><View className="ast-vdot ast-vdot--2" /><View className="ast-vdot ast-vdot--3" />
                </View>
              </>
            ) : (
              <>
                <View className="ast-voice-ring"><Text className="ast-voice-ring-icon">🎤</Text></View>
                <View className="ast-wave-bars">
                  {[1,2,3,4,5,6,7].map(i => <View key={i} className={`ast-wave-bar ast-wave-bar--${i}`} />)}
                </View>
                <Text className="ast-voice-status">录音中</Text>
                <View className="ast-voice-btns">
                  <View className="ast-voice-btn ast-voice-btn--cancel" onClick={() => { shouldTranscribeRef.current=false; recorderRef.current?.stop(); setVS('idle') }}>
                    <Text className="ast-voice-btn-text">取消</Text>
                  </View>
                  <View className="ast-voice-btn ast-voice-btn--done" onClick={() => { shouldTranscribeRef.current=true; setVS('transcribing'); recorderRef.current?.stop() }}>
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
