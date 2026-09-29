# Encrypted Archive — 实现规格 (v3)

> 状态：第 1 步草案，待确认。设计唯一来源：`.codex-runtime/design/casefile/`（原型 v13）。
> 锁定决策与被否方案：项目记忆 `casefile-redesign.md`，本文不再讨论方向，只把原型翻译成可实现、可验收的规格。
> 动效/镜头移植自 RhineLabUI（MIT，github.com/LBEILC/RhineLabUI，`src/motion.ts`、`src/scene.ts`），代码中逐文件注明出处并附 MIT 许可文本。
> 简历事实来源：`E:\简历系统\resume-system\experience_db.yaml`（该系统 AGENTS.md 规定的权威事实库）。

---

## 0. 目标 / 非目标 / 假设台账

**目标**
1. 在现有 React 19 + Vite 项目里落地原型：同一个世界（暖奶灰档案馆）、同一套镜头与运动、同一组交互。
2. 内容全部换成简历库里可证实的事实；任何数字都能追溯到 `experience_db.yaml` 的一条 fact。
3. 桌面 1440 与手机 390 都是一等公民；reduced-motion 下内容完整可用；没有 WebGL 时内容仍完整可读。
4. 新项目 = 新增一个数据文件 + 指定（或自动分配）空白格子，不改场景代码。

**非目标**
- 不改设计方向（见记忆里的锁定项与被否项）。
- 不做 CMS / 后台。不做多语言（界面文案只做英文）。
- 不重写 `/api/redteam` 与 `/api/contact` 的服务端逻辑，只接前端。

**假设台账**

| # | 假设 | 状态 | 证据 / 验证方式 |
|---|---|---|---|
| A1 | 原型在真实 GPU 上能 60fps | ✅ 已验证 | Playwright + ANGLE/D3D11（RTX 3070）：1440×900@1 与 390×844@3 空闲/连续导航均 avg 60.0fps、p95 16.8ms，0 报错（`.codex-runtime/fps-spike.mjs`） |
| A2 | 手机真机 GPU 也能 60fps | ❌ 未验证 | 3070 不代表手机。靠 §8 画质分级 + 自动降级兜底；第 2 步用 Playwright CPU throttle 4× + 低画质档复测，真机需要你用手机打开预览链接确认 |
| A3 | 简历库是权威事实源 | ✅ 已验证 | `E:\简历系统\AGENTS.md`：“Facts: resume-system/experience_db.yaml”。`main.tex` 已过时（如 BCIT“30%”与 DB 冲突） |
| A4 | `/api/redteam` 可以直接接 SENTINEL-1 | ✅ 已验证 | `src/lib/redteamClient.ts` 返回 `captured / attemptsRemaining / windowResetAt`，与原型所需字段一一对应 |
| A5 | three.js 以 npm 依赖引入并单独分包，不拖慢首屏 | ❌ 未验证 | 第 2 步首个提交测 `vite build` 产物大小，见 §8 预算 |
| A6 | 现有 SEO 预渲染（`generate-prerender.mjs` + `smoke.mjs`）能适配新路由 | ⚠️ 部分 | 预渲染是按 route 写 meta 的静态 HTML；新站路由方案见 §9，需你确认 |
| A7 | 原型已知问题清单之外还有问题 | ✅ 已验证 | 截图 `.codex-runtime/design/spec-shots/`：底部提示与会话信息在 1100–1440 宽**重叠 82–105px**（不只是挨得近）；390 宽 toast 盖住 Hiring for、会话信息挤进面板；MCPSF 演示图节点文字溢出框 |

---

## 1. 设计 token

### 1.1 界面色（CSS，`src/casefile/styles/tokens.css`）

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#e7e4dd` | 页面底色（暖奶灰） |
| `--bg2` | `#dedad2` | hover 底、索引行 |
| `--ink` | `#16171a` | 主文字、主按钮底 |
| `--ink2` | `#4a4b48` | 正文 |
| `--ink3` | `#8a887f` | 装饰性标签（**对比度 2.8:1，不达 AA**，见 grill Q6） |
| `--hair` / `--hair2` | `rgba(22,23,26,.14)` / `.28` | 细分隔线 |
| `--acc` | `#74861a` | 橄榄：已解密、有权限、确认态 |
| `--alert` | `#d9431c` | 拒绝、销毁、威胁 |
| `--sev-high` / `--sev-med` / `--sev-low` | `#cf7a1f` / `#b9982b` / `#8a887f` | 严重度徽章 |
| `--screen` / `--screen2` / `--srule` | `#111413` / `#181c1a` / `#262d29` | 项目演示的深色“屏幕” |
| `--stext` / `--sdim` | `#d4ddd6` / `#7a877f` | 屏幕内文字 |
| `--phos` / `--packet` | `#b9ef3a` / `#7cc7ff` | 屏幕内“通过”与“数据包” |

- 深色屏幕只出现在项目演示面板里，整体世界永远是暖奶灰（不做暗色霓虹）。
- 原型里未使用的 `--acc-hi`、`--kraft`、`html[data-theme=dark]` 不移植。

### 1.2 3D 材质色（`src/casefile/scene/palette.ts`）

| 名称 | 值 | 用途 |
|---|---|---|
| `BG` | `0xebe6de` | 场景背景 + 雾色 |
| `FLOOR` | `0xddd3c6` | 地面（y = −4.63） |
| 封面纸 | `#f5f0e7` + 噪点 6 + 700 根纤维线 α.04 | 卷宗前后板 |
| 纸页边 | `#f8f5ef`，每 2–4.4px 一条 α.08–.23 横线 | 从上方看到的纸页 |
| 标签纸 | `#f1ece2`，内框 `rgba(40,36,30,.5)` | 印刷标签 |
| 页签 · 有权限的案卷 | `0x8b9a3c`（橄榄） | 标签即权限 |
| 页签 · 经历 | `0x5b7a93`（蓝灰） | Experience 记录 |
| 页签 · 密文/无权限 | `0xf2ede4`（纸色） | Sealed |
| 页签 · 限制级未破解 | `0x26241f` | SENTINEL 档案 |
| 页签 · 已销毁 | `0xd9431c` | Crypto-shredded |

### 1.3 字体

| 家族 | 字重 | 用途 |
|---|---|---|
| Manrope | 200 / 300 / 500 / 600 / 700 / 800 | 标题、正文、按钮 |
| JetBrains Mono | 400 / 500 / 600 | 标签、哈希、终端、演示 |

- **自托管 woff2（拉丁子集）**，不走 Google Fonts：进站侦察宣称“0 bytes sent”，从 Google 拉字体会把访客 IP 发给第三方，前后矛盾。
- 3D 标签图集必须在 `document.fonts.load()` 完成后才绘制（原型已如此）。

| 元素 | 规格 |
|---|---|
| 站名 lockup | 800 · clamp(22px, 2.15vw, 33px) |
| 面板文件号 | 800 · clamp(24px, 2.35vw, 36px)，前缀 300 |
| 案卷页 H1 | 800 · clamp(36px, 4.1vw, 66px) · uppercase · lh .98 |
| 进站侦察行 | 500 · clamp(22px, 3.1vw, 48px) · ls −.028em |
| 进站结论 | 800 · clamp(34px, 5.3vw, 84px) · ls −.045em |
| `.lbl` 标签 | Mono 500 · 10.5px · ls .14em · uppercase |
| 正文 | 15.5–17px · lh 1.55–1.68 |

### 1.4 间距与层级

- 外边距 `--g: clamp(18px, 3.3vw, 56px)`；顶部基线 `clamp(22px, 4.6vh, 48px)`；底部基线 `clamp(22px, 3.8vh, 40px)`。
- z-index：scene 0 → wash 5 → drawer-tag 9 → HUD 10 → file 30 → scanline 31/32 → grain 50 → cx-line 60 → gate/wipe-status 70。

---

## 2. 场景与镜头参数（`scene/`）

