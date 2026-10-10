# 执行说明 P0 + P1：保护手机 v2、收口上线

> 写给：执行会话（Sonnet）。作者：Opus（PM / 美术总控），2026-10-06。
> 和用户用中文交流；网页文案是英文。视觉规则见 `docs/direction/art-direction.md`，但本说明**不做视觉升级**（光、材质、转场重做是 P3，Opus 出原型后另发说明）。
> 先读：`DESIGN.md`、`docs/casefile-spec.md` §29–30、`docs/handoff.md` 和 `docs/review-log.md`（这两份在云端分支里）、本文件。

---

## 0. 目标与非目标

**目标**
1. P0：把本地还没提交的手机 v2 存进独立分支，main 工作区变干净。
2. P1：把云端分支 `origin/claude/nifty-dijkstra-acqxu3`（4d456aa）加上本说明的修复，合进 main 并上线 yaotingw.com。

**非目标**
- 不合并手机 v2（那是 P2，另有说明）。
- 不重做转场、光、材质、首页构图（P3）。P1.4 只做最小可读性修复。
- 除 P1.7 列出的口径更正外，不改任何事实或数字；除本文列出的以外，不改文案。

## 1. 用户已定（2026-10-06）

| # | 决定 |
|---|---|
| D1 | 首访落在**首页**（论点句 + 4 个精选），不再自动打开主档案 YW-000。内景从首页的 “Inside my drive” 进入 |
| D2 | 先放 General Security 版简历 PDF，以后由简历系统换新版。源文件见 P1.6，上线要等用户确认两点 |
| D3 | 手机：以云端分支为底，移植 v2 的机制（P2） |
| D4 | Git：作者 `JoKFA <felixwang1222@gmail.com>`。**任何 git 能看到的地方都不能出现 AI 署名**（`Co-Authored-By: Claude…`、`Claude-Session:`、“Generated with”）。commit 可以做；**push 和部署前先问用户** |

**注意：** 本仓库的 `git config user.name` 实际是 `Yaoting Wang`，不是 JoKFA。所以本说明里**每一次** commit 都要显式写身份，并用 `-F` 或 `-m` 给 message（不要打开编辑器）：

```
git -c user.name=JoKFA -c user.email=felixwang1222@gmail.com commit -F <message 文件>
```

## 2. 假设台账

| # | 假设 | 状态 | 证据 / 怎么验证 |
|---|---|---|---|
| A1 | 云端分支能在本机构建，verify 全过 | ✅ 已验证 | Astra 的报告（用户转述，2026-10-06）：tsc、lint、82 个单测、build、smoke 都通过。Opus 本机跑了 Astra 的构建产物，页面无报错。动手前请自己再跑一次 verify，作为基线 |
| A2 | 全量 E2E 能在本机 d3d11 跑完 | ⚠️ 部分 | Astra：桌面主流程和入场 4 项通过，两项首页测试报 `.brief-co on screen`，41 项没跑完 |
| A3 | 封存后约 2.7 s 的静止是 3D 构建阻塞主线程造成的 | ⚠️ 未证实 | 实时截帧：6.6→9.3 s 画面不变（`.codex-runtime/direction/evidence/first-visit-realtime.jpg`）。场景 chunk 到 `onTitle`（约 5.95 s）才开始 `import()`。**先抓一次 Performance trace 证实再动手** |
| A4 | Vercel 生产环境没有设置 `SITE_URL` 或 `VITE_SITE_URL` | ⚠️ 未验证 | 用 Vercel MCP 或 `vercel env ls production` 查。有旧值就要改成 `https://yaotingw.com` |
| A5 | P0 做完后合并不会碰到本地 v2 的改动 | ✅ | v2 已在独立分支，main 工作区干净 |
| A6 | 先 squash 云端分支，就能去掉 13 个 AI 署名 commit | ⚠️ 有条件 | `git merge --squash` 会生成 `.git/SQUASH_MSG`，里面原样保留 13 条 `Co-Authored-By` 和 13 条 `Claude-Session`。**必须先删掉 SQUASH_MSG，再用 `-F` 给新 message**（见 §4.0）；commit 之后用 §6 第 6 条验证 |
| A8 | yaotingw.com 已绑到这个 Vercel 项目 | ✅ 已验证 | 2026-10-06 `curl -sI https://yaotingw.com/` 返回 200，`Server: Vercel`，CSP 与本仓库 `vercel.json` 一致，og 标签与本仓库生成的一致 |
| A7 | `scripts/shots.mjs`、`film.mjs`、`still.mjs` 在 Windows 上连不上自己起的服务 | ✅ 已证实 | 2026-10-06 本机实跑 13 帧全部 `ERR_CONNECTION_REFUSED 127.0.0.1`：vite 在 Windows 上把 `localhost` 绑到了 IPv6 |

