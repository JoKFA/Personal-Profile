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
| A4 | 正式域名 `yaotingw.com`（2026-10-06 起；之前写的是 `personal-profile-alpha-cyan.vercel.app`，那只是 Vercel 的别名） | 已验证（`curl -sI https://yaotingw.com/` 200，`Server: Vercel`；sitemap、index.html 由 `scripts/site-routes.mjs` 生成） |
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

## 20. 全站收尾（2026-09-29，SENTINEL 暂缓）
逐项检查全站界面：无 WebGL 回退、无 JS 的预渲染页、减少动画模式、未知路由、手机端 Index 和 Contact、900 / 1100 宽、低画质档、访客档案、主档案、悬停标签。修复如下：
- **预渲染页没被用上**：`/projects/<slug>` 不带斜杠时拿到的是首页的 app shell，爬虫和链接预览读到的是错的标题。现在预渲染输出 `projects/<slug>.html`，`vercel.json` 开启 `cleanUrls`。smoke 新增检查：每个路由返回的页面标题必须是它自己的（先在修复前确认这条检查会失败，修复后通过）。
- **减少动画模式的 intro**：防守方那句叠在事实上。改为一张静态页：左侧是转折句和防守方那句，右侧是攻击画像卡加批注和指纹。封存行在出现前不再占位。
- **回访的空白**：HUD 比场景早约 2 秒出现在空白背景上。现在 HUD 与场景一起在首帧后出现，加载期间居中显示 “Decrypting the archive”；深链接要等场景就绪才开始打开；任意角色视角下面板文案改为 “Decrypting…”。
- 访客档案的标签从 “Case file” 更正为 “Visitor file”；底部加一道渐变雾（≥900 宽），让角色栏和页脚的小字不再压在绿灯上。
- 验证：verify 通过；E2E 24 条通过、1 条跳过（桌面 + 手机 + WebKit，在真实 CSP 下）。

## 21. 主档案 YW-000 打磨（2026-09-29）
- **资料来源**：简历系统的 `experience_db.yaml`（事实与措辞边界）、`golden_bullet_bank.md`、Obsidian `能力画像.md`（可入职时间：2027-02 之后；目标方向）、`career-system/OBJECTIVE.md`。工作许可、语言按用户要求不放。
- **定位与状态**：kicker 为 “Security analyst & engineer · risk, cloud and AI security”；事实栏为 Available（Full-time from Feb 2027）、Looking for（Security analyst · GRC · cloud and AI security）、Now、Based（Vancouver · open to relocating in Canada）。
- **关键数字**：换成三个来自实际工作的结果，每个证明一个不同方向：50+ 次安全风险评估（Coast Capital，另有 20+ 次第三方审查）· ~15% 钓鱼成功率下降（BCIT）· ~30% AWS 月成本下降（VibesMeet，同时清理多余 IAM 权限）。去掉了 60+ MCP servers 和 1,000+ 人。
- **硬盘演示**：折线时间线换成 **Defence in depth** 同心环：8 层（风险治理、人、第三方、网络、云与身份、交付流水线、应用、AI agent）围绕 DATA，从外向内扫一遍并点亮；每层对应右侧一行实证与来源档案，引线在该行的高度离开圆环；扫完后停在完成态，悬停可以重读某一层。数据在 `story.ts` 的 `DEPTH`。
- **Story**：各章按真实发生的事重写（不照搬简历 bullet），每章只显示 2–3 条重点，其余用 “+N more” 展开；每条步骤显示档案短名（如 “Campus network”），不再只有编号。
- **Where I fit / 各处证据链接**：显示短名（`shortName()`），编号放在悬停提示里。手机上标签栏不换行、可以横向滑动，切换后自动滚到内容。
- **校验**：`numbers.test.ts` 之前没有扫描 `story.ts`，现在纳入 HEADLINE、CHAPTERS、PRINCIPLES、KEY_NUMBERS、DEPTH，所有数字都有出处。verify 通过，E2E 24 条通过、1 条跳过。

## 22. 网站名称、学历档案（2026-09-29）
- **名称**：网站改名为 **Security Portfolio**（不再叫 Encrypted Archive）。左上角三行为 YAOTING WANG / ANALYST & ENGINEER · VANCOUVER, BC / SECURITY **PORTFOLIO**；intro 标题、加载提示、SEO 标题、分享图同步更新；档案页返回按钮改为 “All files”。主档案 kicker 与 Looking for 改为首字母大写（Security Analyst & Engineer · Risk, Cloud & AI Security）。
- **更正**：SFU 的学位正式名称是 **Master of Cybersecurity**（成绩单与 SFU Graduate Calendar 一致），不是 MASc；全站已更正。⚠️ 简历系统（能力画像、main.tex 等）也写成了 MASc，需要用户同步修改；SENTINEL 后端的系统提示同样如此，按用户要求暂不动。
- **学历档案**：ED-01..03 从 “只会跳回主档案的小 credential 盘” 升级为新的 `education` 类型：有独立路由和预渲染页（sitemap 共 18 个路由）、三个标签页（What it trains / Courses / Access log）；硬盘上的新演示 “transcript → evidence” 把课程逐行打出，每门课连到它产出的档案或训练的能力。主档案 Where I fit 的学历行可以点击进入。数据在 `data/education.ts`，来源：SFU 成绩单（只列课程，不放成绩）、SFU Graduate Calendar（CMPT 782/783 描述）、BCIT 两个项目的官方页面。
- **待用户确认**（未确认的一律没写成事实）：
  1. X-003 Internal Penetration Test 是否来自 CMPT 782 Cybersecurity Lab I？
  2. X-001 MCP Security Framework、X-002 EDR Triage、X-006 Splunk Lab 分别在哪段学历期间、是否属于某门课？
  3. X-008 四站点网络是否是 CISA 文凭的 capstone？（现在写的是 “Project”，时间 2022 落在文凭期间）
  4. BTech 选了哪些专业课（例如 Incident Response、Cloud Forensics、Network Exploits and Vulnerabilities）；有没有 capstone 或获奖？
  5. CMPT 789 Applied Cryptography 有没有值得展示的作业或项目？
  6. 文凭期间是否有 co-op 或其他值得写的项目？
  7. 是否展示 GPA？建议不展示。

## 23. 学历档案重做：盘面上的标本（2026-09-29，用户：“设计平庸，不要偷懒”）

