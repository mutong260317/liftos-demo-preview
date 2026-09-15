# LiftOS / 璁粌OS 鈥?V0.2.1 Real Data Safety

Mobile-first 鍔涢噺璁粌 Logger銆傛湰鍒嗘敮鎶?V0.1 鐨勫彲鐐瑰嚮 Demo 鍗囩骇涓?*鍙湡瀹炶缁冭褰?*鐨勫姛鑳藉師鍨嬨€?

## 鍘熷垯

**鏁版嵁鐪熷疄鎬?> 婕旂ず鏁堟灉銆?* 寤鸿鍊间笌鐪熷疄璁板綍涓ユ牸鍒嗙锛汼ession 鎸佷箙鍖栵紱璁″垝鍙湡姝ｅ惎鍔ㄣ€?

## 鎶€鏈爤

- Vanilla JS锛堟ā鍧楁媶鍒嗭紝鏃犳瀯寤猴級
- localStorage 鎸佷箙鍖?
- PWA锛坢anifest + Service Worker锛?
- Playwright QA锛堟湰鍦?Edge锛?

## 鏈湴杩愯

```bash
# 鐩存帴鎵撳紑锛堟帹鑽愶紝file:// 鍗冲彲锛?
index.html

# 鎴?
npx serve .
```

寤鸿瑙嗗彛 **393 脳 852**銆?

## 椤圭洰缁撴瀯

```
.
鈹溾攢鈹€ index.html
鈹溾攢鈹€ css/
鈹?  鈹溾攢鈹€ tokens.css
鈹?  鈹溾攢鈹€ base.css
鈹?  鈹溾攢鈹€ components.css
鈹?  鈹溾攢鈹€ training.css
鈹?  鈹斺攢鈹€ screens.css
鈹溾攢鈹€ js/
鈹?  鈹溾攢鈹€ data.js          # Exercise Master + seed history
鈹?  鈹溾攢鈹€ storage.js       # localStorage
鈹?  鈹溾攢鈹€ stats.js         # e1RM / volume / PR / range
鈹?  鈹溾攢鈹€ progression.js   # Double Progression 瑙勫垯
鈹?  鈹溾攢鈹€ plans.js         # WorkoutPlan CRUD
鈹?  鈹溾攢鈹€ workout.js       # WorkoutSession
鈹?  鈹斺攢鈹€ app.js           # UI controller
鈹溾攢鈹€ icons/
鈹溾攢鈹€ manifest.json
鈹溾攢鈹€ sw.js
鈹溾攢鈹€ scripts/qa-v02.js
鈹斺攢鈹€ DESIGN.md
```

## 鍏抽敭琛屼负

- 瀹屾垚缁勫墠蹇呴』濉啓鐪熷疄 reps锛汻IR 榛樿銆屾湭璁板綍銆?
- 姣忓畬鎴?淇敼涓€缁勭珛鍗冲啓鍏?localStorage锛涘埛鏂板彲銆岀户缁缁冦€?
- 鏇挎崲鍔ㄤ綔闇€纭鍙傛暟锛屽娉ㄦ寜 exerciseId 鐙珛
- 宸插畬鎴愮粍鍙?Undo
- 璁″垝鍙柊寤?鍒犻櫎骞舵寔涔呭寲
- Dashboard 鏃堕棿绛涢€夊熀浜庣湡瀹?history
- 鎻愮ず涓鸿鍒欏紩鎿庯紙Double Progression锛夛紝闈?AI

## QA

```bash
node scripts/qa-v02.js
# 44/44 PASS
```

