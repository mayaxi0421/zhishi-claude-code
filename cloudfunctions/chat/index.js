const https = require('https')

function callArk(apiKey, model, messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: 2048,
      messages,
    })
    const req = https.request({
      hostname: 'ark.cn-beijing.volces.com',
      path: '/api/v3/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Parse error: ' + data)) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const { messages, profile } = event
  const apiKey = process.env.VOLC_API_KEY
  const model  = process.env.VOLC_CHAT_EP || 'doubao-pro-32k'

  const conditions = ((profile && profile.conditions) || []).join('、') || '无'
  const allergies  = ((profile && profile.allergies)  || []).join('、') || '无'
  const goal       = (profile && profile.goal) || '均衡健康'

  const systemPrompt = `你是「知食」App 的 AI 营养助手小知，专业、亲切、简洁。
用户健康档案：
- 饮食目标：${goal}
- 健康状况：${conditions}
- 过敏源：${allergies}
- 每日热量目标：${(profile && profile.dailyCalories) || 1600} kcal

回答要求：
1. 结合用户具体档案给出个性化建议
2. 有慢病时主动提示饮食禁忌
3. 回答控制在 200 字以内，用换行分段
4. 使用简单易懂的中文，避免过多专业术语`

  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  const result = await callArk(apiKey, model, allMessages)

  if (result.error) throw new Error(result.error.message)

  return {
    success: true,
    content: result.choices[0].message.content,
  }
}
