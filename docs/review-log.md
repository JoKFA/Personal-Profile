# 评审记录

> 规程见 `docs/review-rubric.md`。每项取两个角色中的较低分。R6 / R7 的分数很快触底，同时记录个数，用个数看进步。

## 第 0 轮 · 基线（提交 9284fe2，2026-10-05）

截图：`node scripts/shots.mjs`，云端无 GPU（低画质 + reduced motion）。四个全新评审：招聘专员 ×2、安全招聘经理 ×2。

### 分数

| 项 | 专员 A | 专员 B | 经理 A | 经理 B | 本轮（取低） |
|---|---|---|---|---|---|
| R1 前 5 秒 | 5 | 4 | 4 | 5 | **4** |
| R2 前 15 秒 | 7 | 7 | 7 | 7 | **7** |
| R3 看哪几个 | 5 | 5 | 5 | 5 | **5** |
| R4 可信 | 7 | 7 | 6 | 7 | **6** |
| R5 个人感 | 6 | 6 | 6 | 6 | **6** |
| R6 克制 | 0（14 个） | 0（17 个） | 0（17 个） | 0（21 个） | **0**（14–21 个） |
| R7 文案 | 3（7 句） | 2（8 句） | 1（9 句） | 2（8 句） | **1**（7–9 句） |
| R8 纯文本 | 6 | 6 | 6 | 6 | **6** |

稳定性：同一角色两次之间每项分差都 ≤ 1，S1 通过。

### 四个评审一致指出的问题

1. **前 5 秒讲的是访客，不是他。** 浏览器读数和攻击画像占据最大的字；四个评审的“提分最多的单一改动”全是同一件事：首访直接落在个人档案屏（姓名、头衔、一句话、数字、精选），浏览器演示改成可选链接，同样内容写进无 JS 文本。
2. **数字排得太靠下。** 50+ / ~15% / ~30% 排在右栏第五层；手机落地屏一个数字都看不到。
3. **没有“先看这几个”。** 落地屏左侧默认展示 2021–22 的校园网（X-008），被认为是最弱的一件；档案馆要逐个翻；Index 里 Visitor File 排在经历前面。
4. **项目页**：MCP 的 “Designer and builder” 没说是否独立完成、缺结果数字；Coast Capital 首屏没有“下一步”，50+ / 20+ 同屏出现四次；手机项目页的标题和数字在演示图下面。
5. **纯文本版没有数字、证书、联系方式**，19 个链接平铺。
6. **可删元素**（四个评审都列出）：`CRYPTO-SHRED ✕`（应为 Close）、水印 `WATERMARKED TO V-xxxx`、`✓ INTEGRITY VERIFIED`、比标题还大的 `X-001` / `SR-01` / `FILE YW-000`、页脚 risk / trackers / cookies、抽屉计数、图例计数、Index 里的 Visitor File、`Access log` tab、证据框刻字 `YW ENCRYPTED ARCHIVE`、`5 PIPELINE PHASES`、重复的数字、两个 Replay。
7. **AI 味句子**（四个评审都引用）：`Build the network. Control the crossing.` · `The SIEM keeps the decision` · `Business traffic keeps flowing. The crossing attempt is stopped and recorded.` · `What your browser reveals. What an attacker could use.` · `Put together, that's an attack profile.` · `Security learned from the network up: …` · `Security work across …, with the evidence kept.` · `Decision-ready risk`；另有个别评审引用 `Processed locally. Nothing sent.`、`Infrastructure first`。

### 采纳与不采纳

| 建议 | 处理 | 理由 |
|---|---|---|
| 首访直接落在个人档案屏，浏览器演示改为可选 | 采纳为 S2 的首选方向 | 四个评审一致；对应方案 §S2 的 A / C |
| 数字上移到头衔下；手机放在画布前 | 采纳（S3） | — |
| Start here 精选 | 采纳（S3），**用 D2 的 4 个**（MCP · Coast · VibesMeet · PwnScan） | 三个评审各自选了 BCIT 作为第 3 个，因为它有数字；D2 是你的决定，保持 |
| 只用一个头衔 “Security Analyst” | **采纳**（2026-10-05 你改定 D1） | 左上角 `SECURITY ANALYST · VANCOUVER, BC`，删掉第三行 `SECURITY PORTFOLIO`；副标题同步 |
| 减法清单 | 采纳（S4） | 与方案 §4 一致，范围更大 |
| 整片 3D 档案墙删掉 | **不采纳** | 是视觉身份，属于非目标；它的问题是“不承载意义”，由 S6（抽屉 = 时间线、YW-000 记号）和精选亮起解决。一位评审正好提出“抽屉按职业时间线排” |
| 用新的数字（钓鱼点击率前后值、AWS 金额、N 个供应商未通过、60+ 台服务器的发现数） | **暂不采纳，需要你提供来源** | 违反“每个数字都有来源”；若事实库里有，再加入 |
| 写清 “Full-time from Feb 2027” 与学位 “Apr 2027 (expected)” 的关系 | **采纳**：改为 Full-time from Apr 2027（你 2026-10-05 确认） | 与学位结束日期一致 |
| 加工作许可 | 未定 | 是否公开由你定 |
| 手机 F1 文字重叠、计数 3 / 3 | 待在真机确认 | 截图停在动画中途（字段正从左侧飞入卡片），可能不是排版错误；但手机 F2 的大标题是浅灰色，对比度要查 |

### 我自己看到、评审没提的

- F5：MCP 面板的摘要压在后面一块深色硬盘上，读不清。面板的雾化背景挡不住深色物体。

### 下一步

S2 钻石 1：评审意见已经把 B（保留画像、压成 1 拍）排除了。只做 A（论点先行）与 C（直接落地）两个原型，各跑一轮评审，你选。