---

## 3. P0：保护手机 v2（约 10 分钟）

当前 main 工作区（HEAD `eb14cc8`）上有 21 个修改文件和 9 个未跟踪路径，都是手机 v2 的工作（Codex 写的，没提交）：

```
M  public/sitemap.xml  src/App.tsx  src/casefile/CasefileApp.tsx  src/casefile/space/clock.ts  src/casefile/space/shots.ts
M  src/casefile/ui/FileView.tsx  src/casefile/ui/demos/{Custody,Edr,Mcpsf,Network,Pentest,PwnScan,Quorum,Sentinel,Service,Simple,Stack,Telus,Viva}.tsx
M  src/casefile/ui/demos/useLoop.ts  src/test/setup.ts
?? docs/mobile-audit-2026-10-02.md  e2e/mobile.spec.ts  playwright.mobile.config.ts  src/casefile/mobile/
?? src/casefile/space/timing.ts  src/casefile/ui/FileContent.tsx  src/casefile/ui/demos/session.ts  src/casefile/ui/demos/state.ts  src/casefile/ui/demos/useLoop.test.tsx
```

步骤：
1. 先存一份路径清单：`git status --short > /tmp/p0-before.txt`（Windows 用会话临时目录）。
2. `git switch -c feat/mobile-v2`
3. **只 add 上面这些路径**，不要用 `git add -A`：`docs/direction/` 是 Opus 的文件，不属于这个 commit。
4. `git -c user.name=JoKFA -c user.email=felixwang1222@gmail.com commit -m "wip(mobile): save the v2 phone experience behind ?mobile=v2"`，不带任何 AI 署名。
5. `git switch main`。

验收：
- `git status --short` 只剩 `?? docs/direction/`。
- 第 1 步清单里除 `docs/direction/` 以外的**每一个**路径，都出现在 `git show --name-only feat/mobile-v2` 里（目录要展开到文件逐一比对，不按"大约多少个"判断）。
- `git log -1 --format='%an <%ae>%n%(trailers)' feat/mobile-v2` 输出 `JoKFA <felixwang1222@gmail.com>`，trailer 为空。

push 先问用户（这是唯一一份副本，建议推到远端做备份）。**不要** `git clean`、`git stash`、`git reset --hard`。

---

## 4. P1：收口上线

### 4.0 分支

```
git switch -c release/p1 main
git merge --squash origin/claude/nifty-dijkstra-acqxu3
rm -f "$(git rev-parse --git-dir)/SQUASH_MSG"     # 里面有 13 条 AI 署名，必须删掉
# 把 message 写进会话临时目录里的一个文件，比如 squash-msg.txt，概括云端那一轮：
#   feat: fingerprint entry, curated home, ivory archive, decluttered browsing view, review tooling
#   （正文几行要点；不带任何 trailer）
git -c user.name=JoKFA -c user.email=felixwang1222@gmail.com commit -F <squash-msg.txt 的路径>
git log -1 --format='%an <%ae>%n%(trailers)'      # 必须是 JoKFA，trailer 为空；否则 amend 修正后再继续
```

把 `docs/direction/*.md` 一起放进这个 commit，或者单独一个 `docs:` commit。之后 P1.1–P1.10 每项一个 commit。

每项做完跑一次 `.claude/verify.json` 里的命令：`npx tsc -b && npx eslint . && npx vitest run && npm run build && node scripts/smoke.mjs`。

**全量 E2E 只在最后跑一次**（用户的规矩：阶段结束才跑全量）。中途用单个 spec，或用 `--grep` 只跑相关测试。

### P1.1 首访落在首页（D1）
- `src/casefile/CasefileApp.tsx`：第 254 行附近 `autoOpen.current = homeAfter.current = first` 改成不自动打开。入场结束后，首访的处理和回访一样：`grant()`，然后 `setArriving(false)`，然后 `archive.setBrief(true)`。删掉 `homeAfter`（第 71、198 行）和 `autoOpen` 分支（第 323–329 行）。
- 改测试 `e2e/archive.spec.ts:273`：首访最后等 `brief` 出现，并断言 4 个精选；不再等 `.file--subject`。
- 同步文档：`docs/casefile-spec.md` §29.2 “结尾” 改为 “首访与回访都落在首页”；`docs/handoff.md` 第 1 节第 4 条同样改。