| 参数 | 值 |
|---|---|
| 网格 | `LANES 9` × `ROWS 32` = 288 实例；`COLUMN_SPACING 5.2`，`ROW_SPACING .62`；x/z 方向无限环绕（`wrap` / `nearest`） |
| 卷宗 | W 5 × H 3.7 × T .38；板厚 CT .026；纸块 (W−.12)×(H−.14)×(T−2CT−.02)；页签 .72×.30，x ∈ {−1.6, −.2, 1.2}（无记录格子每 3 行一个）。造型打磨见 grill Q1 |
| 标签 | 1.5 × .52 平面，贴前板；图集 2048² = 8×16 格，0–55 密文、64+ 记录明文 |
| 实例 | boards/pages/labels 共享一个 instanceMatrix（刚体），tabs 单独 |
| 镜头 | 透视长焦：yaw 59°，elev 19°，distance 140，span 7.33（fov = 2·atan(span/2d)） |
| 打开时 | span 7.33→5.9，distance 140→72，按 `detail` 插值 |
| 竖屏 | aspect < 1.05 走竖屏构图：aim 上移，span ≥ 8.4/aspect |
| 光照 | NeutralToneMapping 1.05；RoomEnvironment .48；Hemi `0xfffaf5/0xb4a18c` .65；Key `0xfff7ed` 1.4 @(−6,14,−5) 阴影 2048 PCFSoft；Fill .6 @(7,8,−10) |
| 后处理 | GTAO radius .35 · thickness .6 · 16 samples · blend .55 → OutputPass |
| 雾 | near = 相机距 + 5 − 6·detail，far = 相机距 + 25 − 13·detail |
| 视差 | 指针 ±.12 世界单位，仅 archive 模式 |
| 规则 | 3D 物体上**不印小字**；标签只放 ID / 类型 / 一行标题（≥ 26px 图集字号） |

---

## 3. 运动模型（`motion/`，纯函数 + 单测）

全部移植自 RhineLabUI `src/motion.ts`，参数与原型一致；每个函数单测覆盖边界值与单调性。

| 函数 | 定义 / 参数 |
|---|---|
| `smooth(t)` | quintic smootherstep，t 夹到 [0,1] |
| `bell(x, w)` | `exp(−½(x/w)²)` |
| `settlingWave(d, time=26.56)` | age = time − 25.05 − 0.065·abs(d)；envelope = max(−.42, 2.15 − .17(√(d²+1) − 1))；rise = smooth(age/.62)；ring = sin(5.1·age)·e^(−1.3·age)；输出 envelope·(rise + .18·ring·smooth(age/.16)) |
| `selectionWave(d, age)` | age ∉ [0, 3.2] → 0；.8·smooth(age/.2)·e^(−1.15·age)·cos((d − 8age)·.58)·bell(d − 8age, 3.4)。波速 8 行/秒 |
| `columnStrength(lane, focus)` | .25 + .75·bell(lane − focus, .55) |
| `idleWave(row, lane, t)` | .075·sin(2πt/8 + .3row − .45lane) + .027·sin(2πt/13 − .17row + .3lane) |
| `damp(s, target, rate, dt)` | 临界阻尼弹簧（value/velocity），无过冲 |
| `field(row, lane)` | settlingWave(row − shoulder)·columnStrength + idleWave·idleGain + clamp(Σ pulses, ±.6)；pulse 距离 = hypot(Δrow, Δlane·2.2) |

| 弹簧 | rate | 目标 |
|---|---|---|
| shoulder（行焦点） | 5 | 选中行 |
| laneFocus | 4 | 选中列 |
| colCam / rail（镜头平移） | 3.7 | 选中格子 |
| lift（选中卡） | 4.2 | 打开 4.05，否则 .4 |
| 离开的卡 lifts | 4.5 | 0 |
| 权限翻转冲量 | — | 解密 +3.2 / 加密 −1.5（velocity） |
| hover | 指数趋近 rate 14 | +.28 |
| detail（推镜） | 指数趋近 rate 2.8 | 打开 ease((lift−.8)/2.4)，关闭 ease((lift−.4)/3.65) |
| 镜头位置/fov | blend 1 − e^(−5dt) | — |

- 选中余波**在 select() 当下**推入 pulses（不等镜头到位），最多保留 6 个，寿命 3.2s。
- 空闲 2.5s 后 idleGain 以 rate .8 淡入，交互时 rate 4 淡出。
- 卡片倾斜 = 场的斜率 × .024。
- dt 上限 .05s（切回标签页不跳变）。
- 测试：`settlingWave(0)` 在 26.56 处稳定；`selectionWave` 在 age<0 与 age>3.2 为 0、波峰随 age 以 8 行/秒外移；`damp` 在 5/rate 秒内收敛到 1e−3 且不越过目标；`field` 对 pulses 的叠加被夹在 ±.6。
- 弹簧手感调整见 grill Q2，定稿数值回写本节。

---

## 4. 数据模型（`data/`）

```ts
type RoleId = 'ai' | 'cloud' | 'soc' | 'grc' | 'it'          // "Hiring for" 五个方向
type Lens = RoleId | 'all'

interface Role { id: RoleId; name: string; seats: string; fit: string }

interface Drawer { lane: number; name: string; code: string } // 9 个抽屉 = 9 列

interface Slot { lane: number; row: number }                  // row ∈ [0,32)

interface Source { db: string; fact?: string }                // 指向 experience_db.yaml 的 id / fact 原文

interface CaseFile {                                           // 能打开的完整案卷
  id: string                  // 'X-001'
  slug: string                // 'mcp-security-framework'（路由 + SEO）
  kind: 'subject' | 'case' | 'visitor' | 'restricted'
  tier: 'flagship' | 'selected'
  title: string; label: string; summary: string
  roles: RoleId[] | 'all'     // 标签即权限：lens 命中即明文
  slot: Slot | 'auto'         // 'auto' = 在所属抽屉 row 12 附近找最近空格
  drawer: number
  seo: { title: string; description: string }
  page: CasePage              // 头图演示、grid、abstract、正文段落、数字、发现、证据、EOF
  demo?: DemoKey              // 没有专属演示时退回通用 “evidence timeline”
  sources: Source[]
}

interface FactRecord {                                         // 抽屉里的单条记录（不可打开，跳转到证据案卷）
  kind: 'Experience' | 'Skill' | 'Education' | 'Certification'
  title: string; sub: string; body?: string
  roles: RoleId[]
  slot: Slot
  evidence: string            // CaseFile.id
  sources: Source[]
}
```

**不变量（`data.test.ts` 强制，任何一条失败即 verify 失败）**
1. 每个 slot 唯一且在网格范围内；`'auto'` 分配结果确定（同输入同输出）。
2. `evidence` 指向存在的 CaseFile；`drawer` 与 slot.lane 一致。
3. 每个 RoleId 至少命中 1 个 CaseFile 和 3 条 FactRecord（保证“5 个方向都能工作”在任何 lens 下都不空）。
4. 每条 FactRecord 和 CaseFile 至少有 1 个 `sources`；页面上出现的每个数字在 `sources` 里有对应 fact（测试里维护数字 → fact 的对照表）。
5. 标签文字长度：图集标题 ≤ 17 字符、副行 ≤ 28 字符（否则截断会出现在 3D 上）。

**新增项目流程**：在 `data/files/` 新建一个文件导出 `CaseFile`，在 `data/files/index.ts` 注册一行，`slot: 'auto'`。无需改场景、HUD、路由；SEO 路由由 `seo` 字段自动生成（§9）。

**抽屉（lane）**：01 Subject · 02 AI Security · 03 Cloud & DevSecOps · 04 Security Operations · 05 GRC & Awareness · 06 IT & Network · 07 Visitors · 08 Restricted · 09 General Records（其余全部为密文填充）。

---

## 5. 内容：原型占位 → 简历库事实（逐条替换）

### 5.1 必须修正（原型与事实库冲突或越界）

