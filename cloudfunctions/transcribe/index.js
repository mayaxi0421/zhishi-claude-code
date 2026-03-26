const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { audioBase64, format = 'mp3' } = event
  const secretId  = process.env.TENCENT_SECRET_ID
  const secretKey = process.env.TENCENT_SECRET_KEY

  if (!secretId || !secretKey) {
    return { success: false, error: 'credentials_missing' }
  }

  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs-asr')
    const AsrClient = tencentcloud.asr.v20190614.Client
    const client = new AsrClient({
      credential: { secretId, secretKey },
      region: 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'asr.tencentcloudapi.com' } },
    })

    const result = await client.SentenceRecognition({
      ProjectId: 0,
      SubServiceType: 2,
      EngSerViceType: '16k_zh',
      SourceType: 1,
      VoiceFormat: format,
      UsrAudioKey: String(Date.now()),
      Data: audioBase64,
      DataLen: Buffer.from(audioBase64, 'base64').length,
    })

    return { success: true, text: result.Result }
  } catch (e) {
    console.error('ASR error:', e.code, e.message)
    return { success: false, error: e.message, code: e.code }
  }
}
