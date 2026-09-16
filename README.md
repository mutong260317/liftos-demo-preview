# LiftOS / 训练OS — V0.3 Gym Experience

Mobile-first 力量训练 Logger。在 V0.2.1 真实数据安全基础上，升级为更快的健身房记录体验。

## 原则

1. **不要打断训练**
2. **展示值必须区分**：上次表现 / 建议 / 当前实际输入
3. **数据真实性**：不自动把建议写成真实记录

## 技术栈

- Vanilla JS（模块拆分，无构建）
- localStorage 持久化 + schema migration
- PWA（manifest + Service Worker）
- Playwright QA

## 本地运行

```bash
# 直接打开
index.html

# 或
npx serve .
```

建议视口 **393 × 852**。

## 项目结构

```
.
├── index.html
├── css/
├── js/
│   ├── migrations.js
│   ├── data.js
│   ├── storage.js
│   ├── stats.js
│   ├── progression.js
│   ├── plans.js
│   ├── workout.js
│   ├── gym.js          # V0.3 helpers: load mode, duration, wake lock
│   └── app.js
├── docs/V0.3_GYM_EXPERIENCE.md
├── scripts/qa-v03-gym-experience.js
├── version.json
└── sw.js
```

## QA

```bash
node scripts/qa-v02.js
node scripts/qa-review-fixes.js
node scripts/qa-v021-data-safety.js
node scripts/qa-v03-gym-experience.js
```

Demo 历史数据仅 `?demo=1` 时加载。
