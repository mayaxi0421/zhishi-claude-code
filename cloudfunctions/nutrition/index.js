const https = require('https')

function fetchNutrition(query, appId, appKey) {
  return new Promise((resolve, reject) => {
    const url = `https://api.edamam.com/api/nutrition-data?app_id=${appId}&app_key=${appKey}&ingr=${encodeURIComponent(query)}`
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    }).on('error', reject)
  })
}

exports.main = async (event) => {
  const { query } = event
  const appId = process.env.EDAMAM_APP_ID
  const appKey = process.env.EDAMAM_APP_KEY

  const data = await fetchNutrition(query, appId, appKey)

  return {
    success: true,
    calories: Math.round(data.calories || 0),
    protein:  Math.round((data.totalNutrients && data.totalNutrients.PROCNT && data.totalNutrients.PROCNT.quantity || 0)),
    carbs:    Math.round((data.totalNutrients && data.totalNutrients.CHOCDF && data.totalNutrients.CHOCDF.quantity || 0)),
    fat:      Math.round((data.totalNutrients && data.totalNutrients.FAT   && data.totalNutrients.FAT.quantity   || 0)),
    fiber:    Math.round((data.totalNutrients && data.totalNutrients.FIBTG && data.totalNutrients.FIBTG.quantity || 0)),
  }
}