验收：
- 首访从加载到看见 `.brief-thesis` 和 4 个 `.brief-co`，本机实时 ≤ 14 s（指纹约 6.6 s + 入场约 6 s + 余量）。
- 测试通过。

### P1.2 封存后不再卡住；Skip 直接到首页
现状（A3）：封存静帧停住约 2.7 s，Skip 按钮变成 “Preparing the archive…”。弱一点的机器会更久。

做法：
1. **先测量。** 用 Playwright 加 CDP `Tracing`，或 `performance.mark` 包住 `import('./scene/archive')`、`new Archive`、`a.ready`，在本机记下三段各多少毫秒。**如果大头不是主线程被阻塞**（比如时间主要花在网络，或者 `a.ready` 在等异步编译而主线程是空闲的），就停在这里，把 trace 的数字报告给用户和 Opus，不要做下面第 3 步。第 2 步只在网络占比明显时才有意义。
2. **提前下载，不提前构建。** 页面一加载就预取场景 chunk 和 `drive-module.glb`（`import()` 先不调用构造，或者用 `<link rel="modulepreload">` 和 `fetch`），把网络和解析挪到前面。构建（`new Archive` 和着色器编译）仍然放在封存的静帧上（spec §26 的规矩：不在动画中途做阻塞工作）。
3. **画面不能"死"。** 等待期间给封存画面一个**只在合成线程运行**的 CSS 动画（只动 `transform` 和 `opacity`）：主线程被构建阻塞时它照样在动。比如一道很慢的光掠过 16×16 格，或者哈希下面那条发丝线循环填充。不要显示 “Preparing the archive…” 这种字。
4. Skip 和任意键：首访跳到封存静帧，场景就绪后**直接进首页**，入场浪潮压到约 1.5 s（只保留后半段：镜头落位、精选亮起）。完整入场留给页脚的 Replay。

验收（实时，不是假时钟）：
- 本机首访从加载到入场开始，以 10 fps 截帧，任意连续 0.5 s 窗口里都有像素变化：相邻帧平均差 > 0.3（方法见 `.codex-runtime/direction/tools/anal.py`）。
- 用 CDP `Emulation.setCPUThrottlingRate(4)` 再测一次，同样成立。
- Skip 后 ≤ 3 s 看到 `.brief-thesis`（场景已就绪的情况下）。

### P1.3 Astra 的 3 个 P2，加 Opus 发现的焦点 bug

**(a) 指纹读数跑到屏外（800×900）。** `ui/Gate.tsx` 和 `styles/fingerprint.css`：右侧空间不够放读数时（比如宽度 < 1100，或右侧剩余 < 320 px），读数改为排在指纹下方的 2×2 网格（手机已经是这个排法），引线跟着改。
- 新测试：800×900、1024×768、1100×700、1280×720 四个尺寸下，4 个读数框都在视口内，并且不和指纹框重叠。

**(b) 首页标注在 390×650 互相重叠、压住论点。** 手机（宽 < 900）不再用浮动标注：4 个精选排成**论点句下面的列表**，01→04，每行 ≥ 44 px 高，可点。桌面见 P1.4。

**(c) 隐藏的首页按钮能被 Tab 聚焦、按 Enter 打开。** `.brief` 隐藏时加 `inert`；其他隐藏浮层（关上的 Index 和 Contact）同理。
- **Opus 在逐帧拍摄时发现了同源 bug：** 点击 “Enter the archive” 后焦点留在已隐藏的按钮上，再按 Enter 不会打开选中的档案（`CasefileApp.tsx` 第 302 行判断了 `ev.target instanceof HTMLButtonElement`）。进入档案馆后要把焦点移到档案馆区域（比如给浏览面板一个 `tabIndex={-1}` 的容器）。
- 测试：点击 Enter the archive，再按 Enter，档案打开；连按 20 次 Tab，`document.activeElement.closest('[inert], .brief.hide')` 始终为 null。

### P1.4 首页最小可读性修复（桌面，临时）
首页构图（标注挂在硬盘下方，像展签）在 P3 重做，**这里不改标注的布局算法**，免得同一块做两遍。只修三处读不清、看不稳的地方：
1. **meta 行读得出。** “Master of Cybersecurity, SFU · CCNA · Security+ · Full-time from Apr 2027” 改用 Manrope 14 px，颜色 `--ink2`，放在论点句下面；论点块后面加一层很淡的雾化底，让对比度 ≥ 4.5:1。
2. **标注文字。** 标题用 Manrope 15–16 px / 600，数字那一行用 Manrope 13 px（不再用等宽灰字）。
3. **读的时候不动。** 标注在镜头**停稳以后**才淡入，逐条间隔 80 ms，按 01→04 的顺序；淡入之后位置不再跟着呼吸漂移，可以冻结在淡入那一刻的位置。