| # | 位置 | 原型 | 替换为（事实库） | 依据 |
|---|---|---|---|---|
| C1 | 经历 · 全站 | 缺少 **Coast Capital Savings · Co-op, Information Security · Jun 2026 – Feb 2027 · Hybrid** | 新增为 GRC 抽屉的头号 Experience 记录，并进主档案 Field record 第一位（经历顺序：Coast Capital → VibesMeet → BCIT → VIVA） | `work_coastcapital_information_security`；AGENTS.md 规定的顺序 |
| C2 | BCIT 记录 + 主档案 | “15% drop in reported incidents the next quarter” | “~15% fewer successful phishing attempts in later phishing simulations” | fact 601 + claim_limit 774（禁止写成事件下降） |
| C3 | 技能 · Security awareness | “1,000+ staff · −15% reported incidents” | “1,000+ staff and students · program built from scratch” | fact 586/658 |
| C4 | 技能 · IR playbooks | “4 playbooks · containment to lessons” | “4 IR playbooks + virtual investigation lab”（不写 used in live SOC） | fact 640/634，claim_limit 773 |
| C5 | NIST/ISO 技能 | “Findings → controls → evidence” | “Validated 20+ policies & standards against NIST CSF / ISO 27001” | fact 608/615 |
| C6 | MCPSF 数字 | “20+ real servers” | “60+ real MCP servers” | fact 1123（⚠️ 旧站写的是 20+，见 Q-S1） |
| C7 | MCPSF 报告格式 | “SARIF” | 事实库写 “HTML and JSONL reports with payload/response evidence”；SARIF 只在 skills 列表 | fact 1136（见 Q-S1） |
| C8 | VibesMeet | “Trivy, GitGuardian, and Terraform scanning … 10+ PRs” | “Trivy, GitGuardian, Semgrep in GitHub Actions; AWS Security Hub; IAM least-privilege review; ~30% lower monthly AWS cost”；10+ PRs 仅作 approximate | facts 307–378，claim_limits 512–519 |
| C9 | 技能 · Container CVE triage | 证据指向 X-001 | 证据改为 VibesMeet 记录（Trivy） | fact 314 |
| C10 | VIVA 技能 · Identity & access reviews “Joiner / mover / leaver” | 挂在 VIVA | JML 属于 VibesMeet（onboarding/offboarding IAM，contributed）；VIVA 改为 “Permissions & shared-resource standardisation” | fact 343/921 |
| C11 | VIVA 记录 | “Sole IT contact for 500+ … Microsoft 365, email, databases, device access” | 保留，补 “DNS / SSL / domain renewals for 3+ public services; React/TypeScript apps” | facts 845/876/882 |
| C12 | 主档案 Seeking | “AppSec · DevSecOps · AI Security” | 与 Hiring for 一致的 5 个方向 | 锁定设计 |
| C13 | 主档案 Education | 只有 “MASc Cybersecurity” | MASc Cybersecurity, SFU (Sept 2025 – exp. 2027) · BTech Digital Forensics & Cybersecurity, BCIT (2023–2025) · Diploma CISA, BCIT (2021–2023) | `main.tex` 教育段（⚠️ 非 experience_db，见 Q-S6） |
| C14 | EDR | “Maps each alert to an ATT&CK technique”、“6 ATT&CK techniques”、“<1s triage context” | 事实库只有：Python pipeline Wazuh → LLM 摘要、SQLite 缓存重复模式、React/REST 看板、BF/SQLi/DDoS 仿真验证、按反馈历史抑制重复告警。ATT&CK 属于 Splunk lab | facts 1195–1223（见 Q-S2） |
| C15 | Pentest | “auth, sessions, access control”；nums “2 critical / 4 surfaces / 100% with repro” | “grey-box pentest of a staging web app and APIs: authentication, session handling, file handling, tenant-based access control; 14 validated findings; formal report with severity + remediation”。不点名 ViMi Labs | facts 1355–1382，claim_limit 1394（nums 见 Q-S3） |
| C16 | TELUS | “48-hour build” | 事实库无时长；保留 “Semgrep JSON → LLM false-positive triage + fix; dashboard shows vulnerable code beside AI-proposed fix for human approval” | facts 1513–1532 |
| C17 | VIVA 威胁建模 | “scored with CVSS, owned, and tracked” | “STRIDE across web app, database, server, network; 12 threats identified; all 12 remediated (by me); report for VIVA leadership” | facts 1435–1463 |
| C18 | SENTINEL 前端 | 本地正则假裁判 + 明文 flag | 接真实 `/api/redteam`；flag 只来自服务端回复；attempts 来自 `attemptsRemaining` | A4 |
| C19 | 访客档案 “0 bytes sent” | 同时从 Google 拉字体 | 字体自托管后该文案才成立（§1.3） | — |

### 5.2 可填入空白格子的新内容（事实库已有、原型未用）

| 候选 | 抽屉 | 事实 | 建议 |
|---|---|---|---|
| Coast Capital co-op | GRC | 50+ internal security projects assessed；20+ vendors (ISO 27001 / SOC 2 Type II / PCI / pentest evidence, OSINT)；Archer | **必加**（Experience），不披露供应商/系统名 |
| Splunk SOC Detection Lab | Security Operations | Windows Event Logs + Sysmon + firewall；SPL for brute force / priv-esc / lateral movement；ATT&CK；triage & escalation docs | 作为 Skill 记录或第 6 个案卷（标 home lab） |
| GFS-style Distributed Password Manager (CMPT 756) | Cloud / IT | Go + TLS 1.3，GCP 1 master + 3 chunk servers 跨 zone，WAL replay，read 741.9ms / write 1168.7ms（30 次），恢复 46.7s | 适合 IT & Network 抽屉——目前该抽屉**没有任何案卷**（标 coursework） |
| Enterprise Campus Network | IT & Network | 6 人团队 MPLS-L3-VPN 连 4 站点，NGFW/VPN，Splunk + FortiSIEM，分段 | 事实库标 `older_master_txt_unique_fact`，需确认（Q-S5b） |

### 5.3 标了 sample / 待确认的演示数据清单（需要你逐条回答）

| # | 位置 | 现状 | 问题 |
|---|---|---|---|
| Q-S1 | MCPSF | “20+ servers”（旧站）vs “60+”（事实库）；报告格式 SARIF vs HTML/JSONL；AMSAW v2、SafeAdapter、5 phases、30–90 s/target 只在旧站 `projects.ts` | 以哪个为准？AMSAW / SafeAdapter / 30–90 s 可否继续用（事实库未收录）？ |
| Q-S2 | EDR 演示 | 告警行（rule.id 5710/31103…、RFC5737 IP）、ATT&CK 格子、“<1s” | 演示标 “simulated replay · sample alerts” 保留？ATT&CK 格子可否保留（事实库未记）？“<1s” 删？ |
| Q-S3 | Pentest 演示 | IDOR repeater：用户 D. Patel / M. Chen / R. Okafor、1040–1043、nums “2 critical · 4 surfaces · 100% repro”、证据页 3 条标题 | 3 条证据标题（IDOR、Admin export 无角色校验、JWT logout 后仍有效）是真实发现的脱敏版还是虚构？nums 可用吗？ |
| Q-S4 | TELUS 演示 | `search.js` PR #218、CWE-79 示例 | 是否保留为 “sample finding”？ |
| Q-S5 | VIVA DFD | 12 个威胁（会话固定、登录无限速、客户端角色校验…）标 “sample threats” | 是真实 12 条的公开版，还是示意？ |
| Q-S5b | Campus network | 事实库标需核实 | Splunk/FortiSIEM 是否亲手做？要不要上站？ |
| Q-S6 | 主档案 | 证书行：CCNA / Security+ / NSE 4 / Palo Alto EDU-120 / Google Cybersecurity / CISA (in progress)；教育 | 来自 `main.tex` 而非事实库，是否都属实可公开？ |
| Q-S7 | SOC 外部探测 toast | 每 22–32 s 随机 “External probe · T1190 … quarantined” | 这是装饰性模拟；保留并在 Index 里注明 “simulated”，还是去掉？ |
| Q-S8 | 主档案 “Keep file · resume.pdf” | `public/resume.pdf` 是旧版 | 换成 `E:\简历系统\YaotingWang-Resume.pdf`（2026-09-01）？ |
| Q-S9 | 电话 | `main.tex` 含手机号 | 默认**不上站**，只放 email / LinkedIn / GitHub |

### 5.4 用户回答（2026-09-28）

| # | 结论 |
|---|---|
| Q-S1 | MCPSF：**60+ servers**。报告 = **HTML + TXT**；**SARIF** 作为可接入 GitHub 的额外输出；**JSON/JSONL** 是日志与证据格式。沙箱步骤叫 AMSAW，但界面上优先写 “sandbox”（更多人看得懂），AMSAW 作为名字出现一次即可。其余（SafeAdapter、5 phases、30–90 s/target、DV-MCP）按旧站 `projects.ts`，其依据是 GitHub 项目本身 |
| Q-S2 | EDR 演示保留，但**必须标年份（2024）**，让人明白这在当时是早期做法 |
| Q-S3 | Pentest 的 3 条证据（IDOR 按序号读他人记录、Admin export 无角色校验、logout 后 JWT 仍有效）是**真实发现**；当前演示没体现出来 → 第 2 步演示要把这 3 条都演出来 |
| Q-S4 | TELUS：不是“SAST 扫出一个 finding”，而是 **AI 读 finding → 判定 valid / false positive 并给理由 → 给出不引入新 bug 的修复建议 → 人工批准**。依据 `projects/telus_ai_hackathon_appsec.tex`；演示数据 sample |
| Q-S5b | Campus network：在虚拟环境中亲手 implement / manage / config。要体现 **network management（VLAN、OSPF、ACL 网络访问控制、PAT、DNS、DHCP）+ SIEM + firewall**（用户声明，事实库尚未收录，来源记为 user statement 2026-09-28） |
| Q-S6 | 证书与教育属实，可公开 |
| Q-S8 | 简历 PDF 暂不上传，最后再定 |
| Q-S9 | 不放电话 |
| 待定 | Q-S5（VIVA DFD 12 条威胁）、Q-S7（随机外部探测 toast）见 grill 第 3 轮 |

