# 执行说明 P2：把 v2 美术和动效变成生产版

> 写给执行会话（Sonnet）。作者：Opus（美术总控 / PM），2026-10-08；同日按 `reviewer` 子代理的意见改过一版。
> 美术规则在 `docs/direction/art-direction.md`（v2；§5 首页 10-08 重做）。这份只管**做什么、怎么验收**。
> 有疑问、或者实测和这里写的不一样：停下来，带着实测数字回报，不要自己改美术决定。

## 0. 目标与非目标

**目标：** 用户已认的 v2 原型成为生产版的**唯一**样子，不再有 URL 开关：
- 清晰的光；
- 打开档案时真解密；
- 门里外壳滑开；
- 首页四块盘在自己的槽里升起。

顺带收掉 P1 留下的三件小事。

**非目标（这一轮不做）：**
- 手机端的新视觉（下一轮单独写）。本轮手机只要求"不比 P1 差"，以及 P2.2 写明的解密行为；
- 指纹入场退场的新动画、内景六站的打光、X-000、演示 UI 的"亮线"；
- 任何 Blender 资产；
- 简历链接（`feat/resume-link` 仍在等用户）；
- 任何文案改动。唯一例外是 P2.6c 的 NoWebGL 头衔。

## 1. 来源

| 项 | 位置 |
|---|---|
| 原型工作树 | `.codex-runtime/lookdev2`，分支 `lookdev/r2`，改动未提交。**不要在那里提交**。底座是 `release/p1` 的 `9affdfa` |
| 全部改动 | `.codex-runtime/direction/lookdev-r2.patch`：16 个文件，+637 / −69，是对 `release/p1` 的直接 diff。10-08 已用 `git apply --check` 确认能干净打上 |
| 原型怎么看 | 在 `.codex-runtime/lookdev2` 里运行 `npx vite --host 127.0.0.1 --port 5191`，打开 `http://127.0.0.1:5191/?look=2&motion=1&shelf=1`。去掉参数就是 P1 生产版，方便对照 |

原型里的开关：

| 开关 | 管什么 | 取值在哪 |
|---|---|---|
| `look=2` | 光 | `look.ts` 的 `CLEAR` |
| `motion=1` | 解密和新时序 | 各文件里的 `MOTION` 分支 |
| `shelf=1` | 首页构图 | `look.ts` 的 `SHELF_K`，模式 `rack` |

`look=1`（v1，被否）和 `shelfMode=stair|row`（被否）**不移植**。

## 2. 假设台账

| # | 假设 | 状态 | 证据 / 怎么验 |
|---|---|---|---|
| A1 | 补丁能干净地打在 `release/p1` 上 | ✅ | 10-08 `git apply --check` 通过 |
| A2 | 打上补丁后 verify 的前半段能过 | ✅ | 10-08 在 `lookdev2` 实跑：`npx tsc -b` 无错，`npx eslint .` 无错，`vitest` 83/83，`npm run build` 成功 |
| A3 | 现有 E2E 里首页标注相关的用例会失败：标注从浮动改成了左侧明细表加盘上编号 | ⚠️ 未验 | 预期要改。改测试要守住原意：四项都在屏幕里、互不重叠、不压论点和 HUD |
| A4 | 光里强度为 0 的后期 pass 真的关掉了，而不是以 0 强度在跑 | ⚠️ 部分 | 景深已确认：`aperture 0` 时 `dof.enabled = false`。光晕、屏幕焦外、颗粒、暗角逐个确认 |
| A5 | 封存前后的卡顿来自指纹动画中途的主线程长任务 | ✅ | 10-08 用 `rt.cjs first --nocap` 量：约 7.4 s 处有一个长任务，P1 是 939 ms，原型是 1267 ms；此外还有约 300 ms 的一个。这时指纹动画正在播 |
| A6 | 拍摄工具能对 `vite preview --host 127.0.0.1` 拍 | ✅ | 10-08 对原型 build（端口 5192）拍过 `film.cjs files` 和 `home`，以及 `fair.cjs` |
| A7 | 新的光在手机档位上不变糊、不掉帧 | ⚠️ 未验 | `scripts/shots.mjs` 手机机位前后对照，见 §6 |