已知遗留：编号和屏幕位置不一致（03→01→04→02）要到 P3 才解决。

验收：
- 对比度用这个方法测：先把 meta 行设成 `visibility:hidden`，截它所在的矩形，取背景的平均颜色；再用文字的 `getComputedStyle().color` 按 WCAG 公式算对比度。写成测试，断言 ≥ 4.5，在 1440×900、1280×720、1024×768 三个尺寸下都要过。
- 标注淡入完成后连续 2 s，每条标注的 `getBoundingClientRect()` 位移 ≤ 1 px。
- `e2e/archive.spec.ts:331` 通过（重叠和屏内断言保留）。

### P1.5 域名、分享卡片（D2 以外最重要的一项）
- `scripts/site-routes.mjs:10` 的默认值改成 `https://yaotingw.com`。查 A4，Vercel 上有旧值就一起改。
- `public/.well-known/security.txt` 的 `Canonical` 和 `public/robots.txt` 的 `Sitemap` 改成 yaotingw.com。
- `vite.config.ts:22` 的 `apiOrigin` 是开发代理用的，确认改了以后 SENTINEL-1 的 `/api` 在本地和线上都还能用。改不改由你判断，但不能把它弄坏。
- **新的 `public/og-card.jpg`**（1200×630，< 300 KB）：在本机 GPU 上以回访身份打开首页，等标注淡入完成，用 DPR 2 截 1200×630，再缩回原尺寸，存 JPEG 质量 85。截图脚本放进 `scripts/`，比如 `og-card.mjs`。加上 `og:image:alt`，写 “Yaoting Wang, Security Analyst: portfolio home”。
- 验收：`npm run build` 后 `dist/index.html` 的 `og:url`、`og:image`、`canonical` 全是 `https://yaotingw.com`。上线后 `curl -s https://yaotingw.com/ | grep -E 'og:url|og:image|canonical'` 输出同样的结果。