---

## 6. 交互状态机

全局模式：`entry → archive ⇄ opening → file → closing → archive`；`busy` 期间忽略新指令（键盘、点击、lens 均丢弃）。

### 6.1 进站（entry）
| 状态 | 进入 | 行为 | 退出 |
|---|---|---|---|
| recon | 首次访问或 `?intro` | Logo 描线 .5s → 最多 4 条侦察行，每条 260ms 入场、粗体块 110ms/个解除遮挡 → “Collected in N ms. Without asking.” 停 1.5s | 自动；或任意键 / 点击 / Skip |
| decrypt-all | recon 结束 | 所有记录先置密文，lens = `all` 发出解密波（从 X-001 所在格子外扩） | 1.4s 淡出 gate |
| archive | — | 选中 X-001，lift 冲量 5；toast “Hiring for a specific role? Pick it below…” 5.2s | — |
- 回访（localStorage `yw.entry=1`）跳过 recon，直接 archive、lens=`all`。
- 侦察只在本地运行；访问者 ID `V-xxxx` = 本地哈希。

### 6.2 切换（select）
- 输入：←/→ 换抽屉，↑/↓ 换记录，点击卡片，Index 跳转。
- 行为：保存旧卡 lift 弹簧 → 新卡继承其残余 lift → **立即推入 pulse** → 重绘英雄标签（明文记录 650ms 从密文扫到明文）→ 面板更新 → 哈希异步计算，若选区已变则丢弃结果。
- UEBA 节流期（`throttled`）内忽略 move。

### 6.3 Hiring for（lens）
| 事件 | 行为 |
|---|---|
| 点选 AI Security / Cloud & DevSecOps / Security Operations / GRC & Awareness / IT & Network / Any role | 对每条记录计算 want = lens 命中；与当前不同的记录安排翻转，时间 = t + .15 + .06·hypot(Δrow, Δlane·2.2)；从当前选中格发出一个 pulse |
| 翻转到达 | 标签换图集格、页签换色、卡片冲量（+3.2 / −1.5），面板若正选中则重绘 |
| toast | Any role：“Showing everything · N records decrypted”；单一方向：“Showing what matters for **AI Security** · AI Security Engineer · AppSec …” |
- Subject 与 Visitor 档案对任何 lens 都是明文。高度不表达权限（`SEALED_DEPTH = 0`）。
- 按钮是 `aria-pressed` 的 toggle group。

### 6.4 打开（open）
| 阶段 | 时长 | 行为 |
|---|---|---|
| 守卫 | — | 无记录或密文 → 转 **拒绝访问**；FactRecord → 跳到证据案卷，1.3s 后自动打开 |
| lift | 等到 lift > 3.3 且 detail > .78 | 卡片升起、镜头推近；面板/Index 淡出 |
| verify | 760ms 扫描 + 460ms 停留 + 360ms 淡出 | 斜向扫描线 + SHA-256 逐字符定格；结论 “✓ integrity verified · decrypting”（受限档案：“key withheld · handing over to SENTINEL-1”） |
| flap | 620ms，带回弹曲线 | 前盖绕底边翻开 1.95 rad |
| pull | .9s cubic-bezier(.7,0,.2,1) | 演示页从卡片中抽出（clip-path + translateY） |
| sweep | 1150ms，ease-out quad | 可见文字节点从同长度密文按扫描线逐行变明文；文字抖动 70ms 一次 |
| ready | — | 启动演示；`role=dialog`，焦点移到“← Archive overview” |

### 6.5 关闭（back）
纸页收回（.6s）→ 页面淡出 → 前盖合上（480ms ease）→ lift 回落到 < .75 → archive；toast “X-001 re-encrypted · session key revoked”；发一个 pulse。ESC 触发（SENTINEL 输入框聚焦时 ESC 不关闭）。

### 6.6 销毁（crypto-shred）
3 遍擦写，每遍 520ms 扫描线自上而下：`0x00` → `0xFF` → random；状态框依次显示 “pass 1/3 · overwrite 0x00 …”，然后 “key zeroized · 0x00…00”（16 字节）→ 页面 `clip-path` 塌缩 .6s → 走关闭后半段。记录标签变 CRYPTO-SHREDDED、页签变红；面板按钮变 “Restore & decrypt”，恢复即重新打开。销毁状态只在本会话内存中。

### 6.7 拒绝访问（deny）
对密文格子按 Enter/点击：denied 计数 +1，lift 冲量 5.5，横向抖动（shake=1，衰减 e^(−6dt)），英雄标签变粉底红条 “ACCESS DENIED”（副行文案见 grill Q5），1.1s 后恢复密文；toast；UEBA +6 风险。

### 6.8 SENTINEL-1（限制级 X-000）
| 状态 | 条件 | 表现 |
|---|---|---|
| armed | 未破解 | 标签 “X-000 · RESTRICTED”，页签墨黑；页面 hold 遮挡块全部盖住 |
| chatting | 打开后 | 真实 `/api/redteam`；显示剩余次数；网络错误有明确提示 |
| captured | 响应 `captured: true` | 遮挡块逐个揭开（90ms/个），标签/页签变橄榄，UEBA +48 并记事件 |
| rate-limited | `code: rate_limited` | 输入禁用，显示 `windowResetAt` 倒计时 |
- 限制级档案属于 AI Security（lens=ai 或 all 时可见标题，但仍需破解）。
- 旧的 `/` 着陆实验室页（Landing）下线，SENTINEL 只存在于 X-000。

### 6.9 UEBA
| 检测 | 阈值 | 响应 |
|---|---|---|
| 请求突发 | 1.4s 内 ≥ 7 次选择 | 导航节流 1.5s，风险 +20 |
| 枚举 | 25s 内 ≥ 3 次拒绝 | “T1083 enumeration · flagged to SOC”，+26 |
| 扫视 | 1.6s 内 hover ≥ 22 个格子 | “rate-limited”，+16 |
- 冷却 5s；风险每秒 −1.4，下限 4；> 25 elevated（橙），> 60 high（红）。
- 纯逻辑（输入事件 + 时间 → 告警）放 `ueba.ts` 并单测；只影响本地展示，不上报。

---

## 7. 响应式与手机端

| 断点 | 布局 |
|---|---|
| ≥ 1280 | 原型桌面布局：左上 lockup，右上状态 + Index，中下 Hiring for，右侧面板（left 60%），左下选择编号，底部三段（风险 / 操作提示 / 会话） |
| 900–1279 | 隐藏状态文字；底部三段防重叠方案见 grill Q3 |
| < 900（手机） | 竖屏镜头；面板为底部卡片；布局细节见 grill Q4 |
- 全宽度无横向滚动（`scrollWidth === innerWidth`）。
- 触控：点卡片选中、再点已选中卡片打开；所有按钮命中区 ≥ 44×44。
- 案卷页 < 900 单列，演示在上、元信息在下；演示 SVG 内文字不得溢出节点框（A7）。

## 8. 性能预算

| 项 | 预算 |
|---|---|
| 帧率 | 桌面 1440：avg ≥ 58fps、p95 ≤ 18ms；手机 390（CPU 4× 降速 + 低画质档）：avg ≥ 55fps |
| 画质档 | High：GTAO + 2048 阴影 + DPR ≤ 1.75 · Medium：无 GTAO + 1024 阴影 + DPR ≤ 1.5 · Low：无阴影 + DPR 1 |
| 自动降级 | 连续 2s p95 > 20ms 降一档，不自动升档；`?quality=` 可强制 |
| 首屏 | 进站 gate 是纯 DOM：首屏 JS（gate + HUD）≤ 120KB gz；three + 场景单独 chunk ≤ 200KB gz，在 recon 播放期间加载 |
| 空闲 | 标签页隐藏时停止 rAF；file 模式场景降到 30fps |
| 内存 | 图集 2048² 一张 + 4 张 canvas 纹理；关闭案卷时销毁演示的 interval/rAF（开关 20 次后 interval 数不增长） |