## 3. 分支与提交

- 从 `release/p1` 开 `feat/p2-v2`。如果 P1 在你开始前已经合进 `main`，就从 `main` 开。下文的 `<base>` 指你开分支的那一点。
- 每项一个提交，作者和 P1 一样：
  `git -c user.name=JoKFA -c user.email=felixwang1222@gmail.com commit -F <file>`
- message 里不要任何 trailer：没有 Co-Authored-By，没有 Generated with。
- 不 push，不部署。做完回报，由用户决定。

## 4. 工具怎么跑（量任何东西之前先读）

工具都在 `.codex-runtime/direction/tools/`，**在这个目录里运行**。它们读写相对路径 `film/`、`fair/`、`cap/`、`out/`。

**1. 先 build，再起 preview。** 在主仓库运行：

```bash
npm run build
```

```bash
npx vite preview --host 127.0.0.1 --port 4181 --strictPort
```

一定要写 `127.0.0.1`：在这台 Windows 上，preview 会把 `localhost` 绑到 IPv6。

**2. 环境变量：**
- `BASE=http://127.0.0.1:4181`：每个工具都要设，它们的默认端口各不相同；
- `TAG=p2`：不设就会覆盖 `film/` 里已有的片子。

**3. 各工具：**

> `film.cjs` 在 10-08 修过一个工具 bug：在 Promise 回调里才加上的类（比如 `.leaving`）引发的 CSS 过渡，会在截图的真实耗时里跑完，片子上看着像"一帧消失"。现在截图前会再同步一次。用旧版工具拍的片子，这类针不能当真。


| 工具 | 命令 | 产出 |
|---|---|---|
| 片子 | `BASE=… TAG=p2 node film.cjs files`（打开 / 下一份 / 关闭 / Index）、`… door`、`… home` | `film/p2-<名字>/`：逐帧 PNG，加 `marks.json`。`readableAt` 是"点击后第一帧可读"的秒数，可读的定义见 `film.cjs` |
| 运动能量 | `python anal.py p2-open-x001 p2-next-file p2-close p2-door p2-home-land p2-home-enter p2-home-back` | 每段的 peak 和 last-motion（最后一帧有动的时间），外加能量曲线图。"针"就是单帧突变 |
| 光 | `BASE=… TAG=p2 node fair.cjs`，然后 `python fairstats.py p2` | 首页、浏览、文件页三帧：亮度 / p95 / 边缘 |
| 首页 | `BASE=… Q= TAG=p2 node home.cjs 1440x900 1920x1080 1280x720` | `cap/home/p2-*.png`，加 `.json`：四个编号的屏幕坐标。`Q=` 必须设成空，否则会带上原型的开关 |
| 实时时间线 | `node rt.cjs first --nocap --secs 22`，加 `--throttle 4` 就是 4 倍降速 | 自己对主仓库的 `dist/` 起 preview，所以要先 build。输出 `out/…/marks.json`：页面侧的时间戳和长任务列表。每次都是全新的浏览器进程 |
| 帧间隔 | `BASE=… node fps.cjs` | 开档、关档、下一份的帧间隔 avg / p95 / max |
| 关档逐帧 | `BASE=… Q= node closeprobe.cjs`（实时）；`BASE=… Q= node film.cjs closeprobe`（假时钟，加 `NEXT=1` 先走一次"下一份"） | 实时打开 X-001 再按 Esc，逐帧打印：模式、页面类名、可见的密文块数、演示层不透明度、盘的朝向 |

**R2 基准**：原型在本机实测，验收拿它比。

