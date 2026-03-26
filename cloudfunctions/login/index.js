const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const db = cloud.database()
  const userRes = await db.collection('users').where({ openid: OPENID }).get()
  const isNew = userRes.data.length === 0
  if (isNew) {
    await db.collection('users').add({ data: { openid: OPENID, createdAt: new Date() } })
  }
  return { openid: OPENID, isNew }
}
