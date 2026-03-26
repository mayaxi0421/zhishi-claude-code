import Taro from '@tarojs/taro'

export async function callCloud(name: string, data: object) {
  const res = await Taro.cloud.callFunction({ name, data })
  return res.result as any
}
