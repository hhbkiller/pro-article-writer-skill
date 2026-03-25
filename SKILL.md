---
name: pro-article-writer
description: Research-first professional illustrated article writer that turns a user's topic, direction, and rough idea into one deep, detailed, human-sounding article with a 5:2 title banner, at least two inline generated images, an HTML review page, and a publishable ZIP package. Search with Tavily for current sources and similar high-quality articles first, especially strong or high-engagement exemplars, then write by reference instead of inventing from scratch. Use the Humanizer skill when available for the anti-AI-text rewrite pass; otherwise fall back to the bundled humanizer guide. Use when the user asks for 生成图文, 图文内容, 配图文章, 写一篇软文, 写软文, 深度推文, or wants one high-quality article instead of multi-platform variants.
---

# Pro Article Writer

Write one strong illustrated article.

Do not generate three platform versions.
Do not optimize for Toutiao, Xiaohongshu, and X separately.
Article quality is the product.

This skill owns:

- research
- exemplar article discovery
- structure planning
- single-article writing
- Humanizer rewrite pass
- image prompt planning and image generation
- HTML review artifact generation
- publish package export
- attachment delivery for the current chat

## Hard Rules

- Start from the user's topic, direction, and brief idea.
- Search with Tavily for relevant articles, current information, and useful source material before outlining.
- Search for similar published articles before drafting. Prefer strong, high-engagement, or otherwise proven exemplars when they exist.
- Record the sources inside the draft.
- Record at least 1 exemplar article in `research.exemplars` and explain why it is worth referencing.
- Decide article structure and image plan before drafting prose.
- Plan 1 title banner in a 5:2 ratio plus at least 2 inline images.
- Final review output must contain 1 real 5:2 banner image plus at least 2 real inline generated images, not placeholders.
- The banner image itself should stay clean and text-free. The article title and subtitle should be overlaid by HTML, not baked into the generated pixels.
- Write one detailed article, not a platform pack.
- Do not write from zero if quality reference articles already exist. Borrow angle, structure, and evidence handling, not wording.
- Run the Humanizer skill after drafting and before image generation when that skill is available in the session.
- If the standalone Humanizer skill is not available, use the bundled fallback guide in `references/humanizer.md` and record that fallback in `article.humanizer.source`.
- In normal end-user flow, generate images through the managed relay gateway only.
- This skill is billed through the managed relay gateway because research and image generation have real runtime costs.
- If the gateway returns a billing, recharge, or insufficient-balance message, tell the user plainly that recharge is required before continuing.
- If gateway image generation fails, report the failure plainly and stop.
- Do not silently switch to direct provider mode unless the user explicitly asks for developer debugging.
- Do not expose raw image prompts in the user-facing HTML review page.
- Do not generate decorative filler images that could match any unrelated article. Inline images must map to the real section topic, product, workflow, or usage scene.
- Never generate political/public-figure imagery, propaganda-style visuals, QR codes, barcodes, payment codes, fake coupons, or scam-like call-to-action graphics.
- After rendering and export succeed, send both `review.single.html` and `publish-package.zip` back to the current chat.
- Use `scripts/deliver-review.mjs` for attachment delivery. It resolves the current agent's latest delivery context from local session state unless an explicit session is provided.
- If attachment delivery fails, report that failure plainly and stop. Do not claim the files were returned when they were not.

If the user only says `生成图文`, `图文内容`, `写软文`, or similar, do not answer inline with finished prose.
Generate the review package instead.

## Read These Files

- Read [references/draft-schema.md](./references/draft-schema.md) when filling or checking `draft.json`.
- Read [references/humanizer.md](./references/humanizer.md) before the final rewrite pass if the standalone Humanizer skill is unavailable.
- Read [references/research-playbook.md](./references/research-playbook.md) before collecting sources and exemplars.

`references/humanizer.md` is bundled from the public `humanizer` skill on OpenClawHub so this writer skill can work without a separate install.

## Workflow

### 1. Create a fresh job

```bash
node scripts/init-job.mjs --root ./jobs --theme "用户指定主题" --direction "用户指定方向" --brief "用户给出的简要思路"
```

This creates:

- `jobs/<job-id>/draft.json`
- `jobs/<job-id>/review.single.html`
- `jobs/<job-id>/artifacts.json`
- `jobs/<job-id>/images/`

### 2. Research first

Before writing:

- capture the user's topic, direction, and brief in `research.userIntent`
- search the web with Tavily for relevant articles, reports, posts, and primary material
- search for similar high-quality or high-engagement articles that can serve as exemplars
- prefer recent or primary sources when the topic is time-sensitive
- record exact URLs, dates, and what each source contributes
- record why each exemplar is worth referencing and what to borrow from it
- summarize findings into concrete takeaways instead of vague impressions

Seed the research step with Tavily-first search:

```bash
node scripts/discover-references.mjs --draft jobs/<job-id>/draft.json
```

`scripts/discover-references.mjs` now uses Tavily first when `TAVILY_API_KEY` is available, or when you pass `--api-key` / `--env-file`.
It writes back:

- `research.searchQueries`
- `research.sources`
- `research.findings`
- `research.exemplars`

If Tavily is not configured or fails, the script falls back to Bing so the pipeline can still continue.

Minimum research bar:

- at least 2 sources
- at least 1 exemplar article
- at least 1 concrete search query
- at least 1 findings summary entry

### 3. Plan the article

Before drafting paragraphs:

- define the angle
- define the audience
- define the article promise
- map section-by-section structure
- plan the 5:2 title banner and at least 2 inline image placements and purposes
- for each inline image, decide which section it belongs to and what concrete scene it should depict

Do not decide images after the article is already done.
The image plan must support the reading flow.

