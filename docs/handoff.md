# 交接（2026-10-05，云端会话 → 本地会话）

分支 `claude/nifty-dijkstra-acqxu3`。生产仍是 `main`（eb14cc8），本分支每次推送都有 Vercel 预览。云端没有 GPU：所有截图用 SwiftShader，E2E 没跑过；**本地第一件事是跑 E2E 并在真机上看**。

## 1. 现在的首访流程（已实现）
1. **指纹入场**（spec §30，`ui/Gate.tsx` + `ui/fingerprint/print.ts`）：读取 → 画像 → 封存（SHA-256），约 6.6 s。
2. **退场**：过曝退进白场，名字留着（`ui/handoff.ts`）。
3. **3D 入场**（spec §29，`motion/waves.ts` `entranceWave/entranceCamera/entranceSlide`，`scene/archive.ts`）：档案馆侧面滑入、镜头 0.2 s 上甩、斜向浪 + 回波、收成坡，坡顶是 YW-000；状态行 "Selecting files…" → "File YW-000 · Yaoting Wang"（`Hud.tsx` `SearchReadout`）。按 PV 26–34 s 逐帧对过。
4. **首页**：首访与回访都落在首页（四个精选亮起 + 论点句，`ui/Brief.tsx`），不再自动打开主档案（2026-10-06 用户决定）。内景（门 → 硬盘内景）从首页的 “Inside my drive” 进入。

## 2. 本轮已完成（计划 `docs/curation-plan.md` 与审阅报告的对应项）
- S0 决策、S1 评审回路（`scripts/shots.mjs`、`docs/review-rubric.md`、`docs/review-log.md`）。
- S2 入场（上面 1–4）。
- G1 象牙白：档案馆静止时保持入场的象牙磨砂（空盘只轻微压暗，镜片下未选中的退后），**用户已同意**。还没在真 GPU 上看过。
- S4 减法：顶栏只剩返回 + **Next file**（精选的下一个，否则同抽屉下一个）；去掉水印、完整性标记；Crypto-shred、UEBA 风险、trackers/cookies/headers、访问日志都移进 **V-FILE**（"This session" 页签）；页脚换成会话状态行（状态 / 访客编号 / 时钟 / Replay）；图例去掉计数；抽屉位置改成刻度仪表（`DrawerMeter`）；浏览面板去掉摘要。
- F1 数字只出现一次（facts 里与 numbers 重复的自动不显示；X-001 去掉 "5 pipeline phases"；SR-01 演示注脚去掉数字）；F2 演示注脚加 `TLP:CLEAR`。
- S3 部分：Index 第一组是 "Start here"（四个精选），V-FILE 放最后；纯文本首页改成分层简历（论点 → Start here → 经历 → 更多项目 → 教育 → 证书 → 联系），档案页末尾只有 Next file 和 All work。
- 工具：`scripts/film.mjs`（假时钟逐帧录 25 fps + 每秒对照表 + mp4，软件渲染也准）、`scripts/still.mjs`（真实画质静帧，很慢）。

## 3. 还没做（按建议顺序）
1. **本地验证**：`npm run test:e2e`（Windows + d3d11）。入场相关测试已改成新流程（指纹、首访直接落首页、shred 在 V-FILE），但都没跑过，预计要修时间/选择器。真机看：指纹入场、白场退场、3D 入场的拖影与景深、象牙白静止画面、60 fps。
2. **清理**：`styles/gate.css` 里旧入场卡片（`.gz-card/.gz-f/.gz-aim/.gz-say/.gz-rail/.gz-stage…`）已无人使用，可删（保留 `.gate.gz` 的 veil/wash、`.gz-lock`、`.gz-skip`）。
3. **S6 抽屉 = 职业时间线**：Profile → IT & Network → Security Operations → Cloud & DevSecOps → AI Security → GRC & Risk；改 `data/roles.ts` 的 `DRAWERS` 与各条目 `slot.lane`，`data.test.ts` 校验；e2e 里按抽屉序号断言的地方要跟着改；单独提交。
4. **S6 YW-000 记号**：两个原型（盘面蚀刻 YW 印记 / 不同材质），让用户选。
5. **报告其余项**（用户已同意方向）：G4 标签写成"术语 / 白话"对（如 `T1566 / Phishing email`，**文案需用户定稿**）；F3 演示与正文同步解密（对齐到同一条时间线）；手机档案页先标题后演示；首页标注手机越界复查。
6. **S5 文案**：用户亲手改。占位稿：指纹入场四句、论点句、四条精选一句话（`docs/copy-drafts.md`）。
7. **S7 收尾**：重拍 `public/og-card.jpg`（可用 `scripts/still.mjs` 或真机截图，1200×630，现在是旧头衔）；把定稿规则写回 `DESIGN.md`；再跑一轮评审（`scripts/shots.mjs` + `docs/review-rubric.md`，记到 `docs/review-log.md`）。

## 4. 规则（别丢）
- 跟用户用中文交流；不要编造事实或数字（每个数字要在 `numbers.test.ts` 有来源）；不写工作许可；头衔 Security Analyst；Full-time from Apr 2027；精选 4 个：MCP · Coast Capital · VibesMeet · PwnScan。
- 黑色 X-000（SENTINEL-1 lab）保留，是彩蛋。
- 参考 PV（B 站 BV1rr4y1b7sz）和 RhineLabUI（MIT）是学语法，不是照抄；网站是个人简历，每个借鉴都要为"让人看懂他"服务。
- 每步：`npx tsc -b && npx eslint . && npx vitest run && npm run build && node scripts/smoke.mjs`，然后提交推送。不要开 PR，除非用户要求。
