# 文案草稿（D3：你亲手写，我只给草稿和检查）

> 规则：草稿只用于参考，每条请用你自己的话重写在“你的版本”里。只能用已有来源的事实（`src/casefile/data/numbers.test.ts` 里有映射的数字）。
> 写完后由评审 R7 逐句检查；被标出的句子由你改，不由我代写。

## AI 味自查（写完对照一遍）

- 读出来像不像你面试时会说的话？不像就改。
- 每句都要回答：做了什么、对象是谁、多少（如果有数字）。
- 少用：三连排比（“X, then Y, then Z”）、“not X but Y”、破折号对仗、抽象收尾（如现在的 “with the evidence kept”）、口号式短句、形容词堆叠（robust, seamless, cutting-edge, passionate）。
- 一句话里只放一个重点；强调色只给一个词。

---

## 1. 身份行（D1：Security Analyst，已改；方向词待你写定）

现在的三种说法：

| 位置 | 现在 |
|---|---|
| 左上角 | `ANALYST & ENGINEER · VANCOUVER, BC` |
| 副标题（kicker） | `Security Analyst & Engineer · Risk, Cloud & AI Security` |
| Looking for | `Security Analyst · GRC · Cloud & AI Security` |

已改（2026-10-05）：左上角 `SECURITY ANALYST · VANCOUVER, BC`（去掉 `SECURITY PORTFOLIO`），副标题 `Security Analyst · Risk, Cloud & AI Security`，Available `Full-time from Apr 2027`。

待你写定：方向词三处用同一组，例如 `GRC · Cloud · AI Security`（Looking for 可以列岗位，但方向词与副标题一致）。

你的版本：

```
头衔：
方向词：
```

## 2. 论点句（首帧那一句，只强调一个词）

现在（`src/casefile/data/story.ts:7`）：

> Security learned from the network up: routing, then detection, then pipelines, then AI agents. Now assessing risk at a Canadian credit union.

草稿 A（保留“从网络学起”）：

> I learned security from the network up. Now I test AI agents and assess risk at a Canadian credit union.

草稿 B（更短）：

> From routing tables to AI agents, I learned security one layer at a time.

强调词建议：`AI agents`。

你的版本：

```
论点句：
强调词：
```

## 3. 精选 4 条一句话（D2 顺序）

| # | 文件 | 现在的 summary | 草稿 | 可用数字（有来源） |
|---|---|---|---|---|
| 01 | MCP Security Framework（X-001） | Sandboxes any MCP server in Docker and runs 14 detectors before an AI agent is allowed near it. | I built a scanner that sandboxes MCP servers and tests them before an AI agent gets access; I ran it on 60+ real servers. | 60+ servers · 14 detectors |
| 02 | Coast Capital（SR-01） | Security risk assessments for internal projects and third-party vendors at a Canadian credit union. | I assess the security risk of internal projects and vendors at a Canadian credit union and write the rating an auditor will read. | 50+ assessments · 20+ vendor reviews |
| 03 | VibesMeet（SR-02） | Put security checks into a startup’s CI pipeline, tightened its AWS access, and cut its monthly AWS bill by about 30%. | I added security scans to every merge at a startup, removed AWS access nobody needed, and cut the monthly bill by about 30%. | ~30% AWS cost |
| 04 | PwnScan（X-009） | Finds every device on a network without agents, fingerprints the IoT ones, and ranks their CVEs by how likely they are to be exploited. | Our team’s scanner finds IoT devices on a network and ranks their CVEs by how likely they are to be exploited. I built the discovery and the scoring. | Top 3, CMPT 783 |

你的版本：

```
01 MCP：
02 Coast Capital：
03 VibesMeet：
04 PwnScan：
```

---

## 4. 评审标出的句子（第 0 轮，四个评审都引用）

这些由你改写（S5）。入场那几句如果 S2 选了“直接落地”，会随入场一起移走，不必改。

| 句子 | 位置 | 你的版本 |
|---|---|---|
| Build the network. Control the crossing. | `src/casefile/space/content.ts:43` | |
| The SIEM keeps the decision（第 4 步） | `src/casefile/space/content.ts:44` | |
| Business traffic keeps flowing. The crossing attempt is stopped and recorded. | `src/casefile/space/content.ts:51` | |
| Security learned from the network up: routing, then detection, then pipelines, then AI agents. | `src/casefile/data/story.ts:7`（即上面第 2 节的论点句） | |
| Master of Cybersecurity at SFU. Security work across AI systems, cloud pipelines, detection, risk and networks, with the evidence kept. | `src/casefile/data/entries.ts:13` | |
| Decision-ready risk | `src/casefile/data/entries.ts:186` | |
| Infrastructure first（一位评审） | `src/casefile/data/story.ts:13` | |
| What your browser reveals. What an attacker could use. | `src/casefile/ui/Gate.tsx:182`（入场） | |
| Put together, that’s an attack profile. | `src/casefile/ui/Gate.tsx:169`（入场） | |
| Processed locally. Nothing sent.（一位评审） | `src/casefile/ui/Gate.tsx:178`（入场） | |

内景其余五个领域的标题、步骤和结果句是同一种写法（`space/content.ts`），评审只看到了第一个领域；改写时一并看。