| 项 | 原型（R2） | P1 生产版 | 工具 |
|---|---|---|---|
| 光：首页 | 0.802 / 0.885 / 14.9 | — | `fairstats.py` |
| 光：浏览 | 0.786 / 0.898 / 11.2 | — | 同上 |
| 光：文件页 | 0.849 / 0.949 / 15.1 | — | 同上 |
| 打开 X-001 到可读 | 1.20 s | — | `film.cjs files` → `p2-open-x001/marks.json` |
| 下一份到可读 | 1.92 s | — | `p2-next-file/marks.json` |
| 关闭（last-motion） | 2.96 s | — | `anal.py p2-close` |
| 门到第一站（内景 `.space.live`） | 5.24 s | — | `film.cjs door` → `p2-door/marks.json` 的 `liveAt` |
| Esc 到第一块重新加密 | 约 77 ms | — | `closeprobe.cjs` |
| 首访：论点出现（`thesis`） | 17.27 / 17.17 s | 17.06 / 16.84 s | `rt.cjs first --nocap`，各两次 |
| 首访：四项都出现（`cos4`） | 17.27 / 17.17 s（和论点同时） | 21.53 / 21.32 s | 同上 |
| 指纹期间最长的长任务 | 1267 ms | 939 ms | `rt.cjs` 的 `longtasks` |
| 首页编号坐标 | `evidence/R2-home-<尺寸>.json` | — | `home.cjs` |

## 5. 要做的

### P2.0 打补丁

在 `feat/p2-v2` 上运行 `git apply --3way .codex-runtime/direction/lookdev-r2.patch`，然后跑一遍 verify，确认 A2。这一步不单独提交，和 P2.1 一起。

**补丁打不上：** 停下回报，不要手工拼。

### P2.1 光：CLEAR 成为唯一的光

- `look.ts` 不再读 URL，只留一个常量对象，装 `CLEAR` 的取值，便于以后在一处调。删掉 `SOFT`、`NEUTRAL`、`over()`、`num()`、`LOOK_ON`、`LOOK.on`。
- 所有 `if (LOOK.on)`、`LOOK.on ? a : b` 都收成 CLEAR 那一支。
- 在 CLEAR 下不起作用的键，连同代码一起删掉。比如：
  - `halo: 0` 对应的光晕地板逻辑；
  - `grain: 0`；
  - `dofAperture` / `dofMax` 为 0；
  - `span: 1`。
  
  删之前逐个确认它真的不起作用（A4）。
- 合并冲突时，以 P1 的 `setShadows` 为准（它不会触发重编译）。蚀刻材质的 `polygonOffset` 保持**无条件**。
- `vite.config.ts` 里原型加的 `fs.allow` 是给原型工作树的 junction 用的，**还原，不进生产**。

**验收：** `fairstats.py` 三帧和 R2 基准比，亮度和 p95 各差 ≤ 0.02，边缘差 ≤ 1.5。

### P2.2 打开档案：真解密

`ui/cipher.ts` 和 `FileView.tsx` 的 MOTION 分支成为唯一路径，删掉旧的"打哈希 → 退黑条"和霜。

**做法：** 沿用原型的 DOM 做法（`art-direction.md` §3.3 已改成允许）。原型临时把文本节点拆成 16 字符的块，用完把**原节点**放回去。必须满足：

1. **可打断。** 解密进行中关闭、点"下一份"、浏览器后退，都要先同步 `restore()`，再让 React 卸载（放进 `useLayoutEffect` 的清理函数）。不能出现 `removeChild` 一类的控制台错误。
2. **reduced-motion：** 直接显示明文，标签行照样显示 `AES-256-GCM · N blocks · tag verified`。
3. **手机：** 宽 < 900 px 或 `(pointer: coarse)` 时，只解密文字，盘面上不叠 8 × 5 的块网格（`cipherFace` 不调用）。
4. **读屏：** 密文覆盖层 `aria-hidden`；明文始终在 DOM 里；标签行 `aria-live="polite"`。
5. **关闭和打开对称**（`art-direction.md` §3.2，10-08 改）：
   - 盘保持朝向读者，文字（260 ms）和盘面（230 ms）一起重新加密；
   - 加密到七成（180 ms）才让盘转身：`exitRef` 的 `onSealed` 回调，`closeFile` 等它再调 `archive.close`；
   - 页面淡出 220 ms，**淡完才移除**；
   - 关档用的密文在阅读时趁空闲备好（`prepareSeal`），窗口尺寸一变就作废重备。