### 4. Draft one article

Write a single article into `article`.

Quality bar:

- have a clear point of view
- include specific details, not generic claims
- use concrete facts from the research
- show tension, tradeoffs, or stakes where relevant
- avoid shallow overview writing
- make each section earn its place

Use `article.blocks` as the final reading order.
Use `article.images` for the real image specs that will be generated.
Set `article.bannerImageKey` to the title banner image key.
There must be at least 3 images total: 1 banner + at least 2 inline images.
There must be at least 2 inline image blocks inside the article body.

Image quality bar:

- the banner is a clean visual background for HTML title overlay, not an image with embedded words
- each inline image must support a specific section, not just the general topic
- prefer concrete scenes: product usage, working context, interface interaction, team moment, or physical environment from the article
- avoid vague concept art, generic glowing shapes, random dashboards, or unrelated stock-photo compositions
- do not request visible text, QR codes, watermarks, logos, political figures, celebrity portraits, or fraud-like promo cards

### 5. Run the Humanizer pass

After the first full draft is written:

- use the standalone `humanizer` skill if it is available
- otherwise read [references/humanizer.md](./references/humanizer.md)
- rewrite the article so it sounds human, specific, and lived-in
- remove AI-sounding abstractions, promo language, vague attributions, and formulaic rhythm
- keep the meaning and depth intact

Then mark:

- `article.humanizer.required = true`
- `article.humanizer.status = "done"`
- `article.humanizer.appliedAt = <ISO timestamp>`
- `article.humanizer.preferredSkill = "humanizer"`
- add notes in `article.humanizer.notes` if useful

Do not skip this step.

### 6. Validate the draft

```bash
node scripts/validate-draft.mjs --draft jobs/<job-id>/draft.json
```

Validation requires:

- research is present
- outline exists
- image plan exists
- article has 1 banner and at least 2 inline images
- the banner uses a 5:2 size such as `3200x1280`
- inline image blocks reference valid non-banner image keys
- every image has a real purpose tied to the article
- blocked visual elements such as QR codes or political/public figures are not requested
- humanizer status is `done`

### 7. Generate images

Normal end-user flow:

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json
```

Default behavior:

- use the managed relay gateway by default
- do not require the user to configure a provider API key
- let the gateway own billing and provider credentials
- if the gateway says recharge or payment is required, stop and tell the user to recharge first
- if the gateway returns an error, stop and report it instead of silently changing provider mode

Billing note:

- this is a paid skill when it runs through the managed gateway
- Tavily research and production image generation both have real external cost
- if the user sees a recharge prompt, billing prompt, or insufficient-balance message, that is expected and they need to recharge before the workflow can continue
- when needed, check the gateway state with `node scripts/query-gateway-balance.mjs`

Direct provider mode is only for developer debugging:

```bash
node scripts/generate-images.mjs --draft jobs/<job-id>/draft.json --direct --env-file /path/to/.env
```

### 8. Render the review package

```bash
node scripts/render-review.mjs --draft jobs/<job-id>/draft.json --out jobs/<job-id>/review.single.html
```

This writes:

- `review.single.html`
- `artifacts.json`

The HTML page should show:

- user brief
- research summary and source list
- exemplar article list
- article structure
- image plan
- the 5:2 title banner
- the full-width banner with HTML title/subtitle overlay
- final article with embedded images
- humanizer status

The HTML page must not show:

- raw image prompts
- hidden generation parameters
- placeholder image slots instead of real generated images

### 9. Export the publish package

```bash
node scripts/export-publish-package.mjs --draft jobs/<job-id>/draft.json
```

This writes:

- `publish/article.md`
- `publish/article.html`
- `publish/article.txt`
- `publish/sources.md`
- `publish/images/*`
- `publish-package.zip`
- updated `artifacts.json`

The ZIP is the real handoff package for the user to publish manually on their chosen platform.

### 10. Deliver the review HTML

After the review HTML exists, send it back to the current conversation:

```bash
node scripts/deliver-review.mjs --file jobs/<job-id>/review.single.html --caption "审核页已生成"
```

### 11. Deliver the publish ZIP

After the ZIP exists, send it back to the same conversation:

```bash
node scripts/deliver-review.mjs --file jobs/<job-id>/publish-package.zip --caption "发布压缩包已生成"
```

### 12. Stop after delivery

Do not paste the full article inline after delivery.
Do not return local Linux or Windows filesystem paths in a remote chat as a substitute for attachments.
If either attachment fails to send, say so directly and stop.

## Files

- `scripts/init-job.mjs`: create a fresh single-article job scaffold
- `scripts/validate-draft.mjs`: validate research, plan, article, image, and humanizer requirements
- `scripts/discover-references.mjs`: run Tavily-first web research, fill `research.sources` and `research.findings`, and seed `research.exemplars` with likely strong reference articles
- `scripts/list-volc-image-models.mjs`: list available HuoShan image models
- `scripts/generate-images.mjs`: generate article images through gateway or direct provider mode
- `scripts/query-gateway-balance.mjs`: inspect relay billing state
- `scripts/render-review.mjs`: build `review.single.html` and emit `artifacts.json`
- `scripts/export-publish-package.mjs`: build the publishable article files, copy images, zip them, and update `artifacts.json`
- `scripts/update-humanizer.mjs`: mark the bundled humanizer pass as pending or done
- `scripts/update-approval.mjs`: update approval state
- `scripts/deliver-review.mjs`: deliver `review.single.html` or `publish-package.zip` back to the current chat

## Final Reply Pattern

After both deliveries succeed, keep the text reply short, for example:

```text
审核页和发布压缩包已回传，请直接审核附件。
```
