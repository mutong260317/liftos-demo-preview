# LiftOS / 训练OS — Demo

Mobile-first 力量训练记录高保真可交互 Demo。纯前端，无后端、无密钥。

## 技术栈

- HTML / CSS / Vanilla JS
- Mock Data（`app.js` 内）
- 无构建步骤，打开即用

## 本地运行

```bash
# 方式一：直接用浏览器打开
index.html

# 方式二：本地静态服务（推荐）
npx serve .
# 或
python -m http.server 8080
```

建议使用手机视口或 DevTools 设备模拟：**393 × 852**。

## 项目结构

```
.
├── index.html    # 页面骨架与各屏 DOM
├── styles.css    # 设计系统（Dark / Light）
├── app.js        # 交互逻辑 + Mock 数据
├── DESIGN.md     # 视觉规范摘要
└── README.md
```

## 主流程（可点击）

今日 → 开始训练 → 调重量/次数/RIR → 完成本组 → Rest Timer → 下一组/下一动作 → 训练进度 → 结束训练 → 总结 → 数据 → 动作历史

## 说明

- 深色为默认主题，可在「数据」页或「我的」切换浅色
- 所有训练数据均为本地 Mock，刷新后会话会重置
- 不包含登录、云同步、AI、HealthKit
