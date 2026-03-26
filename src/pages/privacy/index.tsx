import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import './index.scss'

export default function Privacy() {
  return (
    <ScrollView className="privacy-scroll" scrollY>
      <View className="privacy-header">
        <View className="privacy-back" onClick={() => Taro.navigateBack()}>
          <Text className="privacy-back-icon">‹</Text>
        </View>
        <Text className="privacy-title">隐私政策</Text>
      </View>

      <View className="privacy-body">
        <Text className="privacy-app-name">知食</Text>
        <Text className="privacy-updated">最后更新：2026年3月25日</Text>

        <View className="privacy-section">
          <Text className="privacy-section-title">一、信息收集</Text>
          <Text className="privacy-section-body">
            我们收集以下信息以提供服务：{'\n\n'}
            • 微信 OpenID：用于唯一标识您的账号，不涉及手机号或真实姓名。{'\n\n'}
            • 健康档案数据：您主动填写的年龄、身高、体重、健康状况、饮食目标等信息，仅用于生成个性化建议。{'\n\n'}
            • 食物照片分析：您拍摄或上传的食物图片，仅在识别时发送至 AI 模型，不永久存储原始照片。{'\n\n'}
            • 饮食记录：您记录的每餐食物信息，存储于微信云开发数据库，仅您本人可见。
          </Text>
        </View>

        <View className="privacy-section">
          <Text className="privacy-section-title">二、使用方式</Text>
          <Text className="privacy-section-body">
            收集的信息用于：{'\n\n'}
            • 生成个性化饮食建议，根据您的健康目标和身体状况提供针对性指导。{'\n\n'}
            • 追踪您的每日饮食摄入，计算热量和营养素，帮助您了解饮食习惯。{'\n\n'}
            • 改善产品功能和用户体验，我们可能会对匿名化的统计数据进行分析。
          </Text>
        </View>

        <View className="privacy-section">
          <Text className="privacy-section-title">三、数据安全</Text>
          <Text className="privacy-section-body">
            • 您的所有个人数据均安全存储于微信云开发（CloudBase）平台，受腾讯云安全体系保护。{'\n\n'}
            • 我们不会将您的个人信息出售或提供给任何第三方商业机构。{'\n\n'}
            • AI 食物识别服务调用时，图片数据经加密传输，不在第三方服务器存储。{'\n\n'}
            • 您可以随时在"我的"页面删除您的账号及全部数据。
          </Text>
        </View>

        <View className="privacy-section">
          <Text className="privacy-section-title">四、联系我们</Text>
          <Text className="privacy-section-body">
            如您对本隐私政策有任何疑问或意见，请通过以下方式联系我们：{'\n\n'}
            邮箱：privacy@zhishi-app.com{'\n\n'}
            我们将在收到您的邮件后 7 个工作日内给予回复。
          </Text>
        </View>

        <View className="privacy-footer">
          <Text className="privacy-footer-text">
            本政策自发布之日起生效。我们保留随时更新本政策的权利，更新后将在应用内通知您。
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}
