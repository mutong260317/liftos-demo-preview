# LiftOS / 训练OS — Design Spec

## Style Anchor
Apple Health 的数据克制 + Hevy 的训练专注 + Linear 的干净层级。  
不做信息流、不做游戏化、不做霓虹 Dashboard。

## Palette (Dark default)

| Token | Hex | Role |
|-------|-----|------|
| bg | `#0B0D10` | 页面底 |
| bg-card | `#161A20` | 卡片 |
| border | `#252B34` | 分隔 |
| text | `#F2F4F7` | 主文字 |
| text-secondary | `#9AA3B2` | 次级 |
| accent | `#4C8DFF` | 主操作 / 强调 |
| success | `#34C77B` | 完成组 |
| warning | `#F5A524` | 休息即将结束 |
| danger | `#FF5C5C` | 删除 / 结束确认 |
| pr | `#E8C547` | 个人纪录 |

Light Mode 通过 `[data-theme="light"]` 切换同结构 token。

## Typography
- Font stack: SF Pro / PingFang SC / system-ui
- Hero Number 32–40 / Page 28 / Section 17 / Body 15 / Caption 11
- 训练中的重量次数：28px 粗体，视觉权重最高

## Layout
- Viewport: 393×852（iPhone 15 Pro Max）
- 底部导航 72px + safe-area
- 触控目标 ≥ 44×44
- 训练页隐藏 Tab Bar，保证记录区最大化

## Signature Moments
1. **完成本组** → 绿色按钮压缩反馈 + 自动 Rest Bar 浮入
2. **New PR** → Toast 金色徽章，2.4s 收起，无全屏动画
3. **透明规则建议** → 「为什么？」Bottom Sheet 展示最近成绩与规则

## Core Screens
今日 / 计划 / 训练 / 数据 / 我的  
+ 训练总结 / 动作库 / 动作历史 / 计划详情 / 创建计划 / 各类 Sheet

## Logging Friction 策略
- 当前组大号 Stepper（−2.5 / +2.5）
- 下一组自动继承上一组重量与次数
- 完成后 1 click 进入休息
- 无数据时默认填目标次数中位与 RIR=2