### P1.6 简历链接（D2，有闸门）
- 源文件：`E:\简历系统\YaotingWang-Resume.pdf`。2026-09-01 由 `E:\简历系统\main_general_security.tex` 编译，含 Coast Capital，证书与网站一致。**不是** `E:\简历系统\Resume\` 里 4 月那份旧的。
- **闸门（用户确认前不要把 PDF 放进 `public/`）：**
  1. PDF 写的学位是 “Master of Applied Science, Cybersecurity”，网站按成绩单写 “Master of Cybersecurity”（`data/entries.ts:252` 注释：不是 MASc）。需要用户在简历系统里改正后重新编译（tex 第 55 行）。
  2. PDF 里有电话 604-729-1125，挂在公开网站上会被爬。网页版是否保留电话，由用户决定。
- **用户还没确认的情况：** PDF 和四处链接一起做成**一个独立的 commit**，不放进 `release/p1`（可以放在单独分支 `feat/resume-link`）。`release/p1` 照常上线，不带链接，免得出现 404。用户确认并给出最终 PDF 后，再把这个 commit 并进来。
- 链接的地方：顶栏 “Résumé” 放在 Contact 左边；Contact 浮层加一行；YW-000 的 Contact 页签加一行；纯文本首页 `scripts/generate-prerender.mjs:25` 的联系行加一项。
- 固定路径 `/Yaoting-Wang-Resume.pdf`，以后换文件不用改链接。`target="_blank" rel="noopener"`。
- 验收：构建后 `dist/Yaoting-Wang-Resume.pdf` 存在且 > 50 KB；四处链接都在；CSP 下点开没有报错。

### P1.7 数字口径（用户 2026-10-01 的决定：团队渗透测试不写数量）
- `data/roles.ts:17` soc 的 fit：把 “a 14-finding grey-box pentest” 改成 “access-control findings in a team grey-box pentest”。
- `data/entries.ts:18`：SUBJECT.numbers 删掉 `['14', 'pentest findings']`（先确认用在哪里）。
- `data/education.ts:26` ED-01 第 01 节：“…a grey-box pentest of a staging web app with 14 validated findings…” 改成 “…a team grey-box pentest of a staging web app (my part: the access-control findings)…”。
- `ui/demos/Quorum.tsx:25` 的 proof：从 '14 validated pentest findings' 改成 'access-control findings, team pentest'。
- `data/entries.ts:198` SR-02：删掉 `['10+', 'PRs gated (approx.)']`。**这一条是 Opus 的提案，不是用户 10-01 的决定**，要等用户点头才做（理由：“approx. 10 个 PR” 数量太小，反而减分）。
- `numbers.test.ts` 跟着更新（'14' 还在用：MCP 的 14 个检测器）。
- 文档同步：`docs/casefile-spec.md` 第 228、456、702 行附近还写着 “14 validated findings”，改成同样的口径。

### P1.8 清理
- `styles/gate.css` 里旧入场的卡片类（`.gz-card/.gz-f/.gz-aim/.gz-say/.gz-rail/.gz-stage…`）已经没人用了，删掉。保留 `.gate.gz` 的 veil 和 wash、`.gz-lock`、`.gz-skip`（handoff §3.2）。
- `ui/demos/Simple.tsx` 的 `Subject()` 还写着旧头衔 “Security analyst & engineer”。先确认还有没有地方用它：没人用就删，有人用就改成 “Security Analyst”。

### P1.9 工具在 Windows 上能跑（A7）
- `scripts/shots.mjs:100`、`film.mjs:27`、`still.mjs:19` 调 `preview()` 时加上 `host: '127.0.0.1'`。
- `film.mjs` 加 `--gpu` 开关，改用 `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`；并把 CSS 动画同步到假时钟。参考 `.codex-runtime/direction/tools/film.cjs` 里的 `__filmAnim`：每一帧暂停所有 `document.getAnimations()`，再按步长推进，到终点时调 `finish()`。不这样做，DOM 部分的转场会被拍成"一帧切换"。
- 验收：`node scripts/shots.mjs --quality high` 在本机出全部 13 张图。

### P1.10a 修一个渲染 bug：电路线被电路板盖住（Opus 2026-10-06 在原型里发现）
盘面电路的贴图平面（`scene/drive.ts` 的 `face`，位于 `BOARD_Z`）和精密模型（`drive-module.glb` 的 `Ceramic` 等组）的电路板正面完全共面，产生 z-fighting。镜头推近时（打开文件、主档案的门）深度精度变化，电路板盖住电路线，近景就成了一块灰板。

修法：在 `etchMaterial()` 里给材质加 `polygonOffset = true`、`polygonOffsetFactor = -2`、`polygonOffsetUnits = -4`。参考 `.codex-runtime/direction/lookdev-r1.patch` 里 `drive.ts` 对应的一段。

验收：
- 用 `.codex-runtime/direction/tools/film.cjs door` 逐帧拍主档案的门，镜头推近的那段（约 1.5–3.4 s）每一帧都能看到电路线。
- 对照修改前的同一帧，截图附上。

### P1.10 E2E 收尾
- 修好两项首页失败。P1.1、P1.3、P1.4 会改到它们。
- **最后跑一次全量** `npx playwright test`（四个 project）。失败的要修，不能跳过，不能加 `.skip`。

---

## 5. 合并与上线（每一步先问用户）
1. 全部做完、verify 通过、全量 E2E 通过后，把 `release/p1` 的 log 和本节的证据给用户看。
2. 用户同意后 `git push origin release/p1`，拿 Vercel 预览链接。
3. 用户在预览上看过、同意后，merge 到 main 并 push，生产部署。
4. 远端的 `claude/nifty-dijkstra-acqxu3` 不要删，等用户决定。

## 6. 完成证据（交回时逐条附上真实输出）
1. verify 命令的最后 20 行。
2. `npx playwright test` 的汇总：通过和失败数，四个 project 都要有。
3. 首访**实时** 10 fps 截帧的对照表（加载 → 首页），标注时间；P1.2 的"无静止窗口"指标在 1× 和 4× 节流下的数值。
4. 截图：首页 1440×900、1280×720；指纹读数 800×900；手机首页 390×650、390×844。
5. `dist/index.html` 的 og 和 canonical 行（上线后再附 curl 的输出）。
6. `git log main..release/p1 --format='%h %an <%ae>%n%(trailers)'`：作者全是 JoKFA，没有 AI trailer。
7. 用 `reviewer` 子代理按本说明逐条核对的报告；判断有分歧的地方写出你的处理。

## 7. 不要做的
- 不要动视觉参数：曝光、材质、景深、调色、转场时长。P3 会给数值。
- 不要把 `?mobile=v2` 的任何东西带进 `release/p1`。
- 不要为了让测试通过而放宽断言。
- 不要改 `CLAUDE.md` 或 `AGENTS.md`。