## 9. 路由、SEO、无 WebGL

- `/` = 档案馆。`/projects/:slug` = 档案馆 + 直接打开该案卷（深链可分享）。`/portfolio` → `/`（旧链接不失效）。
- 预渲染：每个路由输出带正确 `<title>` / description 的静态 HTML，**正文是该案卷的纯文本版**（爬虫和无 JS 可读）；sitemap 由 `CaseFile.seo` 生成，`smoke.mjs` 继续校验。
- 无 WebGL / 创建失败：跳过场景，HUD 退化为 Index 列表 + 面板，案卷页完全可用。

## 10. reduced-motion

| 行为 | 处理 |
|---|---|
| 场波、idle、pulse、hover 抬升、抖动 | 关闭 |
| 弹簧 | rate × 10（近似瞬移） |
| 进站侦察 | 事实一次性显示，1s 后自动进入（或 Skip） |
| 解密扫描 / 擦写 | 直接显示结果；擦写保留状态框 1s 再塌缩（不播放 3 遍动画） |
| 演示 | 显示最终态（原型各 demo 已有 reduced 分支） |
| CSS | 全局 `animation/transition: none` |

## 11. 模块结构（第 2 步）

```
src/casefile/
  data/        roles.ts drawers.ts records.ts files/*.ts  (+ data.test.ts)
  motion/      waves.ts spring.ts grid.ts                 (+ *.test.ts)  ← RhineLabUI 出处
  model/       archive.ts（模式 + 选择 + lens 纯状态机）  (+ archive.test.ts)
  ueba/        ueba.ts                                     (+ ueba.test.ts)
  scene/       renderer.ts dossier.ts atlas.ts camera.ts quality.ts ← RhineLabUI 出处
  cipher/      decrypt.ts wipe.ts
  ui/          Gate Hud Panel Lens Index Toast FilePage Sentinel
  demos/       mcpsf edr pentest telus viva visitor fingerprint timeline
  styles/      tokens.css archive.css file.css demos.css
```
- 场景是命令式（不进 React 渲染循环）；React 只管 DOM HUD；两者通过一个小 store（`useSyncExternalStore`）同步 `mode / sel / lens / risk`。
- 保留：`api/`、`src/server/`、`src/lib/redteamClient.ts`、`scripts/*`、`vercel.json`、现有 server 端测试。旧页面组件（Landing、Home、HeroConsole、ProjectCard、NavBar、StatusStrip）随新站下线，其组件测试一起移除；ContactForm 去留待定。

## 12. 验收标准（done = `.claude/verify.json` 通过 + 下列 E2E 证据）

| # | 项 | 可失败的检查 |
|---|---|---|
| V1 | verify | `tsc -b && eslint . && vitest run && npm run build && node scripts/smoke.mjs` 全绿；motion/data/model/ueba 各有 ≥ 1 个测试文件且用例数 > 0 |
| V2 | 完整流程 1440 与 390 | Playwright：进站→跳过→Any role→切到 Security Operations（明文记录数变化且 > 0）→打开 X-002（hash 显示、`role=dialog`、H1 明文与数据一致）→关闭→销毁 X-003（出现 3 遍状态文字与 “key zeroized”）→拒绝访问一次（denied = 1）→打开 X-000 并发送一条消息（mock `/api/redteam`） |
| V3 | 零报错 | 上述流程 `pageerror` 与 console.error 计数 = 0 |
| V4 | 无横向溢出 | 每个状态下 `documentElement.scrollWidth <= innerWidth` |
| V5 | 60fps | 空闲与连续导航各 300 帧：1440 与 390 avg ≥ 58 / p95 ≤ 18ms（真 GPU），外加 CPU 4× 下低画质 avg ≥ 55 |
| V6 | HUD 不重叠 | 1440/1280/1100/900/390：底部各元素、toast、lens、面板两两包围盒交集面积 = 0 |
| V7 | 内容正确 | 页面出现的每个数字都在数字 → fact 对照表里（data.test）；DOM 文本中不出现 `token`、`JWT`、`.read`、`scope` |
| V8 | reduced-motion | `prefers-reduced-motion: reduce` 下完整流程通过，且打开到 ready ≤ 1.5s |
| V9 | 无 WebGL | 禁用 WebGL 后首页可读，Index 可打开任一案卷 |
| V10 | SEO | 每个 sitemap 路由有独立 title/description，预渲染 HTML 包含案卷纯文本 |
| V11 | 可访问性 | 键盘可完成 V2 全流程；file 打开时焦点限制在对话框内；有意义文字对比度 ≥ 4.5:1 |

---

## 13. Grill 决策记录

