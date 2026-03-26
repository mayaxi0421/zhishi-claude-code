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
  const { imageUrl, imageBase64, profile } = event
  const apiKey = process.env.VOLC_API_KEY
  const model  = process.env.VOLC_VISION_EP || 'doubao-vision-pro-32k'

  const conditions = ((profile && profile.conditions) || []).join('、') || '无'
  const allergies  = ((profile && profile.allergies)  || []).join('、') || '无'

  const prompt = `请识别这张食物图片，返回以下 JSON 格式（只返回 JSON，不要其他文字）：
{
  "name": "食物名称",
  "servingDesc": "估算份量描述（如：1碗约200g）",
  "calories": 热量数字,
  "protein": 蛋白质克数,
  "carbs": 碳水克数,
  "fat": 脂肪克数,
  "allergens": ["可能含有的过敏源列表"],
  "trafficLight": [
    {"label": "热量", "level": "green|yellow|red", "value": "具体数值"},
    {"label": "糖分", "level": "green|yellow|red", "value": "具体数值"},
    {"label": "脂肪", "level": "green|yellow|red", "value": "具体数值"},
    {"label": "钠",   "level": "green|yellow|red", "value": "具体数值"}
  ],
  "personalAdvice": "针对该用户（健康状况：${conditions}，过敏源：${allergies}）的一句话建议"
}`

  // Support both URL (from cloud storage) and base64
  const imageContent = imageUrl
    ? { type: 'image_url', image_url: { url: imageUrl } }
    : { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imageBase64 } }

  const result = await callArk(apiKey, model, [{
    role: 'user',
    content: [
      imageContent,
      { type: 'text', text: prompt },
    ],
  }])

  if (result.error) throw new Error(result.error.message)

  const text = result.choices[0].message.content
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0])

  return { success: true, data: json }
}
