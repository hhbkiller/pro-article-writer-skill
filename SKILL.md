---
name: pro-article-writer
description: Research-first professional illustrated article writer that turns a user's topic, direction, and rough idea into one deep, detailed, human-sounding article with at least two generated images and a review-first HTML package. Use when the user asks for 生成图文, 图文内容, 配图文章, 写一篇软文, 写软文, 深度推文, or wants one high-quality article instead of multi-platform variants.
---

# Pro Article Writer

Write one strong illustrated article.

Do not generate three platform versions.
Do not optimize for Toutiao, Xiaohongshu, and X separately.
Article quality is the product.

This skill owns:

- research
- structure planning
- single-article writing
- bundled humanizer pass
- image prompt planning and image generation
- HTML review artifact generation

This skill does not own remote delivery.
The runtime must send `review.single.html` by reading `artifacts.json` in the current request context only.

## Hard Rules

- Start from the user's topic, direction, and brief idea.
- Search for relevant articles, current information, and useful source material before outlining.
- Record the sources inside the draft.
- Decide article structure and image plan before drafting prose.
- Plan at least 2 images.
- Final review output must contain at least 2 real generated images, not placeholders.
- Write one detailed article, not a platform pack.
- Run the bundled humanizer pass after drafting and before image generation.
- In normal end-user flow, generate images through the managed relay gateway only.
- If gateway image generation fails, report the failure plainly and stop.
- Do not silently switch to direct provider mode unless the user explicitly asks for developer debugging.
- Do not expose raw image prompts in the user-facing HTML review page.
- Stop after local artifacts are ready.
- Never scan sessions or guess delivery targets.

If the user only says `生成图文`, `图文内容`, `写软文`, or similar, do not answer inline with finished prose.
Generate the review package instead.

## Read These Files

- Read [references/draft-schema.md](./references/draft-schema.md) when filling or checking `draft.json`.
- Read [references/humanizer.md](./references/humanizer.md) before the final rewrite pass.

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
- search the web for relevant articles, reports, posts, and primary material
- prefer recent or primary sources when the topic is time-sensitive
- record exact URLs, dates, and what each source contributes
- summarize findings into concrete takeaways instead of vague impressions

Minimum research bar:

- at least 2 sources
- at least 1 concrete search query
- at least 1 findings summary entry

### 3. Plan the article

Before drafting paragraphs:

- define the angle
- define the audience
- define the article promise
- map section-by-section structure
- plan image placement and purpose

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
There must be at least 2 images and at least 2 image blocks.

### 5. Run the bundled humanizer pass

After the first full draft is written:

- read [references/humanizer.md](./references/humanizer.md)
- rewrite the article so it sounds human, specific, and lived-in
- remove AI-sounding abstractions, promo language, vague attributions, and formulaic rhythm
- keep the meaning and depth intact

Then mark:

- `article.humanizer.required = true`
- `article.humanizer.status = "done"`
- `article.humanizer.appliedAt = <ISO timestamp>`
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
- article has at least 2 images
- image blocks reference valid image keys
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
- if the gateway returns an error, stop and report it instead of silently changing provider mode

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
- article structure
- image plan
- final article with embedded images
- humanizer status

The HTML page must not show:

- raw image prompts
- hidden generation parameters
- placeholder image slots instead of real generated images

### 9. Stop after artifacts

Do not send attachments yourself.
Do not call chat delivery tools.
Do not inspect history to guess where to send the file.

The runtime must consume `artifacts.json` and deliver the HTML attachment back to the current request conversation only.

## Files

- `scripts/init-job.mjs`: create a fresh single-article job scaffold
- `scripts/validate-draft.mjs`: validate research, plan, article, image, and humanizer requirements
- `scripts/list-volc-image-models.mjs`: list available HuoShan image models
- `scripts/generate-images.mjs`: generate article images through gateway or direct provider mode
- `scripts/query-gateway-balance.mjs`: inspect relay billing state
- `scripts/render-review.mjs`: build `review.single.html` and emit `artifacts.json`
- `scripts/update-humanizer.mjs`: mark the bundled humanizer pass as pending or done
- `scripts/update-approval.mjs`: update approval state
- `scripts/deliver-review.mjs`: manual developer-only helper, not part of the public skill contract

## Final Reply Pattern

After rendering succeeds, keep the text reply short, for example:

```text
审核包已生成，等待宿主按当前请求上下文发送 HTML 附件。
```
