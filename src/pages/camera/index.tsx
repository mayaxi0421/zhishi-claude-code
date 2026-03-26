import { useState, useRef } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, Camera } from '@tarojs/components'
import { useUserStore } from '../../store/userStore'
import { callCloud } from '../../services/cloud'
import { XiaoZhi } from '../../components/XiaoZhi'
import './index.scss'

interface FoodResult {
  name: string
  servingDesc: string
  calories: number
  protein: number
  carbs: number
  fat: number
  allergens: string[]
  trafficLight: Array<{ label: string; level: 'green' | 'yellow' | 'red'; value: string }>
  personalAdvice: string
}

type PageState = 'idle' | 'recognizing' | 'hasResult' | 'error'

const LEVEL_COLORS: Record<string, string> = {
  green: '#10B981', yellow: '#F59E0B', amber: '#F59E0B', red: '#EF4444',
}
const LEVEL_EMOJIS: Record<string, string> = {
  green: '🟢', yellow: '🟡', amber: '🟡', red: '🔴',
}

function getMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h < 18) return 'dinner'
  return 'snack'
}

function isValidFood(food: FoodResult): boolean {
  return !!(food && food.name && food.name !== '无' && food.calories > 0)
}

export default function CameraPage() {
  const { addMealRecord, profile } = useUserStore()
  const [pageState, setPageState] = useState<PageState>('idle')
  const [currentFood, setCurrentFood] = useState<FoodResult | null>(null)
  const [previewPath, setPreviewPath] = useState<string>('')
  const [camError, setCamError] = useState(false)
  const runIdRef = useRef(0)

  function reset() {
    runIdRef.current++
    setPageState('idle')
    setCurrentFood(null)
    setPreviewPath('')
  }

  async function processPhoto(filePath: string) {
    setPreviewPath(filePath)
    setPageState('recognizing')

    let srcPath = filePath
    try {
      const compressed = await Taro.compressImage({ src: filePath, quality: 30 })
      srcPath = compressed.tempFilePath
    } catch (_) {}

    const runId = ++runIdRef.current

    try {
      const cloudPath = `food/${Date.now()}.jpg`
      const uploadRes = await Taro.cloud.uploadFile({ cloudPath, filePath: srcPath })
      const urlRes = await Taro.cloud.getTempFileURL({ fileList: [uploadRes.fileID] })
      const imageUrl = urlRes.fileList[0].tempFileURL

      const result = await callCloud('recognize', { imageUrl, profile })

      if (runId !== runIdRef.current) return

      if (result?.data && isValidFood(result.data)) {
        setCurrentFood(result.data)
        setPageState('hasResult')
      } else {
        setPageState('error')
      }
    } catch (e) {
      if (runId === runIdRef.current) {
        console.error('Recognition error', e)
        setPageState('error')
      }
    }
  }

  function takePhoto() {
    if (pageState === 'recognizing') { reset(); return }
    if (pageState === 'hasResult' || pageState === 'error') { reset(); return }

    const ctx = Taro.createCameraContext()
    ctx.takePhoto({
      quality: 'normal',
      success: (res: any) => processPhoto(res.tempImagePath),
      fail: () => Taro.showToast({ title: '拍照失败，请重试', icon: 'none' }),
    })
  }

  async function pickFromAlbum() {
    if (pageState === 'recognizing') return
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
      })
      processPhoto(res.tempFiles[0].tempFilePath)
    } catch (e: any) {
      if (e && e.errMsg && e.errMsg.includes('cancel')) return
      Taro.showToast({ title: '选择失败，请重试', icon: 'none' })
    }
  }

  function handleRecord() {
    if (!currentFood) return
    addMealRecord({
      id: Date.now().toString(),
      type: getMealType(),
      name: currentFood.name,
      calories: currentFood.calories,
      protein: currentFood.protein,
      carbs: currentFood.carbs,
      fat: currentFood.fat,
      imageUrl: previewPath,
      time: new Date().toTimeString().slice(0, 5),
    })
    Taro.showToast({ title: '记录成功', icon: 'success' })
    setTimeout(reset, 1000)
  }

  const showLiveCamera = pageState === 'idle' && !camError

  return (
    <View className="cam-page">
      <View className="cam-back" onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
        <Text className="cam-back-text">‹</Text>
      </View>

      {/* Camera / preview area */}
      <View className="cam-area">
        {showLiveCamera ? (
          <Camera
            className="cam-live"
            devicePosition="back"
            flash="off"
            onError={() => setCamError(true)}
          />
        ) : (
          <View className="cam-preview-wrap">
            {previewPath ? (
              <Image src={previewPath} className="cam-preview-img" mode="aspectFill" />
            ) : (
              // Camera permission denied fallback
              <View className="cam-no-cam">
                <Text className="cam-no-cam-icon">📷</Text>
                <Text className="cam-no-cam-text">请在设置中开启相机权限</Text>
              </View>
            )}
          </View>
        )}

        {/* Corner brackets overlay */}
        {pageState === 'idle' && (
          <View className="cam-corners-overlay">
            <View className="cam-corner cam-corner--tl" />
            <View className="cam-corner cam-corner--tr" />
            <View className="cam-corner cam-corner--bl" />
            <View className="cam-corner cam-corner--br" />
            {!camError && <View className="cam-scan-line" />}
          </View>
        )}

        {/* Hint text */}
        <Text className={`cam-hint${pageState === 'error' ? ' cam-hint--error' : ''}`}>
          {pageState === 'hasResult'   ? '识别完成 ✓ 向上查看结果' :
           pageState === 'error'       ? '未能识别食物，请重新拍摄' :
           pageState === 'recognizing' ? '识别中，点击按钮可取消' :
                                         '对准食物，点击拍照'}
        </Text>

        {/* Recognizing overlay */}
        {pageState === 'recognizing' && (
          <View className="cam-recognizing-overlay">
            <XiaoZhi mood="thinking" size={180} />
            <Text className="cam-recognizing-text">小知识别中…</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View className="cam-controls">
        {/* Album button */}
        <View className="cam-ctrl-side" onClick={pickFromAlbum}>
          {pageState === 'idle' && (
            <>
              <Text className="cam-ctrl-emoji">🖼️</Text>
              <Text className="cam-ctrl-label">相册</Text>
            </>
          )}
        </View>

        {/* Shutter / cancel button */}
        <View className="cam-capture-outer" onClick={takePhoto}>
          <View className={`cam-capture-inner${pageState === 'error' ? ' cam-capture-inner--error' : ''}`}>
            <Text className="cam-capture-icon">
              {pageState === 'hasResult' || pageState === 'error' ? '✕' : ''}
            </Text>
          </View>
        </View>

        <View className="cam-ctrl-side" />
      </View>

      {/* Result sheet */}
      {pageState === 'hasResult' && currentFood && (
        <View className="cam-result-mask">
          <View className="cam-result-sheet">
            <View className="cam-sheet-handle" />

            <View className="cam-food-header">
              <View className="cam-food-emoji-box">
                <Text className="cam-food-emoji-lg">🍽️</Text>
              </View>
              <View className="cam-food-meta">
                <Text className="cam-food-name">{currentFood.name}</Text>
                <Text className="cam-food-desc">{currentFood.servingDesc}</Text>
              </View>
              <View className="cam-kcal-badge">
                <Text className="cam-kcal-num">{currentFood.calories}</Text>
                <Text className="cam-kcal-unit">kcal</Text>
              </View>
            </View>

            <View className="cam-nutrition-grid">
              {[
                { label: '蛋白质',    val: currentFood.protein, color: '#10B981' },
                { label: '碳水化合物', val: currentFood.carbs,   color: '#F59E0B' },
                { label: '脂肪',      val: currentFood.fat,     color: '#3B82F6' },
              ].map(n => (
                <View key={n.label} className="cam-nutrition-cell">
                  <Text className="cam-nutrition-val" style={{ color: n.color }}>{n.val}g</Text>
                  <Text className="cam-nutrition-lbl">{n.label}</Text>
                </View>
              ))}
            </View>

            <View className="cam-advice-box">
              <Text className="cam-advice-title">💬 个性化建议</Text>
              <Text className="cam-advice-body">{currentFood.personalAdvice}</Text>
            </View>

            {currentFood.trafficLight && currentFood.trafficLight.length > 0 && (
              <View className="cam-lights-list">
                {currentFood.trafficLight.map((item, i) => (
                  <View key={i} className="cam-light-row">
                    <View className="cam-light-dot" style={{ background: LEVEL_COLORS[item.level] || '#10B981' }} />
                    <Text className="cam-light-text">
                      {LEVEL_EMOJIS[item.level] || '🟢'}{'  '}{item.label}：{item.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {currentFood.allergens && currentFood.allergens.length > 0 && (
              <View className="cam-allergen-box">
                <Text className="cam-allergen-title">⚠️ 含过敏原</Text>
                <Text className="cam-allergen-body">{currentFood.allergens.join('、')}</Text>
              </View>
            )}

            <View className="cam-btn-row">
              <View className="cam-retake-btn" onClick={reset}>
                <Text className="cam-retake-text">重拍</Text>
              </View>
              <View className="cam-record-btn" onClick={handleRecord}>
                <Text className="cam-record-text">✓ 记录这餐</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
