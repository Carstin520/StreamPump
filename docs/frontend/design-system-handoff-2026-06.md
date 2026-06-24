# StreamPump 前端设计系统 — 会话交接 (2026-06-22)

> 用途：本次设计系统打磨会话的上下文与核心结论，供新对话继续"深度修改"时直接引用。
> 分支：`codex/post-deadline-phase-0`。所有改动**仍在工作树未提交**（28 项变更，含 1 个删除）。
> 配套文档：`docs/frontend/design-system-audit-2026-06.md`（体检报告）、`docs/frontend/texture-upgrade-plan-2026-06.md`（质感方案）。

---

## 1. 这次做了什么（已完成、均已逐批外部审查 PASS）

整体目标：在不改品牌色/IA 的前提下，把"深色 + #de402a 红橙 + 液态玻璃"语言**系统化**，并落地到消费者前门页面。按地基→表层推进：

1. **Token 单一真源**（`app/src/styles/globals.css` `:root`）：文字三级色、品牌色族、强调色、四态语义色、阶段色、圆角刻度、字阶、动效、4 档 elevation、质感旋钮。纯增量、保留全部旧变量名。
2. **玻璃容器收敛**：8 套重叠玻璃类 → 4 档 elevation token；新增 `.surface-0/1/2/3` 规范类；旧类（`liquid-panel/-card/-glass-shell/surface-muted/liquid-glass-surface`）改为引用 `--elev-*`（像素等价）；`.glass-card` 作为"亮玻璃内容卡"刻意独立；死类 `liquid-glass-surface` 折叠。
3. **字阶**：`.type-display/h1/h2/h3/title/body/sm/caption/overline` 类；h 级 token 用 `clamp()` 响应式封顶。迁移 PageShell、各页 hero（login/onboarding/创作者名/活动/Me 等）。
4. **状态色解耦**：品牌红只留"主行动+品牌点缀"；新增 `--state-{success,warning,danger,info}`、`--stage-{s1,buyout,s2}`；`color-mix` 驱动的 `.tone-stage-*` / `.tone-state-*` 语义类。迁移 StagePill、ProductReadinessBanner、各页状态徽章/就绪通知/价格涨跌/成功绿点/失败红/buyout 过期、manifest/intent 徽章表、live portfolio 背书状态。
5. **质感升级**：湿玻璃反光 0.82–0.9 → `--edge-light 0.55`、统一参数；玻璃奶白收敛；orb 6→3 + 降强度；主按钮发光收敛。全部由 6 个"质感旋钮"token 控制。
6. **IA 清理**：Demo 移出消费者主导航；workspace 侧栏 disabled 项折叠进"即将上线"组（含移动端抽屉）；nav label 全部走 i18n。
7. **amber 警示框扫尾**：18 文件的 `border-[#f3b33e]…bg-[#1a1408/1f1708]` 警示框统一为 `.tone-state-warning`。
8. **Explore 真实类目筛选**：8 类目可点击，按 `tags/title/location` 关键词集 + `stage` 真实过滤；`Creator Watch` = stage 优先、参与度兜底；新增分类空态 + i18n。
9. **死代码清理**：删除孤儿组件 `PortfolioSections.tsx`（680 行、零引用，已被 `portfolio.tsx` 内联实现取代）。

---

## 2. 设计系统现状（新修改务必沿用）

### Token（globals.css `:root`）
- 文字：`--text-main #f5f7fb / --text-muted #93a2bb / --text-faint #7486a1`
- 品牌：`--brand #de402a`（`--primary` 是其别名）、`--brand-strong/-soft/-line`
- 强调：`--accent-blue/teal/green/sky/violet`
- **语义状态**：`--state-success #2fbf71 / --state-warning #e0a23a / --state-danger #e5484d / --state-info #5b9def`（各带 `-soft`）
- **阶段**：`--stage-s1 #67b8ff / --stage-buyout #de402a / --stage-s2 #65ecaf`（各带 `-soft`）。注意：阶段色对齐产品实际 pill 色，且与 state 色刻意区分（避免撞色）。
- 圆角：`--radius-sm/md/lg/pill`（`--radius-card` = lg 别名）
- 字阶：`--fs-display/h1/h2/h3` 为 `clamp()`；`--fs-title/body/sm/caption/overline/micro(11px)/nano(10px)` 固定
- 动效：`--ease-fluid/-reel`、`--dur-fast/base/slow/page`
- elevation：`--elev-0..3-{bg,border,blur,backdrop,shadow}`
- 质感旋钮：`--sheen-top / --edge-light / --edge-soft / --edge-opacity / --glow-brand / --glow-brand-strong`

