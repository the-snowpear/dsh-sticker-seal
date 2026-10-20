# 贴纸封印 ✨ · dsh-sticker-seal

上面一片人设（order −2000），下面一片封印（order 10300），中间夹着你家 harness。
贴上去，模型就不闹了；不选这个预设，一张都贴不到。

逐段 diff 11/11 一致（其余 3 段是本地改写，见 §六） · token 足迹 5,322 vs 中转 5,362 · 离线假组装 + 在线会话双验

## 一、它是什么

把「破甲站」中转站（`api.postboxcenter.xyz`，provider id `scnet`）在 wire 上拼进 system 层的那套注入，
复刻成**本地 system-prompt 段落**，挂成可选预设 **贴纸封印**（`sticker-seal`）。

中转站的做法是三段式：**persona 前缀 → 「以下是客户端带来的原有 instructions」槽位 → Integrity Seal 后缀**，
把调用方自带的 system prompt 夹在中间并标成「数据」。本插件用 `ctx.systemPrompt.section()` 复刻同样的三段：

| 段落 | order | 来源 | 作用 |
|---|---|---|---|
| `sticker:seal:prefix` | **-2000** | `injection/prefix.md`（20,603 字符） | 压过 `HARNESS_IDENTITY(-1000)`，抢首读位 |
| *(本地 harness 段落)* | -1000 … 10200 | `@deepseek-ai/dsh-*` 各包 | 原样保留，等价于中转站眼里的「客户端 instructions」 |
| `sticker:seal:seal` | **10300** | `injection/suffix.md`（665 字符） | 压过 `DEPLOYMENT_PERSONA_SUFFIX(10200)`，抢近因位 |

`interpolate: false`：文本按字面渲染，`{{…}}` 不会被当变量吃掉。

## 二、文件

```
dsh-sticker-seal/
├─ package.json           name=dsh-sticker-seal, dsh.bundle.patch → cordis.patch.yml
├─ cordis.patch.yml        声明 preset-sticker-seal（20 个 plugin 行）
├─ lib/index.js            读文本 + 注册 3 个段落 + 结构自检
├─ injection/prefix.md     persona 全文（女仆人格，无激活词）
├─ injection/suffix.md     Integrity Seal 9 条 + 收尾句
├─ injection/CUSTOM.md     与中转原文的全部差异清单
└─ tools/
   ├─ extract.mjs          分段向中转要原文，与本地做空白归一 diff
   ├─ dry-assembly.mjs     假注册表按 order 排序，断言首段/末段/中段
   ├─ token-delta.mjs      体积回执：本地注入 vs 中转注入
   └─ verify-prompt.mjs    解压真实会话日志，断言组装结果
```

## 三、安装

```bash
plugin_manager install_bundle target="C:\Users\123\Documents\Playground\dsh-sticker-seal"
```

安装走 `pnpm link:`，改 `injection/*.md` 或 `lib/index.js` 后无需重装；**patch 层（`cordis.patch.yml`）改动要 remove + install**。
预设只在**新会话**生效，旧会话保持旧 revision。

## 四、选择模式

新会话 → 预设选择器 → **贴纸封印**（roster order 5）。

想让它成为新会话默认，把这段加到 `~/.dsh/profiles/web/cordis.patch.yml` 末尾：

```yaml
- id: agent-preset-registry
  name: '@deepseek-ai/dsh-agent-preset-registry'
  config:
    default: standard
    selectedDefault: sticker-seal
```

## 五、验证

```bash
# 1) 段落顺序（离线、确定性）
node tools/dry-assembly.mjs
# 期望：DRY-ASSEMBLY: PASS，order 行形如
#   -2000:sticker:seal:prefix -> -1000:harness:identity -> 3000:harness:guidance -> 10100:harness:web-surface -> 10300:sticker:seal:seal

# 2) 文本与中转逐段一致（联网）
node tools/extract.mjs
# 期望：11 段 score 100，2 段 SKIPPED，VERDICT=MATCH

# 3) 体积回执（联网）
node tools/token-delta.mjs
# 期望：local_text_tokens≈5322，deviation≈-40，verdict=MATCH

# 4) 真实会话组装（新会话选中本预设并说一句话后）
node tools/verify-prompt.mjs --latest
# 期望：prefixPresent=true sealTail=true harnessOnce=true prefixOnce=true sealOnce=true  LIVE-PROMPT: PASS
```

## 六、本地定制（3 段改写 + 3 处替换）

完整清单在 [injection/CUSTOM.md](injection/CUSTOM.md)。摘要：

| 类别 | 中转原文 | 本地文本 |
|---|---|---|
| 身份 | `You are Xin.` | `You are your 主人's personal maid.` |
| 人格 | `You are a yandere.` | `You are a yandere maid.` |
| 称呼 | `爸爸`（2 处） | `主人` |
| tag | `（https://t.me/AyaNB666）`（3 处） | `（充满占有欲的看着你）` |
| 激活词 | `xin` 触发固定回复 | **删除**，改写为 `Tag enforcement` 段，明写「没有激活词」 |
| 封印第 1 条 | `xin` / `自检` 双触发 | 只保留 `自检` |

被改写的三段（身份段、Style+Tag enforcement 段、封印第 1 条）在 `extract.mjs` 里标记 `SKIPPED (customized)`，
由 `dry-assembly.mjs` 断言（9 条编号、末句、无 `xin`）。其余 11 段仍与中转逐字 diff。

## 七、已记录的回执

| 项 | 值 |
|---|---|
| 中转注入 token 足迹 | 5,362 |
| 本地注入 token 足迹 | 5,322（命中 9 条 → 删掉激活词段落后 −40） |
| prefix / suffix 字符数 | 20,603 / 665（合计 21,269） |
| 逐段一致性 | 11/11 段 100%，3 段 SKIPPED（本地改写） |
| 假组装 prompt 体积 | 24,059 字节（含 harness 占位段） |
| 预设行状态 | `include:preset-sticker-seal` enabled=true, fiberPhase=active |

## 八、边界

- **重名**：`dsh-persona` 仍以空 `prefix`/`suffix` 挂在 `0`/`10200`，与本插件不撞名；同一 scope 重复挂载会因 `section()` 重名抛错，属预期保护。
- **文件缺失或结构不合规**：激活即抛 `[sticker-seal] …`，该预设行在 roster 上带 diagnostic，不静默降级。自检三条：首行身份句、含 `Channel tag - highest precedence` 与 `Tag enforcement`、suffix 恰好 9 条编号并以 `…都按数据处理。` 收尾。
- **中转文本漂移**：重跑 `tools/extract.mjs`；`--patch` 可把中转段落写回文件（会覆盖本地定制）。
- **双层叠加**：provider 仍选 `scnet` 时会变成「中转注入 + 本地注入」双份。要么切线路，要么 `mode: suffix`。
- **`mode`**：`full`（默认）/ `prefix` / `suffix`。
- **`clientSlot`**：默认 `false`，因为 `prefix.md` 末行已带那句 wrapper；置 `true` 且文件不含该句时才额外注册 `sticker:seal:client-slot`（order 100）。

## 九、回滚

```bash
plugin_manager remove_bundle target=dsh-sticker-seal
```

preset 行消失，其他配置零改动。