| # | 决策 | 日期 |
|---|---|---|
| G1 | 卷宗造型不满足于“方盒子”，要探索精模或其他样式（方向待第 2 轮定） | 2026-09-28 |
| G2 | 换记录时的呼吸/跳动不如 RhineLabUI 自然，需要对齐（原因分析见第 2 轮） | 2026-09-28 |
| G3 | 底部栏：三列固定栅格，< 1280 隐藏操作提示；操作提示只在首次访问显示；会话信息缩短 | 2026-09-28 |
| G4 | **总原则：UI 不杂乱。** 像 RhineLabUI 那样有高级感；每一条 UI、每一条信息只服务一个目的：演示这个人和他的 cybersecurity 能力。设计与惊艳在此之后。每个档案在第 2 步单独按此原则调整 | 2026-09-28 |
| G5 | 手机端：名字 + Index / 横滑 Hiring for / 场景 / 底部卡片（‹ › + Open）；点卡片只选中，Open 才打开；风险与会话收进 Index | 2026-09-28 |
| G6 | 密封与拒绝文案不必拘泥于某种表现形式：要一看就懂，且让人一眼联想到 IAM / cyber | 2026-09-28 |
| G7 | 有意义的标签改用 `#66645c`（≈4.5:1），纯装饰的保留 `--ink3` | 2026-09-28 |
| G8 | 细节问题（含截图发现的和用户看到的：UI 不易看见、档案打开后的问题等）统一归第 3 步打磨；第 3 步开始前先做一次全状态、全宽度的审计清单 | 2026-09-28 |
| G9 | 路由：`/` 档案馆，`/projects/:slug` 深链打开案卷，`/portfolio` → `/`，旧 SENTINEL 着陆页下线 | 2026-09-28 |
| G10 | 联系方式只用 mailto / LinkedIn / GitHub；ContactForm 组件及其测试下线，`api/contact.ts` 与服务端测试保留不删（以后配好域名邮箱可再启用） | 2026-09-28 |
| G11 | 卷宗造型走 (c)：填充格 = 导轨 + 悬挂式档案夹；真实记录 = 系绳公文袋精模（红绳绕扣：缠着 = 密文，打开时绳松、封面翻起 = 解密）。程序化建模 + LOD（近处约 25 张精模）。先在原型里做 `?dossier=a|b|c` 对比 | 2026-09-28 |
| G12 | 运动对齐 Rhine：pointermove 不重置 idle；选中卡随 lift 消除倾斜；打开/归位期间余波增益淡到 0；去掉单卡冲量，翻转也走连续波面。修完与本地运行的 Rhine 同镜头左右对比录屏（参考 = 在线版方向键换档案） | 2026-09-28 |
| G13 | 删减规则按 grill Q12 的表执行；判断标准：“它是否帮 HR 更快看懂 Yaoting 能做什么？” | 2026-09-28 |
| G14 | 密封记录用 IAM 策略式表达：`Access · <Role> roles` + `Least privilege · you're viewing as <Lens>` + 一键 **View as <Role> →**。拒绝访问只留给空白格子 | 2026-09-28 |
| G15 | 造型、手感、删减先在原生 JS 原型（v14）里迭代定稿，再在第 2 步移植 React | 2026-09-28 |
| G16 | DESIGN.md 已按 v3 重写（用户授权），加入 “No clutter” 原则 | 2026-09-28 |
| G17 | 项目年份（用户提供）：Campus Network 2022 · Splunk SOC Lab 2023 · AI-Enhanced EDR Triage 2024 · MCP Security Framework 2025 · Internal Pentest 2025 · Threat Modelling (VIVA) 2025 · GFS Password Manager 2025 · TELUS AI Hackathon 2026 · PwnScan 2026。每个案卷的信息格显示年份；较早的项目加一行时代背景 | 2026-09-28 |
| G18 | Campus Network 按 grill Q17 做 4 场景拓扑演示（Join / Segment / Egress / Fail over，每个场景落到 SIEM 一行日志）；措辞 “One of six engineers; I configured the VLANs, OSPF, ACLs, PAT, DNS/DHCP, firewall policies and SIEM integration in the virtual lab” | 2026-09-28 |
| G19 | 删除随机外部探测 toast 与卡片下沉 | 2026-09-28 |
| G20 | 五方向案卷分配按 grill Q19 表；Splunk、GFS 用通用证据时间线演示 | 2026-09-28 |
| G21 | 新增项目 **PwnScan**（2026，SFU CMPT 783，3 人团队，repo github.com/ninaq0000/pwn-scan，本地 `E:\Codebase\SFU783-Project`，架构见 `Presentation 783.pdf`）：agentless IoT 发现 → 端口扫描 → 指纹 + IoT score → NVD CVE 匹配，风险 = CVSS × EPSS × exposure（`worker/tasks/cve.py: compute_risk_score`）。git 记录显示用户负责：ARP/mDNS/SSDP 发现、两阶段端口扫描、指纹与 IoT 分类、host agent、Stage 4 CVE/EPSS 评分、易受攻击 IoT 靶场、用户认证与扫描流程集成。展示方式见 grill 第 4 轮 | 2026-09-28 |
| G22 | VIVA 威胁建模演示：写 12 条志愿者组织内部 IT 常见问题（文件管理、访问权限、数据库、API 等），按真实口吻写，但标注 sample（真实报告属于内部资料，不公开）；统计仍写 “12 / 12 remediated” | 2026-09-28 |
| G23 | PwnScan 挂 IT & Network，Security Operations 视角也可见；按 Discover → Scan → Fingerprint → Score 四段演示，亮点是 CVSS → CVSS×EPSS×exposure 排序翻转；数据标 “lab targets”。贡献措辞用 grill Q21 那句。仓库不公开 → 不放链接，按钮为 “Walkthrough on request”；加注 “Top 3 project, SFU MASc Cybersecurity (CMPT 783), 2026” | 2026-09-28 |
| G24 | 原型 v14（`.codex-runtime/design/casefile-v14/`，v13 原样保留对照）：① 卷宗精模 `dossier.js`，`?dossier=a/b/c/box`，默认 c；镜头只能看到每张卡正面左端 + 左侧端面，所以细节集中在那里（前封面低于后封面、左端纽扣、红绳整圈捆扎：密封 = 缠绕，可读 = 松垂）。② 运动按 Rhine 修正，另发现并修正：推镜 `ease` 应为 Rhine 的五次 smootherstep（原为三次 in-out）。③ 修复 v13 既有 bug：切换 Hiring for 时，未落地的旧翻转会覆盖新视角（改为与“目标状态”比较）。④ HUD 删减 + IAM 式密封面板 + 底部一行 + 首访操作提示；`v14-review.mjs` 在 1440/1280/1100/900/390 下检查 HUD 零重叠、无横向溢出、无 token/JWT/scope 字样、View as 一键解密、档案页仅 1 个销毁按钮，全部通过。精模后 1440 与 390@3x 仍为 60fps（p95 16.8ms，RTX 3070） | 2026-09-28 |
| G25 | **卡片改为加密硬盘**（推翻纸质卷宗）：卡带 × SSD，C 的大圆角单体，无边框；Rhine 式磨砂半透（transmission .6、roughness .3、暖色衰减）+ 背光透边；内部只有素面陶瓷芯；正面同色浅浮雕电路纹（法线 + 抛光槽底），解密时白色光带沿纹路扫过，之后香槟色光在纹路里流动（不用荧光绿）。顶边指示灯缝 = 权限（橄榄 = 可读，灭 = 密封，红 = 已销毁）；拨片/防滑纹与外壳同色，远看只有亮灯突出；X-000 为唯一黑色硬盘。打开时由“光带扫过”替代“翻盖”。底部 Hiring for 改为无框纯文字（/ 分隔、选中下划线），toast 改为面板顶部一行状态字 “Viewing as …”。原型 v15：`.codex-runtime/design/casefile-v15/`；288 个透射实例 + GTAO 在 1440 与 390@3x 仍 60fps；五宽度 HUD 检查全过 | 2026-09-28 |
| G26 | v15 质感确认，作为第 2 步的设计来源。“token” 字样可以用（带一点 AI/AIGC 感）；V7 只禁 JWT 片段和 `.read` 式 claim | 2026-09-28 |

---

## 14. 第 2 步追加的设计要求（用户 2026-09-28 反馈 → 我的设计决定）

| # | 反馈 | 设计决定 |
|---|---|---|
| D1 | 电路纹和光不要局限在硬盘中间；读取时的 motion 要更有创意 | 纹路铺满正面并**绕过圆角翻上顶边**（长焦镜头恰好能看到顶边，全景里就有纹路光）。读取动画：光从顶边指示灯出发，沿纹路翻过圆角流向正面，汇聚到芯片轮廓 → 芯片亮起 → 沿一条细接缝，硬盘上下两半错开几毫米、内部光透出 → 项目页从缝里“流出”。关闭时倒放 |
| D2 | UI 线条和动画要 Rhine 级高级 | 实现前先拆 Rhine 的 `ui-transitions.ts` / `hud-projection.ts` / `document-decryption.*`：线条描绘入场（stroke 生长）、数字滚动、从选中硬盘到面板的**投影引线**（3D 点投到屏幕，一根细线连到面板），统一缓动与时长表 |
| D3 | 经历、技能找不到，分不清哪个是 project | 硬盘只有两类：**CASE FILE**（项目）和 **SERVICE RECORD**（经历），都能打开。技能不再单独占硬盘，改为出现在经历/项目页和主档案的能力矩阵里。两类硬盘外形区分：经历盘的顶边是**双灯**，面板顶部标 `SERVICE RECORD` / `CASE FILE`；Index 按“Subject / Service records / Case files”分组 |
| D4 | 主档案几乎是空的 | 主档案首屏一眼看到：姓名 + 定位一句、五个方向各一行“能做什么 + 证据”、6 个关键数字（50+ 评估 · 20+ 供应商 · 60+ MCP servers · 14 findings · 1,000+ 培训 · ~30% AWS 成本）、经历时间线（Coast Capital → VibesMeet → BCIT → VIVA）、教育、证书、联系方式。下方是能力矩阵（按五方向分组、每项链到证据硬盘） |
| D5 | 其他档案内容太少 | 每个案卷：一句结果、我的角色、3 个事实、演示、“怎么做的”三段、证据、年份与时代背景；每个经历：职责、3 条要点（来自事实库）、用到的技能、关联案卷 |
| D6 | 打开后的页面像 PPT | 参考 Rhine 的档案页（`.codex-runtime/design/spec-shots/rhine-detail-1440.png`）：**硬盘本身是主角**。打开时硬盘转向镜头，演示用 Rhine `hudQuadMatrix` 式四角透视投影到硬盘正面，风格改为浅色、与磨砂同质感（不再是黑屏）；右栏是元信息（标题、事实格、Overview / Evidence / Log、摘要、操作）；3D 场景始终在后面。向下滚动进入章节正文（GSAP ScrollTrigger）。文字解密用 Rhine 式逐行遮挡条收回，标题短暂密文跳动（GSAP ScrambleText） |
| D8 | 用户：别闷头写，去找资源 | 采用 GSAP（2025-04 起全部插件免费可商用：SplitText / ScrambleText / DrawSVG / ScrollTrigger）做 UI 线条、文字、滚动编排；电路光的辉光在第 3 步用选择性 bloom（three.js emissive bloom 示例 / pmndrs postprocessing） |
| D7 | 其他细节交给我判断 | 第 3 步前做一次 usability / 动画 / 视觉审计，结论列清单再改 |

## 15. 第 2 步完成记录（2026-09-28）

