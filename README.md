# LiftOS / 训练OS — V0.2 Functional Prototype

Mobile-first 力量训练 Logger。本分支把 V0.1 的可点击 Demo 升级为**可真实训练记录**的功能原型。

## 原则

**数据真实性 > 演示效果。** 建议值与真实记录严格分离；Session 持久化；计划可真正启动。

## 技术栈

- Vanilla JS（模块拆分，无构建）
- localStorage 持久化
- PWA（manifest + Service Worker）
- Playwright QA（本地 Edge）

## 本地运行

```bash
# 直接打开（推荐，file:// 即可）
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
│   ├── tokens.css
│   ├── base.css
│   ├── components.css
│   ├── training.css
│   └── screens.css
├── js/
│   ├── data.js          # Exercise Master + seed history
│   ├── storage.js       # localStorage
│   ├── stats.js         # e1RM / volume / PR / range
│   ├── progression.js   # Double Progression 规则
│   ├── plans.js         # WorkoutPlan CRUD
│   ├── workout.js       # WorkoutSession
│   └── app.js           # UI controller
├── icons/
├── manifest.json
├── sw.js
├── scripts/qa-v02.js
└── DESIGN.md
```

## 关键行为

- 完成组前必须填写真实 reps；RIR 默认「未记录」
- 每完成/修改一组立即写入 localStorage；刷新可「继续训练」
- 替换动作需确认参数，备注按 exerciseId 独立
- 已完成组可 Undo
- 计划可新建/删除并持久化
- Dashboard 时间筛选基于真实 history
- 提示为规则引擎（Double Progression），非 AI

## QA

```bash
node scripts/qa-v02.js
# 44/44 PASS
```