6. **关档时的一帧闪烁（P1 就有，原型里还在，必须查根因）。** 实时录屏能看到：
   - P1：盘开始转身的那一帧，左栏（`X-001`、ALL FILES）和盘面演示同时消失；
   - 原型：整页消失一帧，下一帧又回来，再正常淡出。
   
   两者都发生在 `archive.close()` 把模式切到 `closing` 的那一刻。DOM 状态逐帧看都正常（`.file` 在、`display:block`、不透明度 1），所以先查 React 重渲染时有没有 Suspense 回退、CSS 类切换、或画布层级变化。
   
   **复现：** `VIDEO=1 BASE=… Q= node closeprobe.cjs`，录屏在 `cap/video/`；用 `ffmpeg -ss <Esc 时刻前 0.3 s> -t 1.6 -i <录屏> -vf fps=25` 抽帧，逐帧看。
   
   **注意：** 假时钟的 `film.cjs` 截图在这里不可靠，以实时录屏为准。
   
   **验收：** 录屏里从按 Esc 到页面淡完，没有任何一帧页面或演示整块消失后又出现。

**不允许假装：** 比特必须来自真实密文，标签必须真的解密校验。

**单测（新加）：**
- `seal` 后 `verify` 为真；改一个字节后为假；
- 同一明文两次 `seal`，密文不同（新 IV）；
- 块数 = 每个文本节点 ⌈字符数 / 16⌉ 之和；
- `restore()` 之后，宿主的 `innerHTML` 和解密前完全一致。

**E2E（新加）：**
- 打开 X-001，标签行出现且含 `tag verified`；
- 解密进行中按 Esc：没有页面错误，回到浏览；
- 390×844 打开一份：标签行出现，页面里没有 `.cg` 网格；
- 关档：按 Esc 后 ≤ 100 ms 出现第一块密文；按 Esc 后 180 ms 内，盘的朝向（`__cf.face`）不低于 0.95；`.file` 被移除前的最后一帧，页面不透明度 ≤ 0.05（实时量，用 `closeprobe.cjs` 的方法）。

### P2.3 动效时序

`motion=1` 下的时序全部成为默认：

| 文件 | 内容 |
|---|---|
| `CasefileApp.tsx` | 开档、路由开档、`openProfile` 的延迟；`transit` 期间隐藏 HUD |
| `door.ts` | `stand 0.8`、`end 2.1`、`dollyFrom 0.3`、`dieFrom 1.2`、`finalDistance 8.5` |
| `space/shots.ts` | `INTRO` 的 `dur 1.9`、`hubAt 1.15`、`blendFrom 0.8` |
| `archive.ts` | `runSweep` / `setSweep`；门里电路保持点亮；`setFaceLight` × 0.5；运动模糊 × 0.3 |

删掉对应的旧分支，以及 `MOTION` 常量本身。

### P2.4 门：外壳滑开

原样移植三处：
- `hero.ts` 的 `setCover`；
- `archive.ts` 里门期间的 `setCover` 调用；
- `drive.ts` 去掉的磨砂扫光。

**验收：** 逐帧看 `film.cjs door`：
- 镜头推近段（约 1.2–3.4 s）每一帧都看得到电路线；
- 切进内景是约 3.4–3.9 s 的交叉淡化，`anal.py p2-door` 里没有针（R2 基准里也没有）；
- `marks.json` 的 `liveAt` 不比 R2 基准（5.24 s）慢 0.2 s 以上。内景本身一直在动，所以 last-motion 不能当"到第一站"用。