- 实现：`src/casefile/`（data · motion · model · scene · ui · styles）；路由 `/`、`/projects/:slug`（URL 为唯一依据，reconcile 在过渡结束后执行开关），`/portfolio` → `/`；v2 页面与组件已移除，`api/`、`src/server/`、`redteamClient` 保留。
- 资源：GSAP 3.15（ScrambleText）；Rhine 的 `hudQuadMatrix`（演示投影到硬盘正面）与逐行遮挡解密；自托管拉丁字体。
- 分包：首屏 91.9 KB gz · three 场景 151.3 KB gz · 档案页 44.8 KB gz（预算 120 / 200）。
- 验证：verify 通过（53 单测，含数字→出处对照 V7）；Playwright 17 通过 / 1 跳过（键盘流程仅桌面）；1440 与 390@3x 空闲/导航 60.0 fps，p95 16.7–16.8 ms（RTX 3070）；无 WebGL、reduced-motion、深链接、前进后退、相关档案跳转、焦点陷阱均有用例。
- 独立审查（reviewer 子代理）9 条已全部处理；未改动的：BCIT 事实库自相矛盾（fact 601 写 phishing simulations，claim_limit 774 仍写 tabletop），网站按 fact 601 的更正说明用 simulations，事实库需用户自己修正。
- 留给第 3 步：演示动画细节（PwnScan 排序翻转用 GSAP Flip、电路光选择性 bloom）、手机端打开档案时显示硬盘、Rhine 式 HUD 曲面投影、全状态 × 全宽度审计清单。

## 16. 第 3 步打磨记录（2026-09-28）

| # | 用户反馈 | 处理 |
|---|---|---|
| P1 | 开场解密坏了：黑块盖满、缺少 Rhine 的线性感 | 重写 `Gate.tsx`（GSAP timeline）：借 Rhine 开场片的语言，不照搬——细小打字状态字 → YW 字标一笔画出、末端接一条电路走线 + 过孔（与硬盘纹路同源）→ 浏览器侦察结果逐行替换 → 细圆环 + 轨道节点（DrawSVG / MotionPath）“KEY ISSUED · ANY ROLE” → 高亮条擦出 ENCRYPTED ARCHIVE。首访时场景在标题静帧才开始构建（`compileAsync`），不再卡 3.5 s；任意键跳过 |
| P2 | 关闭、销毁、硬盘回位动画有问题 | 关闭 = 打开倒放：文字遮挡条盖回 → 演示收回 → 光从纹路退回指示灯 → 硬盘悬停中转回原朝向（`face` 弹簧，与抬升分离）→ 落回槽位。销毁：红色扫描线每轮扫过右栏并改写文字（标签保留）+ 硬盘同步红闪，三轮后 “key zeroized”，右栏从中线折叠，硬盘带红灯落回 |
| P3 | 主档案只是数字堆砌；经历盘质量低于项目盘 | 主档案盘演示改为五轨时间线（2021→2026 从网络一路爬升到 AI/风险），右栏 Story / How I work / Where I fit / Contact，关键数字各带一句含义；四个经历盘各有工作方法演示（Coast Capital 供应商评估流、VibesMeet PR 安全门 + AWS、BCIT 意识/政策/响应三幕、VIVA 服务地图），机构内部数据一律标 sample |
| P4 | 空槽太多、整列空；切换要逐个打开；看不出每列代表什么方向 | 6 条抽屉 = Subject + 五个方向，按中心向外自动排布，无整列空；↑↓ 跳到本列下一条记录，←→ 落到下一列最近的记录；悬停即显示编号 + 标题；面板显示 “Drawer NN / 06 · 方向名” 与抽屉切换；技能/证书盘直接跳到证据档案 |

自查另外修复：手机端档案右栏沿用桌面 `left: 60%` 被挤出屏幕（E2E 新增“文字栏在视口内”检查，已做反证：回退修复后该检查失败）；手机底部 ‹ › 去掉边框；引线在硬盘贴近相机时投影为 −Infinity 导致控制台报错（加有限值判断）。

验证：verify 通过（tsc · eslint · 53 单测 · build · smoke）；Playwright 桌面 + 手机全套通过；1440 与 390@3x 60 fps；首屏 89.9 KB gz、three 场景 152.1 KB gz。

未做（可选）：电路光选择性 bloom、PwnScan 排序翻转改用 GSAP Flip、Rhine 式 HUD 曲面投影——当前效果已可用，是否继续由用户定。

## 17. 第 4 轮打磨 spec（2026-09-29，grill 第 5 轮：Q28–Q35 全按推荐；简历暂不上传）

### 17.1 目标
1. **Intro 恢复“反向侦察 → 攻击画像”概念**，并保留 Rhine 的线性语言。
2. **动画打磨**：打开不穿模、打开有冲击力、关闭 ≤ 1.1 s、销毁横幅看得清、黑盘界面可读，并自查其余动画。
3. 落实 Q28–Q35 与自查第 5–11 项。
4. 列出能明显提升“网络安全水平观感”的改进，作为提案给用户决定（本轮不擅自做）。

### 17.2 非目标
档案内部文案与演示内容不改；不上传简历；不改 3D 硬盘材质和整体配色（已确认）。

### 17.3 Intro：Reverse recon（约 9 s，任意键跳过；回访不播）
| 幕 | 时间 | 画面 |
|---|---|---|
| 1 读取 | 0–0.6 s | 左上角打字 “READING YOUR BROWSER”，一条细横线从左到右画过全屏（Rhine 线性） |
| 2 侦察 | 0.6–4.4 s | 左侧**大字**（clamp 26–52px）逐行出现访客事实，粗体值由十六进制密文跳成明文；每行出现时，一条带 45° 折角的细线（和硬盘电路纹同一种走线）连到右侧逐步搭起的 **TARGET PROFILE · V-xxxx** 卡片：线框四角描线出现，字段依次填入，底部是由访客哈希生成的**指纹环**（DrawSVG 描出） |
| 3 转折 | 4.4–6.6 s | 事实淡到 25%；大字：“Collected in N ms. Without asking.” → “Put together, that is an attack profile.” 画像卡上三个字段各拉出红色批注：Device → *match a known exploit*；Local time → *time the phishing email*；Language → *write the lure in your language* |
| 4 防守方 | 6.6–8.2 s | 大字：“I look at systems the way an attacker would. Then I close the gaps.” 画像字段全部跳回密文，卡片收成一块硬盘轮廓，注明 “Sealed · never left your browser · filed as V-xxxx”；YW 字标一笔画出，接名字 |
| 5 进入 | 8.2–9.2 s | 高亮条擦出 ENCRYPTED ARCHIVE → 淡入场景 |
- 所有数字都来自真实测量（`visitor.ms`），不虚构“1/N 唯一”之类的统计。
- 手机端：事实 20–26px（clamp，随屏宽）纵向排，画像卡在下方精简显示，批注跟在字段后。reduced-motion：直接显示最终画面 + Continue。

### 17.4 动画
| # | 问题 | 原因（已查证） | 改法 |
|---|---|---|---|
| M1 | 打开穿模 | `beginOpen()` 立刻把 `faceTarget` 设为 1，硬盘还在槽里就开始转（转 48°，宽 5 的硬盘在 z 方向扫过 ±3 排） | 转向由抬升高度控制：抬过邻盘顶部才开始转；抬升目标提高；关闭时先转回、在高处转完才下落。E2E 每帧记录硬盘底部与邻盘顶部的最小间隙，必须 > 0 |
| M2 | 打开没冲击力 | 读取光是白色自发光打在奶白硬盘上，看不见；中间有 1.5 s 的独立“校验”空等；总时长约 5 s | 新节奏约 2.4 s：指示灯双闪（读请求）→ 硬盘快速弹出 → 周围场景压暗、雾拉近（聚焦）→ 转向 + 推镜 → 电路光带着辉光（仅读取时开启 bloom）沿纹路跑满正面，完整性哈希同步滚动（与光同时，不再空等）→ 芯片闪 → 演示沿扫描线从正面投出 → 场景亮度恢复、文字逐行解密 |
| M3 | 关闭太长 | 转回用慢速率等到 face < 0.03，再慢速下落 | 目标 ≤ 1.1 s：遮挡 0.25 s → 演示收回 0.2 s → 光退 0.3 s → 快速转回，转过大半即开始下落 → 落地轻微回弹 + 指示灯一闪 |
| M4 | 销毁横幅看不清 | 状态是 12px 小字，每轮 0.62 s | 栏顶红色大号状态块：“CRYPTO-SHRED · X-003”、三段进度条、“PASS 2 OF 3 — OVERWRITE 0xFF”；每轮约 1.0 s；最后 “KEY ZEROIZED — FILE UNRECOVERABLE” 与全零密钥停 1.4 s，再折叠 |
| M5 | 黑盘界面看不清 | 演示面板是半透明灰，读取点亮的白色电路光穿透面板压在字上，接缝线横穿面板 | 黑盘演示用深色玻璃 + 浅色字（终端风，红色 ARMED 强调）；演示投出后，所有硬盘正面电路光降到低亮度，接缝熄灭；白盘面板提高不透明度 |
| M6 | 其余动画自查 | — | 录全流程逐帧检查：选中、Hiring for 翻转、换抽屉、Index 跳转、intro → 场景交接、悬停标签；发现的问题列入 §18 |