### 23.1 用户确认的事实
- X-003 渗透测试、X-001 MCP 扫描器来自 “CMPT 781”。⚠️ 成绩单上没有 781，只有 CMPT 782 Cybersecurity Lab I（2025 年秋季，官方描述为训练渗透测试），因此按 782 处理，仍需用户确认。
- X-006 Splunk Lab 是自学项目，不属于任何课程。
- X-008 四站点网络是 CISA 文凭的毕业项目；这份档案要重写并重新设计（放在项目档案轮次）。
- BTech 的毕业项目就是 X-002 EDR AI。论文题目 “Improving Endpoint Security: Automation and Usability Through AI Integration”，课程 FSCT 8611 Graduation Project。系统名为 SecureInsight（Wazuh + DeepSeek + SQLite 缓存 + React UI）。论文 Table 3 的数据：冗余率 65% → 12%，每小时处理的高 / 中危告警 120 → 240，每小时处理的告警总数 15 → 150。
- CMPT 789 Applied Cryptography 的项目是 CryptoLab SecurePWMSystem（github.com/JoKFA/CryptoLab-SecurePWMSystem）：纯客户端密码库，scrypt、AES-256-GCM 加关联数据、HMAC 链式审计日志、Shamir k-of-n 恢复份额、HKDF。
- 文凭期间没有 co-op。BCIT Cyber Security Office 和 VibesMeet 两段实习都在 BTech 期间。不展示 GPA。

### 23.2 设计方向（用户否决了“立体标本”方案；要学的是 Rhine 的焦点与虚化，并且不大改已确认的设计）
参考：rhine.lubeiluchen.cc 的实机截图、《明日方舟》UI/UX 分析（gameinstitute.qq.com/article/10027：背景虚化突出前景、前景边缘失焦做纵深、晕影聚焦中心、层级对比度）、Dribbble 上 Poulsën 的 Rhine Lab 海报（焦点人物锐利、背景去饱和并虚化、四周压暗）。
- **全站景深**：场景加入 BokehPass。对焦距离取相机到选中硬盘中心的距离；光圈随推镜程度加深：档案墙上是浅的对焦带，打开档案时背景明显失焦。实现中发现对焦的盘本身也糊，原因是近 / 远裁剪面 5 / 400 让半精度深度只有约 2 个单位的分辨率；收紧到 40 / 220 后约为 0.2 个单位，被选中的盘清晰锐利。另加一层很淡的暖色晕影（`.cf::after`）。低画质档关闭景深。
- **学历盘面：目录卡 + 拉焦**：一次只把一门课拉进焦点：大号细体课程编号（逐位滚动，参考 Rhine 的滚动时钟）、课程名、一段金色细线、它训练了什么或产出了什么，以及链接到的档案；右侧成绩单列表保持可读，但除当前课外都虚化、变淡；底部是 Rhine 式刻度指示条和计数；悬停某门课即对焦到它。
- 学历档案的右栏结构不变。

### 23.3 验收
verify 与 E2E 全绿；1440 与 390@3x ≥ 57 fps；截图确认选中的盘和打开的档案清晰锐利、背景失焦。

## 24. 第五轮：盘面演示重做 + 场景质感改造（2026-09-29 – 30）

### 24.1 已上线的盘面（用户已认可概念）
- X-008 "Blast Radius"：扁平 / 分段两种模式切换，计数是图中主机数（按 BFS 统计），删掉了编造的数字。档案文案按实际经历重写成三段。
- ED-03 "Bottom-Up"：一张样本工单沿课程组成的层塔逐层排查。AD 那层改为 "Active Directory · cloud IAM"，Linux 那层改为 "Linux & Windows Server"（用户确认）。
- ED-02 "The Case"：一个样本案件，从告警走到法庭。证据保管链常驻屏幕，每一步标出教这一步的课程；可以点"跳过一步"，看到同一份证据被排除。
- X-002 标题改为 "SecureInsight · EDR + AI"。

### 24.2 用户确认的课程事实（2026-09-30）
- **Lab I (CMPT 782)**：
  - 深度渗透实验，难度接近 OSCP：nmap、Burp、提权、各类脚本、OWASP Top 10、URL 攻击、XSS、AD 攻击、Metasploit；
  - 系统与云，包括 IAM、IaC、CI/CD 的管理与防御；
  - 攻击和渗透都尽可能结合 AI。
- **Lab II (CMPT 783)**：网络，以及汇编的原理、攻击与分析。
- **另外两门课**：密码学 (CMPT 789)、云与分布式系统 (CMPT 756)。
- 用户要求：不要被课程的划分所局限。

### 24.3 设计原则（用户的否决与认可总结）
- **形式本身必须是一个真实的安全机制。** 不要用比喻物，例如层板、硬币。
- **普通人能看懂，同时要高级。**
- **最终画面常驻**，不做轮播。
- **不要把硬盘这半边当成平面海报。** 硬盘和档案场本身就是 3D 媒介。

### 24.4 场景质感改造（进行中）
- 硬盘造型：圆角半径 R 0.17 → 0.045，厚度 T 0.38 → 0.46。
- 材质：透射 0.6 → 0.12，底色偏暖 #f8f1e7。
- 主光移到场景上方偏后，让朝向镜头的面处在阴影里，形成三种明度的面。
- 打开档案时补一盏"阅读灯"（fill 光的强度随 detail 升高）。
- 熄灭的 LED 槽和小凸片改为与机身同色。
- GTAO（环境光遮蔽）强度 0.6 → 0.85。

### 24.5 后续
1. 场景改造收尾：绿色 LED 只留给选中和相关的硬盘，精简 HUD，测帧率。
2. 主档案 "The Archive Is the Defence"：一条 ATT&CK 攻击链在档案场里穿行，每个阶段由对应经历的硬盘升起挡住。
3. SFU 新方案，待定。

### 24.6 Scene rebuild, as built (2026-09-30 – 10-01)
- **Model:** `art/build_drive.py` (Blender 5.2, headless) builds `public/assets/drive-module.glb`. It has a frosted shell, ivory end caps, a warm diffuser board, titanium fasteners, a champagne inlay, and a secure element with a guard ring, an anti-tamper mesh and engraving. `scene/model.ts` loads it. The field instances five groups; the selected drive carries every group.
- **Lighting after the Rhine PV (5–40 s):**
  - Key light behind the field.
  - A translucency term on the shell.
  - A low warm side light along the lanes.
  - The selection light: two thin RectAreaLight strips in the slots either side of the selected drive. It fades rather than slides, and it is off for the black drive.
  - ACES tone mapping and SMAA. No indicator LEDs.
