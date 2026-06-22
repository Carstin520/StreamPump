# StreamPump 前端设计系统体检报告

> 日期：2026-06-22 ｜ 范围：全局设计系统（token / 玻璃容器 / 导航 IA / 排版 / 动效 / 就绪态）
> 目标：在保留品牌语言的前提下做一次较大风格升级，消费者端优先，并区分"演示态"与"内部态"。
> 依据文件：`app/src/styles/globals.css`、`app/src/lib/routes.ts`、`app/src/components/layout/PageShell.tsx`、shell 与核心组件、`whitepaper/index.html`、`docs/product-readiness-phase-0.md`。

---

## 0. 一句话结论

视觉语言本身是成立且有辨识度的（深色 + #de402a 红橙 + 液态玻璃），**问题不在审美，而在系统化**：token 层太薄、组件大量绕过 token 用 inline rgba、玻璃容器有 8 套高度重叠的实现、缺字号/间距/圆角/动效刻度、品牌红被超载成"品牌=危险=激活=错误"。这导致跨页一致性靠人肉维持、风格升级无处下手。**先补 token 系统，升级才有支点。**

---

## 1. Token 层审计

### 1.1 现状：token 名义存在，实际被绕过

`:root` 里真正定义的只有：3 个背景/表面色阶之外，颜色仅 `--text-main` `--text-muted` `--primary`，加 4 个 glass line/fill 变量。但 `globals.css` 自己的类**几乎不用这些变量**，而是把 `rgba(255,255,255,0.06/0.07/0.08/0.09/0.12/0.14/0.15/0.16/0.2/0.22)` 直接写死在每个类里。`--glass-line`/`--glass-line-strong` 定义了却基本没被引用。

**后果**：边框白、填充白、阴影各有 10+ 个魔法值，改一处需要全局 grep。

### 1.2 缺失的刻度系统

| 维度 | 现状 | 缺口 |
| --- | --- | --- |
| 文字色 | 只有 main / muted 两级 | 缺第三级（tertiary/faint）→ 组件被迫 inline `#7486a1` `#95a6bf` `#7486a1` 等，每页不一样 |
| 强调色 | 只有 `--primary` 一个 | 蓝 `rgba(64,90,150)`、青绿 `rgba(101,236,175)`、蓝紫 `rgba(103,184,255)` 全是散落魔法值；S1/Buyout/S2 的阶段色没有 token |
| 语义/状态色 | 无 | success / warning / danger / info 全靠 primary 红兼任，红色被超载 |
| 圆角 | 只有 `--radius-card`(28px) 和 9999px | 缺 sm/md（按钮、输入框、nav-link 各写 `1.25rem`/inherit），圆角节奏不统一 |
| 字号 | 无 | 完全靠 Tailwind 一次性值（`text-[38px]` `text-[46px]`），没有 h1/h2/body/caption 刻度 |
| 字重/字距 | 无 | `tracking-[-0.06em]` 等逐处手写 |
| 间距 | 无（用 Tailwind 默认） | 组件级缺统一节奏，卡片 padding 在 `p-6/p-8/p-5` 间漂移 |
| 模糊（玻璃景深） | 14/16/18/20/22/24/30px 七档 | 没有 elevation→blur 的映射，"用哪档"无规则 |
| 动效时长 | 180/200/220/260/320/420/460/480/520/920ms | 缺 motion-duration token；缓动大多是 `--ease-fluid`（好），但 slot-reel 又另写一条 |

> 加分项：`prefers-reduced-motion` 已正确处理；字体栈含完整 CJK 回退；`content-visibility` 用于 feed 性能——这些保留。

---

## 2. 玻璃容器体系冗余（最大的一笔债）

`globals.css` 里语义重叠的"容器/表面"类有 **8 个**：
`liquid-panel`、`liquid-card`、`liquid-glass-shell`、`liquid-glass-surface`、`glass-card`、`detail-card-surface`、`app-shell-frame`、`surface-muted`。

它们的差异只是 blur（18/22/30/24/14…）+ 背景渐变透明度 + 阴影强度的微调，但：

- 没有**层级语义**（哪个是页面级 / 区块级 / 卡片级 / 静默级）；
- 各自硬编码 rgba，互相之间数值不成比例；
- `glass-card` 用亮玻璃（白 0.10→0.04 + 高光），`liquid-card` 用暗玻璃（蓝黑 0.76→0.68），两种质感混用 → 同一页面卡片质感不统一；
- `::after` 高光反射（`inset … rgba(255,255,255,0.82/0.9)`）在 shell 和 glass-card 重复实现，参数还不同。

**建议**：收敛成一套 **elevation 刻度**（如 `surface-0` 页面底 / `surface-1` 区块 / `surface-2` 卡片 / `surface-3` 浮层/抽屉），每档绑定一组 {背景、border、shadow、blur} token，旧类名做别名平滑迁移。这是风格升级的地基。

---

