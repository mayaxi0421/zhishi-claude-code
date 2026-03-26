# 知食健康饮食小程序

基于 Taro 4 + React + TypeScript 构建的微信小程序。

## 目录结构

```
src/
├── app.tsx              # 应用入口
├── app.config.ts        # 页面路由 & TabBar 配置
├── app.scss             # 全局样式变量
├── store/
│   └── userStore.ts     # 全局状态（用户档案 + 饮食记录）
├── services/
│   └── ai.ts            # AI 服务（调用云函数）
└── pages/
    ├── onboard/         # 建档对话
    ├── home/            # 今日首页
    ├── camera/          # 拍照识别
    ├── report/          # 周报告
    ├── profile/         # 个人档案
    └── assistant/       # AI 助手
```

## 本地开发

```bash
# 安装依赖
npm install

# 编译到微信小程序（监听模式）
npm run dev:weapp

# 编译到 H5（浏览器调试）
npm run dev:h5
```

编译产物输出到 `dist/` 目录。

## 导入微信开发者工具

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 点击「导入项目」，选择 `dist/` 目录
3. 填入你的 AppID（在 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册后获取）
4. 点击预览即可在手机上查看

## 接入云开发（AI 功能）

在微信开发者工具中开通云开发，然后部署云函数：

```bash
# 云函数目录（待创建）
cloudfunctions/
├── chat/        # 对话 & 建档（调用 Claude API）
├── recognize/   # 食物图片识别（调用 Claude Vision）
└── nutrition/   # 营养数据（调用 Edamam API）
```

在每个云函数中设置环境变量：
- `CLAUDE_API_KEY`：Anthropic API Key
- `EDAMAM_APP_ID` / `EDAMAM_APP_KEY`：Edamam 营养数据库 Key

## 待开发页面

- [x] 建档对话（onboard）
- [x] 首页（home）
- [ ] 拍照识别（camera）
- [ ] 周报告（report）
- [ ] 个人档案（profile）
- [ ] AI 助手（assistant）
- [ ] 云函数（chat / recognize / nutrition）
