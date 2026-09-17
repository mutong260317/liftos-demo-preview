# LiftOS / 训练OS — V0.3.1

Mobile-first 力量训练 Logger（本地优先）。在 V0.3 稳定基线上完成 Stabilization Audit。

## 当前功能
- 计划训练 / 自由训练 / 组记录（重量·次数·RIR·类型）
- Previous / Suggested / Actual 分离；复制上一组 / 上次训练
- Assisted / Bodyweight / Added Weight / Duration 语义
- Superset A1→B1→休息→A2→B2；计划持久化
- Rest Timer、热身计算器、杠铃片计算器、Wake Lock
- 历史修正、Export/Import（原子回滚）、PWA

## 架构
```
index.html
css/          # tokens / base / components / training / screens
js/
  migrations.js  data.js  storage.js  stats.js
  progression.js plans.js workout.js gym.js app.js
```
纯静态，无构建。数据在 `localStorage`（schema v5）。

## 本地数据 / 备份
- 导出：我的 → 导出数据（JSON）
- 导入：校验 exportVersion/schema → 自动 backup → 原子恢复
- Demo：仅 `?demo=1`，写入 `liftos.demo.history`，不污染生产键

## PWA
- `manifest.json` + `sw.js`（cache `liftos-v0.3.1`）
- 训练中不自动 reload

## 本地运行
```bash
index.html
# 或
npx serve .
```
建议视口 393×852。

## 测试
```bash
node scripts/qa-v02.js
node scripts/qa-review-fixes.js
node scripts/qa-v021-data-safety.js
node scripts/qa-v03-gym-experience.js
node scripts/qa-v031-stabilization.js
```

## 已知限制
- 无账号/云同步（V0.4 方向）
- 本地多设备不同步
- iOS PWA Wake Lock / 后台限制因平台而异

## 开发协作
见根目录 `AGENTS.md` 与 PR Review 流程。