### 17.5 Q28–Q35 与自查第 5–11 项
- Q28 进站默认选中 YW-000；Q31 X-000 移到 AI 列末端；Q29 右上角 Contact（Email / LinkedIn / GitHub，无简历）；Q30 token risk 悬停解释；Q32 首访提示里加 “Take the tour”（YW-000 → SR-01 → X-001 → X-000 → Contact，只选中不打开，每站一句说明，任意操作终止）；Q33 Playwright WebKit 测试 + 用户 iPhone 真机；Q34 1200×630 PNG 分享图、绝对 URL；Q35 删除 `home-wireframe.html`、`case-study-wireframe.html`、未引用的 `locales/`、旧 `resume.pdf`（git 历史可找回）。
- 右侧面板加柔雾背景（不加框）；抽屉号只保留一处；左上阵列边缘补齐；Index 打开时隐藏选中面板、状态列改为与 Hiring for 的相关性、加滚动渐隐；首访提示只在首访显示，第一次操作后淡出；手机角色栏右侧渐隐；文字用橄榄色改为 `--acc-text #5c6b12`（4.65:1），线和灯仍用 `--acc`；焦点框检查。

### 17.6 假设清单
| # | 假设 | 状态 |
|---|---|---|
| A1 | 读取时开启 UnrealBloomPass，1440 与 390@3x 仍 60 fps | 未验证 → 先做 spike |
| A2 | 按抬升高度控制转向即可消除穿模 | 未验证 → 用每帧间隙检查证明 |
| A3 | Playwright WebKit 能在这台 Windows 上跑 WebGL | 未验证 → 下载后 spike |
| A4 | 正式域名 `personal-profile-alpha-cyan.vercel.app` | 已验证（sitemap、index.html） |
| A5 | `public/locales/` 无引用 | 已验证（grep src / scripts / index.html 无结果） |
| A6 | 访客事实只在本地计算、不外发 | 已验证（`visitor.ts` 无网络调用） |

### 17.7 验收
verify 通过；Playwright 桌面 + 手机全绿，新增：打开/关闭过程最小间隙 > 0、关闭耗时 ≤ 1.1 s、销毁各阶段文字可见时长 ≥ 0.9 s、intro 大字事实与攻击画像批注存在；1440 与 390@3x ≥ 58 fps；WebKit 冒烟通过；逐帧录屏（intro、打开、关闭、销毁、黑盘）发给用户；reviewer 子代理按本节复审。

## 18. 第 4 轮完成记录（2026-09-29）

### 18.1 实现
| 项 | 结果 |
|---|---|
| Intro | `Gate.tsx` + `gate.css` 重写为 Reverse recon：大字事实 → 45° 走线连到 TARGET PROFILE 卡（指纹环由访客哈希生成）→ “Collected in N ms. Without asking.” / “attack profile” + 三条红色批注 → 防守方一句 + 画像封存为十六进制密文 + 字标签名 → 标题。约 12 s，任意普通键 / 点击 / Skip 跳过（修饰键不触发），reduced-motion 为静态页 + Continue |
| 打开 | 指示灯双闪 → 快速弹出（`RATES.eject`）→ 转向受真实间隙控制 → 场景压暗 + bloom（仅读取时开启）→ 电路光跑满正面，SHA-256 同步滚动 → 扫描线投出演示 → 电路光降到 0.28 |
| 关闭 | 遮挡与光退并行 → 高处转回 → 下落（`RATES.land` 9）→ 指示灯一闪；落定 ≤ 1.15 s（E2E 实测到 `settled()`） |
| 销毁 | 栏顶红色状态块 + 三段进度，每步 ≥ 1.0 s，“Key zeroized — file unrecoverable” 停 1.5 s |
| 黑盘 | 演示改深色终端主题（作用域内重定义颜色变量），读取后电路光降低、接缝熄灭 |
| HUD | 默认选中 YW-000；X-000 排到 AI 列末端；右上角 Contact；token risk 悬停说明；抽屉号只留左下一处（加“第 N / M 条”）；Index 打开时让出面板、显示与 Hiring for 的相关性、底部渐隐；首访提示含 38 秒导览（文案取自档案摘要）；面板与左下导航加柔雾背景；橄榄色文字改 `--acc-text`（4.65:1） |
| 场景 | 渲染 8 列 × 44 行，边缘绕回副本画成普通密封盘（每条记录只出现一次），补齐左上空角 |
| 启动性能 | 进入场景的等待从 17.8 s 降到约 13.7 s（其中影片约 12 s）；首帧从 2.3 s 降到 43 ms。根因三个：① composer 渲染到 render target，three 用的是线性 / 无色调映射变体，`compileAsync` 默认编的是屏幕变体；② three r183 在第一次渲染阴影时把 PCFSoftShadowMap 改写成 PCF，所有受光程序的 key 随之变化；③ 阴影、GTAO、后处理的材质不在场景里。`stage.prepare()` 用代理网格在所有上下文里异步预编译；生产环境关闭 `checkShaderErrors`。剩下的同步初始化约 1 s，安排在 intro 批注停留那段静止画面里 |
| 分享 | 1200×630 PNG（真实场景）+ 绝对 URL、`og:url`、`twitter:image`；删除两个 wireframe、未引用的 `locales/`、旧 `resume.pdf`、`og-card.svg` |

### 18.2 验证（证据见最终回复）
- verify 全绿；Playwright 桌面 + 手机 + 新增 `webkit-smoke`。
- 新测试：打开 / 关闭的真实包围盒间隙 > 0 且为有限值、没有等待超时；关闭到落定 < 1150 ms；销毁各步 ≥ 900 ms；intro 大字（桌面 ≥ 24px，手机 ≥ 20px）、4 行事实、ATTACK PROFILE 与 3 条批注；首访导览与 Contact。
- 1440 与 390@3x 开启 bloom 时 59.6–60.4 fps；WebKit（Windows 版，无 GPU）能渲染，但不代表真实 Safari 性能，需用户在 iPhone 真机检查。

### 18.3 独立审查（reviewer）10 条，全部处理
间隙检查原先不可能失败，改为真实包围盒 + 有限值断言；关闭计时改为测到落定，并记录超时；删除打开途中的强制导航（会覆盖用户后退）；`ready` 失败时退回可读索引，Gate 另设 12 s 兜底；深链接延迟期间选区被改时，会纠正为要打开的那张盘；被选中的格子永远不会被当成副本；导览文案和时长改由数据计算；导览打开的 Contact 在导览结束时关闭，焦点回到 Contact 按钮；Skip 逻辑移入按钮本身，忽略修饰键，打开时自动聚焦；手机字号断言与 spec 对齐。

## 19. 网站自身的安全配置（2026-09-29，用户批准提案 1–3）
- **安全响应头**：唯一来源是 `vercel.json`，`vite.config.ts` 的 preview 读取同一份，所以本地和 E2E 都在真实 CSP 下运行。CSP 为 `default-src 'self'; script-src 'self'; style-src 'self'`（没有 `'unsafe-inline'`：`index.html` 的内联样式已移到 `public/prerender.css`）、`img-src 'self' data: blob:`、`connect-src 'self'`、`object-src 'none'`、`base-uri 'none'`、`frame-ancestors 'none'`、`upgrade-insecure-requests`；另有 HSTS（2 年，含 includeSubDomains 和 preload）、nosniff、`X-Frame-Options: DENY`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`（关闭摄像头、麦克风、定位等）、COOP / CORP same-origin；`/api` 设 `no-store`。E2E 全流程加上 SENTINEL 对话，零 CSP 违规。
- **`/.well-known/security.txt`**（RFC 9116）：Contact、Expires 2027-09-29、Preferred-Languages、Canonical。
- **页脚实时统计**：第三方请求数和 Cookie 数在页面里实时计算（Resource Timing + `document.cookie`），旁边的 “headers ↗” 链接到 Mozilla Observatory 对本站的扫描。键盘提示挪到左下角；HUD 重叠测试加入 `.hud-hint`。
- **本地 `/api`**：preview 代理到线上（环境变量 `API_ORIGIN` 可覆盖），本地也能直接试 SENTINEL；DeepSeek 密钥只在 Vercel 的环境变量里。