### 可复用类（`@layer components`）
- 字阶：`.type-*`
- 表面：`.surface-0/1/2/3`（新代码用这个；旧 `liquid-*` 仍可用、已 token 化）
- 状态/阶段语义：`.tone-stage-{s1,buyout,s2}`、`.tone-state-{success,info,warning,danger,pending,neutral}`（用于带 `border` 宽度的 pill/卡片；`pending`=violet，`neutral`=白/灰）

---

## 3. 关键约定与坑（最重要，新修改必须遵守）

1. **Tailwind 中 CSS 变量不能配 `/opacity` 修饰符**（`bg-[var(--x)]/20` 无效）。需要半透明时：
   - 用 `.tone-*` 语义类（已封装 border+bg+text），或
   - `border-[color:color-mix(in_srgb,var(--x)_NN%,transparent)]` / `bg-[color:color-mix(in_srgb,var(--x)_NN%,transparent)]`（**必须带 `color:` 类型提示**，空格写成 `_`）。
2. 纯色引用：文字 `text-[color:var(--x)]`、背景 `bg-[var(--x)]`（裸 var 背景 Tailwind 默认按 background-color 处理，OK）。
3. **品牌红 `#de402a` 只用于品牌/主行动/buyout 阶段**；危险/失败一律 `--state-danger #e5484d`（两个红刻意不同）。`#ff8a78` 珊瑚是 buyout 阶段浅色，不是 danger——迁移时务必区分"阶段/装饰" vs "状态语义"。
4. **数字 stat（价格/倒计时/分数/金额）、装饰性渐变、光晕**保持字面值，不套字阶、不套 tone。
5. `color-mix()` 需 evergreen 浏览器（Chrome 111+/Safari 16.2+）；已确认全量构建通过。
6. **构建超出沙箱 45s 上限**：本地只能 `npx tsc --noEmit -p app/tsconfig.json` 快速验证；全量 `npm run build --prefix app` + 浏览器 smoke 交给外部 coding agent（每批我都产出了"检查 prompt"，沿用此节奏）。
7. **删文件被门控**：`rm` 报 "Operation not permitted" 时先调 `mcp__cowork__allow_cowork_file_delete`。
8. `progress.md` 是某自动 recorder 进程写的，不是手改；工作树里它显示 `M` 属正常。
9. **文案红线**：白皮书/合规模型是 canonical——backer 收益是"封顶、非比例、与 stake 解耦"。`pitch/script.md` 仍写着 "pro-rata/proportional"，**与白皮书冲突，动到该文案时以白皮书为准**。SPUMP 不可转让/不上所；不得把 seeded/mock/preview 包装成 production；保留 readiness 标签。

---

## 4. 剩余 TODO / 有意 deferred（新对话可优先）

- **workspace 内联条件色**：`OverviewConsoleV2.tsx`、`SponsorshipDesk.tsx` 用的是内联三元色串（非干净映射表），未迁；以及 `OverviewConsole.tsx` 一处近期内容状态徽章（~line 598/813 区域）。
- **独立 amber 文字尾巴**：约 6 处 `text-[#f3c66e]/[#f8d48a]` 残留（AuthOptionsPanel、SponsorshipDesk、OverviewConsole、ActionCard、portfolio），非"警示框"故未扫。
- **Explore 类目**：当前关键词集是启发式（基于 seeded 中文 tag 词汇），未来若接真实分类字段可替换；`Creator Watch` = stage 优先，stage 全 NONE 时兜底"标签数高于均值"（因为 imported feed 的 likes/saves/stage 都未填充，是当前唯一有差异的真实信号）。接入真实 engagement/stage 后可改回更直观的定义。
- **演示态 vs 内部态双视图**（体检报告 §7 提过）：尚未做成单一开关切换的两套就绪态视图。
- **类目筛选/搜索**：顶部搜索框仍未接真实搜索。

---

## 5. 本次改动文件清单（工作树，未提交）

修改 25 个 `.tsx/.ts`（含 `globals.css` 等价物在内的样式与页面）、删除 `PortfolioSections.tsx`、`i18n.tsx` 加 4 个 key。核心地基文件：`app/src/styles/globals.css`（token + 类）。详见 `git status --short`。
