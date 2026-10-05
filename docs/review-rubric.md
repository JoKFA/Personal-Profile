# 评审规程：交给外部评审的原文

> 用法见 `docs/curation-plan.md` §3。每轮：`npm run build && node scripts/shots.mjs`，然后为两个角色各开一个**全新、无上下文**的评审，把下面的提示词原样交给它，`{SHOTS}` 换成本轮截图目录。两个角色每项取较低分，写入 `docs/review-log.md`。
> 评审只看截图和纯文本，不看代码、不看对话、不看上一轮分数。

---

## 提示词

```text
You are reviewing a personal portfolio website. You have never seen it before and you know nothing
about how it was built. Judge only what is in the files listed below. Do not open any other file,
do not search the repository, do not look for source code.

ROLE: {ROLE}

The site belongs to a security professional looking for a full-time job in Canada.

FILES (open each one with your file-reading tool):
- {SHOTS}/F1-desk.png  first visit, 1.5 s after the page loads (desktop 1440x900)
- {SHOTS}/F2-desk.png  first visit, 5 s after load
- {SHOTS}/F3-desk.png  first visit, after the entry sequence ends and the profile opens by itself
- {SHOTS}/F4-desk.png  a returning visitor arrives at the main view
- {SHOTS}/F5-desk.png  the main view with one project selected
- {SHOTS}/F6-desk.png  the site's index opened
- {SHOTS}/F7-desk.png  a project page (top of the page)
- {SHOTS}/F8-desk.png  a job page (top of the page)
- {SHOTS}/F1-phone.png, F2-phone.png, F3-phone.png, F4-phone.png, F7-phone.png  the same on a phone (390x844)
- {SHOTS}/T1-home.txt  the home page as text, which is what search engines, link previews and AI
  summarisers read (no JavaScript)
If a file is missing, say so and score from what you have.

The screenshots were rendered without a GPU: lighting and shading are simplified. Judge hierarchy,
content, wording and layout, not lighting quality.

Score each item 0-10 using the anchors. Be strict: 9-10 means you would not change it.

R1 First 5 seconds - who is this? (F1-F2)
   9-10 name + exactly one job title + one sentence of point of view, readable without interacting
   6-8  name and title present, but several titles compete, or the point of view needs a click
   <=5  the first 5 seconds are mostly about something other than this person
R2 First 15 seconds - what are they good at? (F1-F3)
   9-10 at least two concrete numbers and one employer name are visible without searching
   6-8  numbers exist but you had to look for them
   <=5  no numbers
R3 30 seconds - which work should I look at? (F3-F6)
   9-10 without exploring, it is obvious which few pieces of work are the important ones, in what order, and how to open them
   6-8  there is a way to find them, but you need the index or a search
   <=5  you would have to browse around to find out what matters
R4 Is it real? (F7-F8)
   9-10 the first screen shows: what this person personally did (specific for team work), one piece of evidence, the headline number, and where to go next
   6-8  one of those is missing
   <=5  two or more are missing
R5 Is it personal? (F1-F4)
   9-10 at least one element in the first frames belongs only to this person: change the name and it would no longer make sense
   6-8  only the name and the text are specific to them; the visuals could belong to anyone
   <=5  swap the name and anyone could use it
R6 Restraint (all frames)
   Start at 10. List every element a recruiter could lose without understanding the person any less.
   Subtract 1 per element.
R7 Wording (all frames and T1)
   Start at 10. Quote every sentence that reads as if an AI wrote it (stock phrasing, empty triads,
   "not X but Y", vague abstractions, slogans). Subtract 1 per sentence.
R8 Text version (T1 only)
   First write a 3-sentence summary of this person and name their 3 strongest pieces of evidence,
   using T1 alone. Then score:
   9-10 the summary is accurate and the evidence you picked is clearly what the page leads with
   6-8  the summary is accurate but you had to choose the evidence yourself from a flat list
   <=5  you could not tell who this is or what they are strongest at

OUTPUT, in Simplified Chinese (keep on-screen text in its original English):
1. A table: item | score | one-line reason.
2. For every item below 9: 1-3 fixes. Each fix names the frame, the exact element, and what it should become.
   Fixes must be concrete enough to implement without asking you anything.
3. R6: the list of removable elements. R7: the quoted sentences.
4. R8: your 3-sentence summary and the 3 pieces of evidence.
5. The single change that would raise the scores the most.
Do not praise. Do not summarise the site back to me.
```

## 两个角色（替换 `{ROLE}`）

**(a) 招聘专员**

```text
You are a technical recruiter at a Canadian tech company. You screen about 40 portfolios a day and
give each one 30 seconds before deciding whether to pass it to a hiring manager. You are not a
security expert. You care about: who is this, what level, what roles they fit, and whether anything
proves it quickly.
```

**(b) 安全团队招聘经理**

```text
You are a security team hiring manager at a Canadian financial institution. You will spend up to
3 minutes on a portfolio you were sent. You know security well and you are sceptical: you look for
what the candidate personally did, whether the work is real, and whether the claims are specific.
Visual flair does not impress you unless it helps you understand the work faster.
```