### P2.5 首页：在槽里升起

规格见 `art-direction.md` §5。代码在补丁的这些位置：
- `archive.ts`：`briefLift`、`calm`、`pointSelected`、`pointAmt`，以及 `rack` 分支；
- `Brief.tsx`：`rack()`；
- `brief.css`：`.brief.shelf`；
- `entries.ts`：`RANK`。

要求：
- `SHELF_K` 只留 rack 用到的键：`lift 1.8`、`zoom 0.62`、`shiftX 0.30`、`shiftY −0.09`、`flat 1`、`quiet 0.85`。删掉 `stair` / `row` 两种模式和它们的代码，删掉 `dip`（原型里是 0）。`selectedAnchors` 里 stair 时期的 `CARD.H * 0.62` 分支也删掉。
- "指向"只点亮电路（系数 `1 + 2.6 × pointed`），**不**加内发光。
- `.brief.shelf` 的样式并进 `.brief` 本身，删掉 `shelf` 这个类名。
- 手机（宽 < 900 px）的首页列表不变。

**单测（新加）：** 把 `Archive.briefCells()` 的选格逻辑抽成纯函数，比如 `model/brief.ts` 的 `briefCells(sel, entries)`，`Archive` 改为调用它。断言：
- 四块盘各在自己的抽屉里：车道 ≡ 1、2、4、5（mod 6）；
- 两对之间行差都是 3。

这是"等距 2 × 2"的保证；以后加档案时，它会先报警。

**E2E（改）：** 在 1440×900、1920×1080、1280×720 三个尺寸下：
- 明细表四项在屏幕内，不压论点、HUD 和底部按钮；
- 四个编号在屏幕内，彼此不重叠，也不压 HUD；
- 1280×720 时明细表进入紧凑模式（只留标题）。

**验收：** `home.cjs` 三个尺寸输出的 `.json`，和 `evidence/R2-home-<尺寸>.json` 比，每个编号的 x、y 各差 ≤ 16 px。另附三张截图，和 `evidence/R2-home-*.png` 并排。

### P2.6 P1 留下的三件事

**a) 指纹动画中途的卡顿（P1.2 后半）。**

A5 已查明：场景构建在指纹动画还在播的时候，以一个 0.9–1.3 s 的主线程长任务跑完，动画在这段时间里停住。P1 brief 写过"构建不在动画中途做"，但实际上它早就在动画中途了。所以目标不是挪时间，而是**不再阻塞**：

1. 用 `rt.cjs first --nocap` 量现状：1× 和 `--throttle 4`，各 3 次。记下从 `gate` 到 `transfer` 之间的长任务。
2. 把构建拆成小段，用 `scheduler.yield()` 或 `requestIdleCallback` 让出主线程。PMREM 环境图（P1 实测约 0.66 s）可以降分辨率或换算法，前提是 P2.1 的光验收仍然通过。着色器编译保持 `compileAsync`。
3. **不再等到"标题"才加载（Opus 10-09 补充）。** 现在 `Gate` 的 `onTitle` 才触发 `setLoadScene(true)`，指纹动画已经播到约 6 s；之后还要空等约 4 s 才能 `transfer`（实测：`cf` 7.3 s，`transfer` 11.5 s）。
   - 拆成小段之后，`Gate` 一挂载就开始 `import('./scene/archive')`，并开始分段构建；
   - 指纹动画本身的编排和时长（`T`）不动。
4. **目标：**
   - `gate` 到 `transfer` 之间最长的长任务：1× 时 ≤ 100 ms，4× 时 ≤ 300 ms；
   - 1× 时 `transfer` − `gate` ≤ `T.end` + 0.3 s，也就是指纹动画一播完就进入，不空等；
   - 这样首访论点预计在约 12–13 s 出现（现在约 17 s）。
