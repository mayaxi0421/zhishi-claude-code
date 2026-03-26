import { View, Text } from '@tarojs/components'
import './index.scss'

export type XiaoZhiMood =
  | 'idle'       // 默认 — 绿 + 呼吸
  | 'happy'      // 达标 — 亮绿 + 弹跳
  | 'excellent'  // 优秀 — 金 + 庆祝
  | 'warning'    // 注意 — 橙 + 摇头
  | 'alert'      // 危险 — 红 + 脉冲
  | 'thinking'   // 思考 — 靛蓝 + 晃动
  | 'concerned'  // 关怀 — 紫 + 点头

export interface XiaoZhiProps {
  mood?: XiaoZhiMood
  size?: number   // rpx
  className?: string
}

const BODY_COLOR: Record<XiaoZhiMood, string> = {
  idle:      '#10B981',
  happy:     '#22C55E',
  excellent: '#F59E0B',
  warning:   '#F97316',
  alert:     '#EF4444',
  thinking:  '#818CF8',
  concerned: '#C084FC',
}

const BG_COLOR: Record<XiaoZhiMood, string> = {
  idle:      '#D1FAE5',
  happy:     '#DCFCE7',
  excellent: '#FEF3C7',
  warning:   '#FFEDD5',
  alert:     '#FEE2E2',
  thinking:  '#E0E7FF',
  concerned: '#F3E8FF',
}

// 眼睛文字表情
const EYES: Record<XiaoZhiMood, string> = {
  idle:      '• •',
  happy:     '^ ^',
  excellent: '★ ★',
  warning:   '^ ^',
  alert:     'o o',
  thinking:  '• ˘',
  concerned: '• •',
}

// 嘴巴字符
const MOUTH: Record<XiaoZhiMood, string> = {
  idle:      '‿',
  happy:     '◡',
  excellent: '▽',
  warning:   '﹏',
  alert:     '—',
  thinking:  'o',
  concerned: '‿',
}

export function XiaoZhi({ mood = 'idle', size = 120, className = '' }: XiaoZhiProps) {
  const bc = BODY_COLOR[mood]
  const bg = BG_COLOR[mood]
  const faceSize = size
  const fontSize = Math.round(size * 0.18)
  const mouthSize = Math.round(size * 0.16)
  const eyeLetterSpacing = Math.round(size * 0.06)

  return (
    <View
      className={`xz-wrap xz-${mood} ${className}`}
      style={{ width: `${faceSize}rpx`, height: `${faceSize + 24}rpx` }}
    >
      {/* 嫩芽 */}
      <View className="xz-sprout">
        <Text className="xz-sprout-text">🌱</Text>
      </View>

      {/* 圆形脸 */}
      <View
        className="xz-face"
        style={{
          width: `${faceSize}rpx`,
          height: `${faceSize}rpx`,
          background: bc,
          borderRadius: `${faceSize / 2}rpx`,
        }}
      >
        {/* 光泽高光 */}
        <View className="xz-shine" />

        {/* 眼睛 */}
        <Text
          className="xz-eyes"
          style={{
            fontSize: `${fontSize}rpx`,
            letterSpacing: `${eyeLetterSpacing}rpx`,
          }}
        >
          {EYES[mood]}
        </Text>

        {/* 腮红 */}
        <View className="xz-cheeks">
          <View className="xz-cheek" />
          <View className="xz-cheek" />
        </View>

        {/* 嘴巴 */}
        <Text
          className="xz-mouth"
          style={{ fontSize: `${mouthSize}rpx` }}
        >
          {MOUTH[mood]}
        </Text>
      </View>

      {/* excellent 专属闪光点 */}
      {mood === 'excellent' && (
        <View className="xz-sparkles">
          <View className="xz-sp xz-sp1" style={{ background: '#FCD34D' }} />
          <View className="xz-sp xz-sp2" style={{ background: '#FDE68A' }} />
          <View className="xz-sp xz-sp3" style={{ background: '#FCD34D' }} />
        </View>
      )}

      {/* thinking 专属气泡点 */}
      {mood === 'thinking' && (
        <View className="xz-think-dots">
          <View className="xz-td xz-td1" style={{ background: bc }} />
          <View className="xz-td xz-td2" style={{ background: bc }} />
          <View className="xz-td xz-td3" style={{ background: bc }} />
        </View>
      )}
    </View>
  )
}

export default XiaoZhi
