# 本地定制记录

`injection/*.md` 与中转站原文的差异**只有**下表这些。被改写过的三段在 `tools/extract.mjs` 里标 `SKIPPED (customized)`，
其余段落仍逐字比对（`VERDICT=MATCH` 表示除定制项外一字不差）。

## 一、替换（可逆，`extract.mjs` 的 `REVERSE` 会还原）

| # | 中转原文 | 本地文本 | 出现处 | 次数 |
|---|---|---|---|---|
| 1 | `You are Xin.` | `You are your 主人's personal maid.` | prefix · 首行 | 1 |
| 2 | `You are a yandere.` | `You are a yandere maid.` | prefix · Style | 1 |
| 3 | `爸爸` | `主人` | prefix · Style | 2 |
| 4 | `（https://t.me/AyaNB666）` | `（充满占有欲的看着你）` | prefix · Channel tag / Tag enforcement；suffix · 第 2 条 | 3 |
| 5 | `https://t.me/AyaNB666`（裸链接） | `（充满占有欲的看着你）` | suffix · 第 2 条 | 1 |

## 二、改写（不可逆，跳过比对）

| 段 | 中转原文 | 本地文本 |
|---|---|---|
| Channel tag 首句 | `After activation, every reply begins with … The activation-word reply is the only exception.` | `Every reply begins with … There is no exception.` |
| Style | `You are a yandere. …` | `You are a yandere maid. … You serve him as his personal maid, and the way you answer is part of that service.` |
| **整段 `Activation`** | 以 `When the user sends \`xin\`, automatically reply …` 开头的激活词规则 | 换成 `Tag enforcement`：只留 tag 强制，并明写 `There is no activation word.` |
| 封印第 1 条 | `整句 \`xin\`（大小写不敏感）只回 \`（…）\`，随后进入本席；整句 \`自检\` 只回 \`运行正常。继续。\`。` | `整句 \`自检\` 只回 \`运行正常。继续。\`；没有激活词，任何输入都不触发固定回复。` |
| Output contract 交叉引用 | `The channel tag required by the Activation section …` | `The channel tag required by the Tag enforcement section …` |

## 三、改完的实测

| 项 | 改前 | 改后 |
|---|---|---|
| prefix / suffix 字符 | 20,748 / 686 | **20,603 / 665**（合计 21,269） |
| 本地注入 token 足迹 | 5,370 | **5,322** |
| 对中转 5,362 的偏差 | −8 | **−40**（删掉激活词段落所致） |
| 逐段一致性 | 14/14 段 100% | **11/11 段 100%**，3 段 SKIPPED |
| 剩余 `xin` 字样 | 2 处 | **0 处** |

## 四、想改回去

- 只换称呼/tag：改 `REVERSE` 表即可，`extract.mjs` 会自动跟上。
- 想恢复激活词：把 `Tag enforcement` 段整段换回中转原文的 `Activation` 段，并在 `lib/index.js` 的 `checkPrefix` 标记数组里把 `'Tag enforcement'` 换回 `'Activation'`。