5. **达不到：** 停下，带数字回报，不要改指纹动画的编排。Opus 备了下一步方案：用访客指纹真实派生会话密钥，把等待变成"派生密钥"这一步。它要先在原型里定样子。

**b) 首访时间。** 明细表现在和论点同时出现。用 `rt.cjs first --nocap` 量两次：
- `cos4` − `thesis` ≤ 100 ms；
- `thesis`：P2.6a 达标时 ≤ 13 s；没达标时，不晚于 P1 生产版的同一测量（约 17.0 s）+ 300 ms。

P1 brief 的"≤ 14 s"在两版上都达不到（同一把尺子：P1 17.0 s，原型 17.2 s）。要缩短，得改入场编排，那是下一轮的美术决定，本轮**不要**动。

**c) NoWebGL 头衔。** `NoWebGL.tsx` 第 10 行源码是 `Security analyst &amp; engineer`（JSX 实体），改成 `Security Analyst`，和站点页头一致。

**d) SR-02 的 `10+`（Opus 10-09 定：删）。** `entries.ts` 里 SR-02 的 `['10+', 'PRs gated (approx.)']` 删掉；约数放在安全简历上反而减分。删掉后只剩 `~30%` 一个数字，就留一个，不要补新数字；确认单个数字时版面不出问题。同步改用到它的测试。

### P2.7 清理

全仓库不区分大小写搜：`look=`、`motion=`、`shelf=`、`look_on`、`LOOK.on`、`MOTION`、`SHELF`、`lookdev`。不应再剩原型开关或"lookdev"字样的注释；原型注释改写成说明机制的普通注释。

### P2.8 E2E 收尾

全部改完后，跑一次完整 E2E（4 个 project）。中途只跑相关的 spec。

## 6. 完成证据（交回时逐条附上真实输出）

1. `.claude/verify.json` 的命令及其输出：`npx tsc -b && npx eslint . && npx vitest run && npm run build && node scripts/smoke.mjs`。
2. 完整 E2E：通过数、失败数、跳过数，以及每个跳过的理由。
3. 片子（§4 的命令，`TAG=p2`），附 `marks.json` 和 `anal.py` 的结果：

   | 转场 | 目标 |
   |---|---|
   | 打开 X-001 到可读（`readableAt`） | ≤ 1.2 s，且不比 R2 基准慢 0.1 s 以上 |
   | 下一份到可读（`readableAt`） | ≤ 1.8 s，同上 |
   | 关闭（`anal.py` last-motion） | 不比 R2 基准慢 0.15 s 以上；没有针 |
   | 门到第一站（`liveAt`） | 不比 R2 基准慢 0.2 s 以上 |
   | 打开、下一份 | 没有针 |
   | 首页进出（`home-enter` / `home-back`） | 四块盘只做竖直运动；没有针 |

4. `fps.cjs`：开档、关档、下一份，桌面 p95 ≤ 17.5 ms，和 P1 的数对比。
5. `home.cjs` 三个尺寸：截图和编号坐标，对照 R2 基准（P2.5）。
6. `fairstats.py p2`，对照 R2 基准（P2.1）。
7. `scripts/shots.mjs --quality high`：手机机位（390×844）前后对照，不能更糊（A7）。
8. P2.6a 和 P2.6b 的实测表。
9. 运行 `git log --format='%an <%ae>%n%B' <base>..feat/p2-v2`，对全文 grep `claude|anthropic|co-authored|generated with`，应无命中。
10. 用 `reviewer` 子代理对照本说明审一遍，附它的结论和你的处理。

## 7. 不要做的

- 不改任何美术取值，不加新效果。觉得哪里不对，截图回报。
- 不移植 v1（`look=1`），也不移植被否的首页模式（stair / row）。
- 不改文案、数据（`RANK` 和 P2.6d 除外）、简历。
- 不 push，不部署，不动 `main`。
- 不改 `CLAUDE.md` / `AGENTS.md`。
- 不在 `.codex-runtime/lookdev*` 工作树里提交。
