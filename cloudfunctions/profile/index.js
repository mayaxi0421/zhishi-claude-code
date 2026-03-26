const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const db = cloud.database()
  const { action, profile } = event

  if (action === 'save') {
    await db.collection('users').where({ openid: OPENID })
      .update({ data: { profile, updatedAt: new Date() } })
    return { success: true }
  }
  if (action === 'load') {
    const res = await db.collection('users').where({ openid: OPENID }).get()
    return { profile: (res.data[0] && res.data[0].profile) || null }
  }
}