- **Relevance shown by light (user's pick: A + D + E):**
  - Records glow from inside: diffuser, shell and slots, per instance via `aLamp`.
  - Empty drives sit in warm shade.
  - A lens adds a light sweep out from the selection; the drives that role picks glow fully and the other records go to shade.
  - All light values are eased per entry.
- **Layout:** each drawer's records form one contiguous run, and the drawers' centres step down the field on a diagonal (`entries.ts` `layout`). X-000 sits just beyond its drawer's run.
- **Entrance:** starts when the scene is first visible. The camera whips in from 26 rows away and decelerates over about 3 s while the view turns 17° back to the archive angle. Swells and ripples ease out with it. A screen-space motion-blur pass follows the camera. "Selecting files" types in, and the file panel waits until the camera settles (`cf--arriving`).
- **Focus:** a screen-space pass centred on the selected drive (eased). The home view stays sharp; an open file blurs its surroundings.
- **Open:** the shell clears ("decrypted"). The read flash is warm.
- **X-000:** slate dark register, matte, solid.
- **HUD:** the footer is trimmed to `risk · trackers · cookies · headers · ↺` at half opacity.
- **Demos built this round:** X-008 Blast Radius, ED-02 The Case, ED-03 Bottom-Up, ED-01 Quorum (interim), YW-000 Six Ways In (interim).

### 24.7 Next (a new session)
1. **YW-000 "The Archive Is the Defence"** (approved concept). When the subject file opens, the camera rises over the field. An ATT&CK attack path crosses it, and at each stage the drive of the real work that stopped it rises. The approved form is "light, not height", so revisit how the drives "rise". Its final frame stays on screen.
2. **ED-01 "Powers of Ten"** (approved in principle). One continuous zoom, from an instruction to a host, a domain, an app, a network, a pipeline and cloud, across zones, and out to a financial institution. Use the confirmed course facts in §24.2 without splitting them by course.
3. Interim demos to replace: `WaysIn.tsx` (YW-000) and `Quorum.tsx` (ED-01).
4. Later: the case-file polish round, X-SITE content (user to provide), SENTINEL labs (postponed), and a real iPhone check (user).

## 25. 第六轮：主档案 "The Archive Is the Defence" + 档案类型可辨（2026-10-01）

> **2026-10-02：主档案的短片部分（§25.3）已被 `docs/subject-space-spec.md`（进入硬盘的工作空间）取代**；旧短片代码（DefenceFilm、film.ts、defence.ts、survey 机位）已删除。§25.4 类型可辨与图例不变。

用户决定（2026-10-01）：三个问题全按推荐——"挡住"用光墙截断（盘不升高）；不加第 7 招；每个会话首次打开播完整片，之后直接显示终帧 + Replay。另提出：档案场里 skills / projects / experience / education 分不出来，全混在一起。

### 25.1 目标
- **A. 主档案短片**：打开 YW-000 时，镜头升到档案场上空；六次真实攻击依次射向一道由他真实工作组成的防线，每次撞上对应硬盘发出的光后熄灭。终帧常驻、可点。**任何人看一遍就懂："攻击来了，他做过的事把它挡住了。"**
- **B. 类型可辨**：在总览里不看字也能分出工作经历、项目、学历、技能；看字时用的是普通人的词。

### 25.2 非目标
- 不改抽屉 = 求职方向的结构（P4 的决定），不改 "Hiring for" 的逻辑。
- 不做 SFU "Powers of Ten"（下一步）。不改其他档案的打开方式。

### 25.3 A：短片设计（按实际实现）
**构图：六条缝、一道墙。** 档案场的抽屉之间有缝（lane 之间约 0.2 宽）。六块防守盘按"同类排在一起"的新布局落在不同的行：X-001 (1,10) · SR-02 (2,13) · X-003 (3,16) · SR-01 (4,18) · SR-03 (4,19) · X-008 (5,22)。每次攻击是一束红光，沿防守盘旁边的那条缝从上方射下来，停在那块盘前；六个停止点高低错落，连成一道墙。"Your data"（一块封存的空盘，橄榄色细框）在墙的后面。从上往下读：外面 → 墙 → 数据。
- 哪条缝归哪次攻击由 `motion/film.ts` `planDefence()` 从真实布局算出：每次攻击一条缝，尽量少经过其他防守盘；数据盘取墙后的空格。布局变了，片子跟着变。
- 原方案"红光沿缝隙折线走、盘升起"在 spike 中被替换：缝是档案场本身的结构，红光在缝里走正是 PV 里"光从缝里漏出来"的语言；盘不动，只用光（遵守"用光不用高度"）。

**易懂的三个支架（保留）：** 先亮出目标；前两招慢放（2.2 s）教会模式，后四招 1.3 s；每招一句人话。防守盘在攻击到达**之前**亮起（防御先在那里），红光撞在光上熄灭。

**攻击顺序（编号已在 attack.mitre.org 核对，2026-10-01）：**

| # | 攻击 | 阶段 · 编号 | 挡住它的盘 · 证据 |
|---|---|---|---|
| 1 | Phishing email | Get in · T1566 | SR-03 Awareness programme · ~15% fewer phishing successes |
| 2 | Broken access in a web app | Get in · T1190 | X-003 Pentest of the app · 14 validated findings |
| 3 | Risky vendor | Get in · T1199 Trusted Relationship | SR-01 Vendor risk reviews · 20+ vendor reviews |
| 4 | Poisoned AI tool | Get in · MITRE ATLAS | X-001 MCP security scanner · 60+ servers tested |
| 5 | Leaked cloud key | Steal keys · T1552 | SR-02 Secret checks in CI · Every merge scanned |
| 6 | One machine infects the rest | Spread · TA0008 | X-008 Network segmentation · A breach stays small |

**分镜（`motion/film.ts`，一个时钟驱动光和字）：**
| 镜头 | 时间 | 画面 |
|---|---|---|
| 升起 | 0–1.8 s | YW-000 的 LED 闪两下，盘不弹出。镜头从档案视角（yaw 59° / 俯 19°）摇臂升到 yaw 8° / 俯 62°（手机 70°），缝在屏幕上竖直排开；场面压平（波浪归零），绘制窗口扩大到 12×64，远处看不见的螺丝和镶条不画；其他记录只留微光。标题 "Six ways attackers get into a company." |
| 目标 | 1.8–2.4 s | "Your data" 的橄榄色细框和字亮起。 |
| 第 1–6 招 | 2.6 s 起，2.2 / 2.2 / 1.3 ×4 s | 攻击名出现在缝的上端（小字 "Get in · T1566"）→ 红光加速射下（白热的头 + 发光的尾，超过 1 的亮度会泛光）→ 到达前防守盘亮起、缝里立起一片暖光帘 → 撞击闪光，红光熄灭，留下一条暗红细线（正常混合，在象牙底上看得见）→ "Stopped by …" 写出。计数 "n / 6 stopped"。 |
| 终帧 | 约 12.5 s 起常驻 | 标题换成 "Six ways in. / **Each one stopped by work I did.**"；"Your data · untouched"。悬停任一 "Stopped by" → 这一招的线、光帘、盘、字变亮，其余五招退后；点击 → 打开该档案。Replay；播放时可 "Skip to the end"。 |

**实现：** `scene/defence.ts`（红光、光帘、闪光、数据框，都在主场景里）· `archive.ts` 的 survey（摇臂、跟踪、窗口、按片子时钟给每块盘打光）· `ui/DefenceFilm.tsx`（每帧把字投影到档案上）。首次播放记在 `sessionStorage` `yw.film`，之后直接终帧；reduced-motion 直接终帧。
**手机：** 片子是档案页的第一屏（档案场透出来）；六个红色编号标在每条缝的起点，下面一个编号列表随片子逐条勾上 "Stopped by …"；往下滚时钉在档案上的标记淡出，正文有自己的底色。

### 25.4 B：类型可辨（按实际实现）
1. **形状**：技能和证书是半长的"短钥匙"（实例 x 缩放 0.5；选中时 hero 也缩，印字预先拉宽两倍以抵消）。总览里 22 枚短钥匙退后，16 份完整档案站在前面。
2. **端头**：工作经历 = **墨色**端头与顶边；学历 = 香槟色端头；项目 = 象牙（不变）。spike 中先试了香槟色给工作经历，结果和"有记录的盘发暖光"混在一起看不出来，改成墨色。
3. **普通人的词**：`KIND_NAME` 一处定义：Experience / Project / Education / Skill / Certifications / Profile；面板、档案页、盘上印字、Index、无 WebGL 页统一。第一个抽屉改名 "Profile & Education"。
4. **图例兼筛选**：左下角（地图放图例的位置），与右下页脚同一条基线，半透明：`▬ Experience 4 · ▬ Projects 9 · ▬ Education 3 · ▪ Skills 22`，小图形与盘形一致；悬停/聚焦只亮这一类（与 Hiring for 叠加取交集），点击固定。手机放在角色栏下面一行。计数随 lens 变化。
5. **抽屉内顺序**：工作经历 → 项目 → 学历 → 证书 → 技能，连续排列。
6. 俯视（片子）时形状和端头渐隐成统一的盘，片子只讲墙。
7. 顺手修复：指针在 HUD 按钮上时不再悬停到下面的盘。

### 25.5 假设台账
| # | 假设 | 状态 |
|---|---|---|
| H1 | 俯视取景能在 1440×900 左侧约 58% 内框住六条缝、墙和数据盘，字不互相压 | ✅ spike 截图；E2E 检查六个 "Stopped by" 两两不重叠且都在正文栏左边 |
| H2 | 俯视时绘制窗口覆盖画面不露边 | ✅ 窗口在 survey 时扩到 12×64（平时 8×44 不变） |
| H3 | 片子中 ≥ 57 fps | 本机 Edge 截图时测得终帧 100–144 fps；E2E fps 测试加了"片子播放中"和"终帧"两项（1440 与 390@3x） |
| H4 | 六条事实已确认 | ✅ 沿用已上线 WAYS_IN 的事实，证据句缩短但不加新事实；numbers 测试覆盖 |
| H5 | ATT&CK 编号 | ✅ attack.mitre.org 核对 T1566 / T1190 / T1199 / T1552 / TA0008；AI 工具只标 "ATLAS" 不写编号 |
| H6 | 实例矩阵 x 缩放、端头按实例着色 | ✅ `stage.set(..., form)` |
| H7 | 选中的技能盘也是半长 | ✅ `heroGroup.scale.x` + 印字预拉宽 |

### 25.6 验收
- verify 全绿；本阶段末跑一次 E2E（新增：片子跑完 6/6、六个停止标签不重叠且在正文栏左边、点击打开对应档案、同一会话第二次打开直接终帧；图例悬停只亮一类；HUD 不重叠检查包含图例；fps 包含片子）。
- 证据：Edge 录制的完整视频（桌面 + 手机）、终帧截图、总览截图、fps。
- reviewer 子代理按本节独立审查。

## 26. 第七轮：首访即一部片子——身份 → 入场 → 主档案 → 授权（2026-10-01）

### 26.1 用户决定（2026-10-01）
- 第六轮短片的概念保留，细节不满意：气泡字、笔直向下的红光"没有设计感"；数字在短片、右栏、项目档案三处重复，"显得蠢、小气"。短片的任务是让人一看就知道做的是有质量、有水平的工作，并引导访客去探索整个网站，不重复事实数据。
- 入场：没有真正理解 PV。PV 的入场只有约 2 秒，核心是**一道浪潮带出所有档案，然后收敛、聚焦到最需要看的那一份**；波和运镜是联动的。我做的是与镜头无关的"无意义波动"。
- 首访顺序：入场 → 主档案第一次自动升起、解密 → 主档案短片 → 交给访客探索（先自动展示，再探索）。
- **"Hiring for" 整个去掉**（抽屉本身就是方向）。首访的角色提示和导览一并去掉。
- **IAM 放进主档案的展示**：要清晰易懂。
- 高度可以用在运动中（浪、收敛），静止时归平，相关性仍用光。
- 反向侦察由我设计，唯一要求：概念清楚、易懂、看得清，不要快到看不清；这是网站第一站，UI 风格、易用性和代表性都要考虑。
- 文案：不放数字，用措辞给分量。
  - Broken access 这一招改为体现 Cloud IAM 的概念和项目（不用 pentest）。用户：pentest 不是强项，那个项目只参与了其中的 finding；现在 AI 自动化渗透更快，懂得 pentest 要找什么、证明什么即可。
  - 网络项目 X-008 不只是 segmentation：从零搭建整个网络，包括 OSPF、segmentation、VLAN、ACL、PAT、MPLS（CCNP 乃至 CCIE 级别的概念），还有防火墙、服务器，以及用 SIEM 和 IPS 监控和管理整个网络。**全部亲手做过**（六人团队）。要用这一个项目体现能做所有相关工作。
  - 第二招与"泄露的云密钥"合并为一招 Cloud IAM（SR-02）；空出的一招给检测（X-002 SecureInsight）。

### 26.2 事实更正（用户 2026-10-01 确认）
- **X-003**：团队项目。用户勾选的个人部分是三个访问控制类 finding（IDOR、admin export 缺角色检查、登出后 token 可重放），但此前说"参与其中两个"。网站上不写数量，只写"my part: the access-control findings"。不再写 "Tester and report author"，也不再写 "14 validated findings" 作为个人成果。
- **X-008**：六人团队，用户亲手做了全部：路由与交换（OSPF、VLAN、segmentation、ACL、PAT、MPLS L3VPN）、防火墙、服务器（DNS / DHCP 等）、SIEM（Splunk、FortiSIEM）、IPS。不写成证书（不说 CCNP / CCIE），只写这些技术本身。

### 26.3 PV 入场的语法（逐帧研究 PV 26.5–34 s，帧在 `.codex-runtime/design/pv/`）
| 时间 | 发生了什么 | 语法 |
|---|---|---|
| 27.0–27.5 | logo 被横向撕裂（扫描线错位） | 剪辑用"信号撕裂"，不用淡入淡出 |
| 27.6–28.4 | 低机位贴近，档案卡填满画面，一道浪卷过，强运动模糊 | 浪潮把档案带出来；镜头跟着浪走 |
| 28.5–29.4 | 打字 "SELECTING FILES…"，发丝引线 + 四个小方点 | 浪 = 搜索 |
| 29.4–30.2 | 再次撕裂，切到更高、更斜的机位，前后景大面积虚化 | 剪辑换角度 + 景深带 |
| 30.6–31.6 | 浪收拢成一道斜坡，卡片像台阶一样升向 X-001，顶点停住；打字 "FILE NUMBER: X-001" | **浪的终点就是焦点**：高度形成引导线 |
| 31.6–33 | 其余回落，被选中的留在高处，推近，背景虚掉 | 搜索结束，剩一个答案 |

### 26.4 首访的整部片子
用 IAM 的四步讲：**识别 → 申请 → 简报 → 最小权限授权**。访客一进来就被当成一个需要授权的身份，整个网站就是一次访问控制。

| 段 | 时长 | 画面 | 易懂的支点 |
|---|---|---|---|
| ① 识别（反向侦察） | 约 6.5 s，三屏，每屏一句大字、停留 ≥ 2 s | 1."Windows · Edge · Vancouver · 2:37 PM"（浏览器 30 ms 内读到，未上传）→ 2. 同一行字下，红色细线标出攻击者会怎么用（exploit / 发信时间 / 诱饵语言）→ 3. "I look at systems the way an attacker would. Then I close the gaps." + 名字。底部一行小字：ACCESS REQUEST · V-xxxx · scope: pending | 一次只说一件事；左右双栏取消 |
| ② 撕裂进场 + 浪潮 | 约 2 s | 横向撕裂切进档案场；低机位、贴近；一道浪沿排卷来，镜头与浪同速；"SELECTING FILES…" | 镜头跟浪 |
| ③ 收敛 | 约 1.6 s | 再一次撕裂切到档案角度；浪收成台阶，升向 YW-000；"FILE NUMBER: YW-000" 停留 | 浪的终点 = 焦点 |
| ④ 主档案升起、解密 | 约 2.5 s | 与其他档案相同：弹出、转向、解密光扫过；停一下 | 和点开任何档案一样 |
| ⑤ 简报（攻防短片，下一步重做） | 约 15 s | 见 26.5 | |
| ⑥ 授权 | 约 2.5 s | "ACCESS GRANTED · read-only · scope: portfolio · expires when you leave"；一道解密浪从主档案扫过全场，档案变得可读，交棒 | 最小权限 = 打开网站的方式 |

- 首访前全场是密文；④ 只解密 YW-000；⑥ 解密全场。回访：② ③ 照播（入场本身），不自动打开主档案，全场已可读。
- 任何时刻按任意键或点击：跳到当前段的结尾状态（不逼人看完）。
- 撕裂用后处理 pass（按横带随机错位），浪是 `waves.ts` 里的纯函数，镜头直接由浪的前锋位置驱动。

### 26.5 短片（⑤）重做方向（在 ①–④ 确认后做）
- 去掉气泡：PV 式打字 + 发丝引线 + 小方点，一次一行，靠近当前镜头焦点。
- 红光：一道"红色的浪"沿缝卷来（与入场同一种浪的语言），途经的盘轻颤；防守盘先亮，光把它截断、打散；不是直线。
- 每招一个镜头（撕裂切到防守盘附近，景深带），最后拉高到全景，六道光墙成一条线。
- 文案（无数字）：

| 攻击 | 挡住它的工作 |
|---|---|
| Phishing email · T1566 | An awareness programme I built for an entire institute (SR-03) |
| Risky vendor · T1199 | Third-party risk reviews at a Canadian financial institution (SR-01) |
| Poisoned AI tool · ATLAS | A scanner that tests AI-agent tools before agents touch them (X-001) |
| A leaked cloud key · T1552 / T1078.004 | Least-privilege IAM and secret scanning: a stolen key opens almost nothing (SR-02) |
| Malware on a laptop · T1204 | AI-assisted detection that writes the analyst's first triage note (X-002) |
| One machine infects the rest · TA0008 | An enterprise network built from scratch: routing, firewalls, IPS and a SIEM watching all of it (X-008) |

### 26.6 假设台账
| # | 假设 | 状态 |
|---|---|---|
| H1 | 低机位、贴近的镜头（俯约 8°、span 约 4）在现有场景下有 PV 的质感（不穿模、不露底） | 待验证（spike） |
| H2 | 镜头直接由浪的前锋驱动（不经弹簧），运动模糊 pass 能给出 PV 的速度感 | 待验证 |
| H3 | 撕裂作为后处理 pass 不掉帧 | 待验证 |
| H4 | 去掉 lens 后 sealAll / rekey 仍可实现"首访全场密文，⑥ 解密" | ✅ `model/archive.ts`：`sealAll` + `rekey(…, 'all')` 本来就是入场解密浪 |
| H5 | T1078.004（Valid Accounts: Cloud Accounts）、T1204（User Execution）编号 | 待核对 |

### 26.7 验收（本轮分两次给用户看）
- 第一次（①–④）：录制首访视频，与 PV 26.5–34 s 并排对比；截图 ① 的三屏。
- 第二次（⑤–⑥）：完整首访视频（桌面 + 手机）。
- 阶段末：verify + E2E（去掉 lens / tour 的测试改写），fps ≥ 58，reviewer 审查。

### 26.8 修订（2026-10-01，用户："浪潮和收敛没有 PV 的感觉；反向侦察失去了 UI 的统一和高级感，像 PPT"）
重新逐帧看 PV（27.6–31.8 s 每 0.2 s；开头 6.5–23.5 s）。之前的理解错在：
- 浪潮段**没有第二次撕裂**，是一个连续镜头；机位不是贴地平视，而是从近乎沿抽屉方向（卡片侧边成竖条）开始，边推进边转到档案角度（卡面展开），同时减速。
- 浪是行内依次起伏的斜向涟漪，主浪与镜头同速；镜头减速时涟漪平息，最后一道浪在目标那一列堆成一道长缓坡，顶端是档案。全场统一象牙色，前 1.5 s 强烈横向拖影，上下雾化。
- 开头是 IAM 认证的 UI：淡线稿底纹、居中一行极小的状态字、标志按笔画画出、标志左移后右侧逐条打出 "- ID CONFIRMED / REQUEST RECEIVED"、圆环收拢在请求上、"WELCOME TO" + 高亮条揭出名字；左上 lockup、右下署名常驻，与档案场是同一套框架。

实现（`waves.ts` `searchWave`、`archive.ts` 入场镜头、`ui/Gate.tsx`）：
- 入场：撕裂只在识别 → 档案场之间用一次。镜头 yaw 84° → 59°、俯 26° → 19°、span 0.8 → 1，一条 easeOut 曲线同时驱动镜头位置和主浪；运动模糊 ×3.2（仅行进中）；入场期间所有盘统一象牙色、记录不发光，曝光 +0.1，景深带更窄；随后归位。
- 识别开场：ACCESS PERMISSION REQUIRED → YW 标志按笔画画出 → lockup 与右下 "ACCESS REQUEST V-xxxx —" 出现 → 标志左移，右侧逐条：VISITOR IDENTIFIED · V-xxxx / 浏览器事实（附 "read by this page in N ms · nothing left your browser"）/ 红色 ENOUGH TO AIM AN ATTACK（附 exploit · 发信时间 · 诱饵语言）/ REQUEST RECEIVED · READ ACCESS · SCOPE PENDING → 访客指纹圆环（由 hash 生成）收拢，REQUEST LOGGED → WELCOME TO + 高亮条揭出 YAOTING WANG + "I look at systems the way an attacker would. Then I close the gaps." 场景在最后一条状态时开始构建。约 15 s，任意键跳过。

### 26.9 被否决的方案（2026-10-01）
- "You are filed"（访客盘写入、封存）：用户评价"一般"。
- "你的请求就是那道浪"：光带 + "YOU" 标签跟随光头 + GRANTED 四角框。用户："那个 you 的标签和光带毫无用处，甚至不如最开始的反侦察，那个好歹有 attack profile 的感觉。" 教训：移动的指示物本身不承载安全含义；原版的价值在视角翻转（网站用攻击者的眼光看访客）。

### 26.10 开场定稿：攻击画像（约 5 s）+ 光点打进档案场（约 2 s）
用户要求：总长压到 5 s；视觉要比原版好；左侧大字本身撞进卡片变成字段；卡片是我们的风格又不破坏信息；结尾不是淡出，而是画像变成光点击中档案场、引出浪潮，衔接入场，这段 2 s。

实现（`ui/Gate.tsx`、`styles/gate.css`）：
| 时间 | 画面 |
|---|---|
| 0–0.5 s | lockup（与档案场 HUD 同位置同样式）+ 画像卡升起。卡片 = 硬盘盘面：磨砂象牙底、两端象牙端头、蚀刻走线、香槟镶条；卡头 `TARGET PROFILE · V-xxxx`，三个字段 System / Local time / Language |
| 0.3–2.4 s | 三句大字逐句出现（"You're on **Windows · Edge 154**."、"It's **7:32 PM, Vancouver**."、"Your browser speaks **Chinese**."）；每句的粗体值本身飞进卡片对应字段（复制体从句子位置缩放平移到字段），落下时字段闪香槟色、卡片被撞一下 |
| 2.4–3.6 s | 卡头翻成红色 ATTACK PROFILE，三个字段下写出红色用法：match a known exploit / time the phishing email / write the lure in it；左侧 "Put together, that's an **attack profile**." |
| 3.6–5 s | 左侧加 "I look at systems the way an attacker would. **Then I close the gaps.**"；一道扫描线扫过卡片，字段原地变密文，用法划掉，卡头变橄榄色 SEALED · NEVER LEFT YOUR BROWSER |
| 静止帧 | 档案场在这时才构建（同步约 2 s：搭建 0.76 s + 预编译着色器 1.4 s；放在动画中会卡顿），读最后那句话的时间里完成 |
| 2 s 交接 | 文字淡出，卡片向中心收成一个光点；遮罩褪去，露出停在入场第一帧的档案场（`holdEntrance`）；光点沿弧线落到浪的起点（`entranceOrigin`），击中处一圈光环扩散，浪从那里开始（`releaseEntrance`），镜头随浪推进，浪落定直接变成主界面形态 |

随后：入场结束签发只读权限（解密光前从主档案向外扩散），主档案自动打开并播放攻防短片。回访不播开场，直接入场。任意键跳到交接。
附带修复：生产构建首帧会闪出给爬虫用的纯文本（`prerender.css` 在开启脚本时隐藏，无脚本时照常显示）。

## 28. 主档案：可用的专业视觉展览（2026-10-01）

> **2026-10-02：后续重做见 `docs/subject-space-spec.md`**（v2：门 → 内景 → 六个 2.5D 领域图版，已在真实应用内实现）。

**本轮接入已撤回（用户 2026-10-02 否决）。** 用户认可的是演示中的表达效果，不是原型整套UI、构图载体或直接替换正式主档案。整块原型面板与既有网站不属于同一种界面语法；模型在真实观看尺度下也过小、不可读。已恢复本轮开始时的主档案入口与 DefenceFilm，新增组件/模型/脚本移至 `.codex-runtime/design/profile-demo/blender-study/`，不参与正式网站构建。

后续设计约束：以现有档案实体、材质、排版、开档方式为基准，将已认可的展示效果重新设计成档案内部的表达。先在真实网站背景和实际观看尺度中呈现关键帧，证明专业对象、内容层级与整体风格成立；不能以独立demo获认可替代正式界面设计验收，不能先接入再补一致性。以下内容保留为被撤回实施的记录，不代表批准的正式界面方案。

撤回证据：真实 `/?intro` 的浏览器检查输出 `{ restoredFilm: 6, prototypeInSite: 0 }`，恢复原 DefenceFilm，新的主体面板不在正式页面。项目契约类型检查/eslint/64测试/build通过，`smoke: ok — 18 routes, 4 assets served`。Blender研究脚本输出位置也改为研究目录，防止后续实验默认写入正式assets。

用户认可 `study-v2.html` 的实体展开 → 内部响应展示 → 证据收纳方向。此次实施保留这种构图和交互，统一到网站现有 Manrope / JetBrains Mono、象牙磨砂、香槟边缘、蚀刻线、橄榄状态、小面积风险红。领域对象必须能被专业人士辨认，也要通过动作和短文案让普通访客读懂；禁止通用方块代替领域概念。

| 领域 | 专业对象与动作 | 来源和边界 |
|---|---|---|
| 网络 | 路由器、RJ45交换机、服务器、实际端口与线缆；VLAN通路、ACL边界、监控支路 | X-008 六人团队，用户各层亲手参与；不只讲segmentation |
| Cloud IAM | 身份凭据、Action/Resource权限策略、对象存储与计算资源；收窄权限，不把云画成实体云朵 | SR-02 AWS权限审查；示例策略，不冒充实际生产配置 |
| AI工具安全 | MCP tools/list工具描述、恶意指令、Docker隔离运行环境、检测报告；检查发生在agent使用前 | X-001 MCP Security Framework；不将inspection说成保证所有工具安全 |
| 检测研判 | 终端、Wazuh事件、重复事件缓存、LLM初步研判记录；告警保留，分析员决定 | X-002 SecureInsight；使用已验证的暴力破解场景，避免杜撰EDR自动阻断 |
| 安全意识 | 真实邮件结构、发件域、链接域差异、识别与报告操作 | SR-03 BCIT意识项目；降低风险，不宣称邮件自动拦截 |
| 风险评估 | 供应商请求、SOC2/ISO证据资料、评估记录与风险矩阵；请求保持待决 | SR-01 Coast Capital；全部示例资料，不展示保密客户数据 |

Blender负责可辨认的设备、薄层文档载体及材质细节，浏览器负责权限路径、事件流、真实可读字段和交互状态。六领域各自有语义明确的动作，不用同一条红线穿六个箱子。终帧六入口打开既有对应档案，保留身份、联系、履历信息的可访问入口，关闭回档案场；支持跳过、暂停、重播、低动态与手机。

非目标：不重做已认可的反侦察/入场，不改履历事实，不引入真实云/API授权，不升级Blender或引入外部模型库。

假设台账：Blender 5.2.1 LTS 在本机可启动（已验证 `blender.exe --version`）；现有 GLTFLoader可复用（已验证 `scene/model.ts`）；专业模型的材质与可读性（待真实WebGL spike）；新主档案退出后恢复既有导航/深链接（待E2E）。验收：真实首访从入场进入新主档案，六领域有不同专业对象且可读、可控、可跳转，手机不溢出；本机实际模型加载有非零mesh数；项目verify和相关E2E通过；fresh-context reviewer对照本节审查。视觉满意度以用户看实拍为准，不以测试替代。

## 27. 入场视觉打磨（2026-10-01）

**目标**：只打磨反侦察与波浪聚焦两个阶段。以本地 PV 帧为参考，建立精密读数的排版、具有方向的细线、象牙磨砂材质与单一运动焦点。保留真实浏览器读数 → 攻击画像 → 封存、文字进入字段、画像收成光点触发浪潮、主档案自动打开的行为。

**非目标**：不修改主档案攻防短片、履历内容、API、权限机制，不增加新的依赖、音效或暗色主题。

| 假设 | 状态与证据 |
|---|---|
| 浏览器事实与状态接口可复用 | 已验证：`Gate.tsx` / `visitor.ts`，基线 64 个单测通过 |
| 初始化会阻塞动画 | 已知风险：项目 memory 与 §26.10；仍在封存静帧准备场景 |
| 入场独立调光能减弱棕色梳齿，同时保留厚度 | 已验证：本机真实 WebGL spike 与 0.7/1.8/3.5 s 采样；入口象牙调光延续到待打开的静帧，首次打开时连续归零，关闭文件后不再施加 |
| 手机可保持同样的阅读层级 | 已验证：390×844 与 390×650 实拍与 E2E；短屏攻击卡片底边 559 px，Skip 顶边 581.3 px，三个用途全部 fits=true；禁止 ellipsis 放行 |

**验收**：真实入口 `/?intro` 在桌面与手机播放，采样收集/攻击/封存/浪潮/聚焦；没有空字段飞行残影、可读用途截断或跳过后的残余动画。回访与深链接维持原有行为，reduced-motion 使用静帧与 Continue。运行项目 verify command、相关 E2E，并由 fresh-context reviewer 对照本节审查。

**视觉决定**：读数轨道与飞行引线表达数据位置，移除弹跳与装饰电路；浅层磨砂画像承载累积事实，攻击用途采用小面积锈红，封存结论成为主要文字。三项用途全部显现后约留 1.5 s 阅读时间。画像先收成细线再收成光点，落点由实际场景投影提供，不额外叠加屏幕光环。波浪改为一个主峰与衰减尾波；限制运动拖影、放宽中段清晰区域，镜头最终将焦点归给选中档案。入口导航暂时隐藏，细线读数从 Selecting files 转到 File YW-000。

**独立审查**：fresh-context reviewer 首轮发现 StrictMode 重挂载让字段提前可见、旧宽度检查允许省略；均已修复，复审 PASS。开发入口第一句可见时读取三个目标字段 computed visibility 均为 hidden，飞入后实拍字段累积显示。主档案短片、内容与其设计未修改。

**复现入口证据**：`npm run test:e2e -- --project=desktop-1440 --project=phone-390 --project=phone-short --grep 'entry:|entrance:|reduced motion'`。三视口的完整首访、飞行中跳过、回访波浪共 9 项通过；截图保存于 `.codex-runtime/design/entrance/art-directed/`。旧测试助手对 Continue 的 3 s 点击超时曾静默吞错，已改为明确等待 15 s 并点击，不把未操作的静帧当流程错误。低动态与导航最终补验结果另记。

**验证记录**：项目 verify 五步已运行：类型检查、eslint、64/64 单测、生产构建通过，真实 serving smoke 输出 `smoke: ok — 18 routes, 4 assets served`。已有构建 warning：archive 同时静态/动态引入、主 bundle 超过 500 kB。

**最终补验**：`npm run test:e2e -- --project=desktop-1440 --project=phone-390 --project=phone-short --grep 'reduced motion|deep links|back and forward'` 输出 `7 passed (2.2m)`。结合三视口首访/跳过/回访的 9 项，16 项相关验收均有通过证据。未宣称运行全量 E2E 或 Safari；视觉判断以本机 Chromium 实拍为依据。

## 29. 第八轮：入场按 PV 25 fps 重做（2026-10-05）

用户："前面的反侦察感觉对了，不对的是从封存到档案馆的过程，浪潮没有视频里的感觉"；"PV 和 RhineLabUI 都不是个人简历网站，要综合考量和改变，不是照抄"；黑色那块（X-000）是单独的惊喜 lab，保留。

### 29.1 原片 26.0–34.0 s（逐帧，25 fps，1080p，`yt-dlp` 下载到会话草稿目录，不入库）
| 时间 | 画面 |
|---|---|
| 26.00–26.40 | 欢迎页静止：WELCOME TO / RHINE LAB.LLC. / INTERNAL DATABASE + 标志，底纹是淡线稿 |
| 26.40–26.88 | 背景提亮到白；欢迎块变柔（失焦）、略缩小、偏冷青色，溶进白场；26.92 纯白，中间先出现几个小方点和第一个打字字符 |
| 26.96–27.24 | 卡片侧对镜头成竖条，带强烈横向拖影从左边滑进白场，约 0.3 s 填满画面 |
| 27.20–28.20 | 两层竖条；一道很高的浪卷过，拖影很重；"SELECTING FILES" 在 27.96 打完 |
| 28.20–29.00 | 镜头升高变斜，行变成斜向的带；拖影减弱；28.8–29.2 一道暖色高光斜扫过玻璃 |
| 29.00–30.50 | 行清楚可见；回传；景深很深，近处和远处的行溶成暖色雾 |
| 30.50–31.00 | "SELECTING FILES…" 清掉，"FILE NUMBER: X-001" 打出 |
| 30.60–32.50 | 一道斜脊台阶式升向那份档案，档案略抬起，镜头缓慢漂移 |
| 32.55–33.30 | 档案升起、镜头推近，状态行淡出，场景变浅 |

材质：磨砂亚克力，光从厚度里透出来（边缘琥珀色），面是奶油色，顶上小白凸片；曝光高、景深重。整段只有左上 lockup、右下署名、中间的打字状态（配小方点和一条拉到屏幕边缘的发丝线），没有别的 UI。

### 29.2 采用与改动
运动骨架按 RhineLabUI 对这一镜的逐帧重建（`archiveWave` / `cinematicField` / 电影镜头；MIT，代码中注明出处），改动在内容、时长和结尾：
- **退场**：反侦察的封存画面过曝、变柔、略缩小，退进白场；名字 lockup 留到最后（PV 的 lockup 全程不动）。`ui/handoff.ts`。
- **滑入**：档案馆在白场里从左侧滑入（z −23 → 0，0.75 s，二次减速），前端可见；镜头贴地侧视，0.22 s 上甩到 43°，再环绕、退成长焦（距离 28 → 140，取景 10.8 → 7.33），落在档案馆自己的视角。`motion/waves.ts` `entranceSlide` / `entranceCamera`。
- **浪**：一道约为硬盘高度 2/3 的浪，每秒 19 行，跨抽屉斜 0.65 行；2.3 s 起一道每秒 24 行的回波；2.95–3.4 s 交给静止形态。静止形态从档案向外逐行"只升不落"（§26.8 的决定），不再有回落的余振。`entranceWave` / `grown` / `entryFocus`。
- **焦点是主档案**：浪的坡顶是 YW-000；3.3 s 打出 "File YW-000 · Yaoting Wang"（PV 的档案编号换成人名），配四个定位方点、发丝线和一条指向硬盘的引线。`Hud.tsx` `SearchReadout`。
- **结尾**：去掉 PV 30.6–32.5 s 的长停留。首访与回访都落在首页（四份精选亮起 + 论点句）；不再自动打开主档案（2026-10-06 用户决定 D1）。内景从首页的 "Inside my drive" 进入。首访的只读权限在浪落定时签发，然后显示首页。
- **光**：入场开头曝光 +0.3（从白场里出来），1.3 s 内回落；前 1.8 s 运动模糊加倍。

### 29.3 发现：象牙磨砂在现有场景里已经做得出来
入场搜索时（`setEntranceLight` 满值、所有盘统一亮度、记录不发光）整片档案馆就是 PV 的象牙磨砂质感（`film.mjs` 首访第 60 帧）。静止时变成棕褐色，原因不是材质，而是"空盘压暗到 0.52 + 侧光"这套"记录亮、空盘暗"的相关性规则（§24.6）。要不要让静止状态也保持象牙白（相关性改用内发光，而不是压暗空盘），待用户决定。

### 29.4 验证方式
`scripts/film.mjs`：页面跑在假时钟上，每帧推进 1/25 s，软件渲染也能得到准确的 25 fps 序列；输出逐帧图、每秒一张 5×5 的对照表和 mp4，与原片同尺度并排看。

## 30. 入场：指纹（2026-10-05，用户认可"反侦察的感觉非常对"）

来源：会话草稿里的动效稿 `fingerprint.html`（artifact「Fingerprint Entry」）。前三幕移植进 `ui/Gate.tsx`，第四幕（Canvas 里的档案馆）不移植，由 §29 的真实 3D 入场接替。
- `ui/fingerprint/print.ts`：同步 SHA-256；Sherlock–Monro 方向场（核心与三角）+ Jobard–Lefer 等距脊线；墨色压力、断线、汗孔；扫描用的光层；脊线点汇入 16×16 格（远点先走、同时落地）。全部以哈希为种子：同一浏览器同一枚指纹。哈希键：系统、浏览器、时区、语言、屏幕、像素比（不含时钟）。
- 时间轴（秒）：读取 0.35–2.75（扫光自上而下显影，四个特征点出现，读数从密文解出）→ 画像 2.9（特征点变红，写出攻击者用途）→ 封存 4.4（光往回扫，读数变密文；5.0 起脊线汇入格子；5.5–5.95 打出 SHA-256）→ 5.95 开始构建 3D 场景（静帧下）→ 6.6 退场（白场，`handoff.ts`）。
- 任意键 / 点击 / Skip：跳到封存的静帧，场景就绪后退场；入场只播最后 1.5 s（`SKIP_ENTRANCE`：镜头落位、精选亮起），然后落首页。完整入场留给页脚的 Replay。低动态：直接显示封存静帧，按 Continue。
- 文案（四句大字与两行小字）是占位稿，等用户亲手改（`docs/copy-drafts.md`）。