## 3. 品牌色超载

`#de402a` 同时承担：品牌主色、主按钮、nav 激活态、输入框 focus、就绪态里的 `OPERATOR_REQUIRED`（=危险/阻断）、错误态、阶段色里的 S1_BUYOUT。**红色没有专属语义**，用户无法从颜色判断"这是品牌强调还是出问题了"。

**建议**：品牌红只保留"主行动 + 品牌点缀"；另立 danger/warning/success/info 四个状态色 token；阶段色（S1=蓝 / Buyout=红橙 / S2=青绿）独立成 `--stage-*` token。

---

## 4. 导航与信息架构（IA）

- **Demo 进了消费者主导航**：`primaryNavItems` 含 `Demo`，和"演示态/内部态分离"直接冲突。消费者前门不该把内部演示入口当一级导航。
- **label 兜底中英混排**：`发现 / 动态 / 支持组合` 与 `Trending / Rewards / Demo` 混在一个数组（虽然 `labelKey` 走 i18n，但兜底文案不该混）。
- **Workspace 侧栏一半是 disabled**：10 项里 `内容库/Campaign/数据/结算/设置` 5 项 `disabled:true`。大量"soon"占位会稀释专业感，建议折叠进"更多/即将上线"或暂时移除。
- **筛选词与状态机术语不对齐**：消费侧 `needs-action` 等筛选 vs intent 状态 `CREATOR_PARTIALLY_SIGNED`，用户难以对应（已在 Explore 走查中记录）。
- **campaign detail/endorse/settlement 三个独立路由缺统一 tab 导航**。

---

## 5. 排版层级

PageShell 标题：`text-[38px] md:text-[46px] tracking-[-0.06em]`，副标题 `text-sm leading-7`，eyebrow `text-xs tracking-[0.24em]`——全是一次性值。跨页 H1 大小不保证一致，正文行高/字色各页自定。**缺一套 6–7 级的语义字阶**（display / h1 / h2 / h3 / body / caption / overline），是"风格升一档"最快见效的一环。

---

## 6. 风格升级方向（落地建议）

按"先地基后表层"排序，每步都可独立验证、不破坏现有页面：

1. **建 token 单一真源**：在 `:root` 补齐 文字三级色、强调色板、四态语义色、阶段色、圆角 sm/md/lg、字阶、间距步进、动效时长/缓动、elevation→{bg/border/shadow/blur} 映射。
2. **收敛玻璃容器**为 4 档 elevation，旧类名设别名，逐页替换。
3. **统一排版**：把 PageShell 等的一次性字号换成字阶类，定 H1 上限避免超宽屏过大。
4. **质感升级（这一步体现"较大升级"）**：统一高光/反射参数、统一卡片为单一玻璃质感（暗玻为主、亮玻仅用于内容卡）、收敛 backdrop orb 数量与强度、给主按钮/激活态更克制的发光。
5. **状态色解耦**：把就绪态、错误态、阶段色从品牌红中拆出。
6. **IA 清理**：Demo 移出主导航、disabled 项折叠、label 文案统一走 i18n。

---

## 7. 演示态 vs 内部态方案

目标：对外（投资人/赞助商/录屏）看到干净成品；对内（开发/运营）看到完整就绪标签与阻断点。

- **单一开关**：复用现有 `NEXT_PUBLIC_SHOW_DEMO_HINTS`，升级为三态 `presentation | internal`（+默认）。`ProductReadinessBanner` 已是 dev-only，扩成读这个开关。
- **演示态（presentation）**：隐藏所有 `SEEDED_DEMO/MOCK_PREVIEW/OPERATOR_REQUIRED` 标签与 dev 提示；保留必要、诚实的轻量声明（如 campaign 页"on devnet / 测试数据"角标），不把 seeded 包装成 production——守住 CLAUDE.md 红线。
- **内部态（internal）**：把当前散落各页的多个 banner + 状态徽章 + 签名清单，**收敛成单一可折叠"就绪总览"卡**（角色：页面级真相源），减少堆叠噪声。
- Demo 入口从主导航移到内部态可见的工具入口。

> 注意红线：演示态 ≠ 夸大就绪。白皮书/合规模型对 backer 收益是"封顶、非比例、与 stake 解耦"，与 `pitch/script.md` 里的 "proportional/pro-rata" 矛盾——动到相关文案时以白皮书为准，并需你确认是否同步改 pitch。

---

## 8. 建议的执行顺序（消费者优先）

第一阶段（地基，跨端收益）：第 6 节第 1–3 步 token + 玻璃收敛 + 字阶。
第二阶段（消费者前门）：Explore / PostCard / 详情弹层 / 创作者页 / S1 市场页 的质感与层级落地。
第三阶段：Portfolio / Rewards / 登录。
第四阶段：Workspace 与 campaign 的就绪态收敛 + IA 清理。

每一步走 `npm run build --prefix app` + 浏览器 smoke 验证。
