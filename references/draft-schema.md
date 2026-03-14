# Draft Schema

Use this schema for `jobs/<job-id>/draft.json`.

## Root

```json
{
  "jobId": "20260314-153000-openclaw",
  "theme": "OpenClaw 风险通报",
  "direction": "科技安全",
  "brief": "做成有深度、有判断的专业图文",
  "createdAt": "2026-03-14T07:30:00.000Z",
  "status": "draft",
  "approval": {
    "status": "pending",
    "approvedBy": null,
    "approvedAt": null,
    "note": null
  },
  "research": {
    "userIntent": {
      "topic": "OpenClaw 风险通报",
      "direction": "科技安全",
      "brief": "做成有深度、有判断的专业图文"
    },
    "searchQueries": [
      "OpenClaw agent security latest analysis",
      "OpenClaw risk report March 2026"
    ],
    "sources": [
      {
        "title": "Example source title",
        "url": "https://example.com/report",
        "publishedAt": "2026-03-13",
        "note": "Provides the core incident facts and dates."
      }
    ],
    "findings": [
      "Finding 1",
      "Finding 2"
    ]
  },
  "plan": {
    "angle": "Explain why the risk matters now and where teams misjudge it.",
    "audience": "产品负责人、技术负责人、对 AI 安全敏感的从业者",
    "promise": "读完能理解事件、风险和实际动作建议",
    "sections": [
      {
        "heading": "发生了什么",
        "purpose": "用最短篇幅建立事实和时间线",
        "keyPoints": [
          "Key point 1",
          "Key point 2"
        ]
      }
    ],
    "imagePlan": [
      {
        "key": "hero-scene",
        "placement": "opening",
        "purpose": "建立文章开场氛围",
        "prompt": "Prompt for image generation",
        "alt": "封面图替代文本",
        "caption": "封面图图注"
      },
      {
        "key": "risk-detail",
        "placement": "middle",
        "purpose": "支持核心风险段落",
        "prompt": "Second image prompt",
        "alt": "第二张图替代文本",
        "caption": "第二张图图注"
      }
    ]
  },
  "article": {
    "title": "文章标题",
    "subtitle": "文章副标题",
    "summary": "用 1-2 句话概括这篇文章的判断",
    "humanizer": {
      "required": true,
      "source": "bundled-humanizer",
      "status": "done",
      "appliedAt": "2026-03-14T07:45:00.000Z",
      "notes": [
        "Removed vague authority phrases.",
        "Tightened section transitions."
      ]
    },
    "blocks": [
      { "type": "paragraph", "text": "开场段落" },
      { "type": "image", "imageKey": "hero-scene", "caption": "封面图图注" },
      { "type": "heading", "text": "小标题" },
      { "type": "paragraph", "text": "正文段落" },
      { "type": "image", "imageKey": "risk-detail", "caption": "第二张图图注" },
      { "type": "list", "items": ["要点 1", "要点 2"] }
    ],
    "images": [
      {
        "key": "hero-scene",
        "prompt": "Prompt for image generation",
        "alt": "封面图替代文本",
        "caption": "封面图图注",
        "placement": "opening",
        "purpose": "建立文章开场氛围"
      },
      {
        "key": "risk-detail",
        "prompt": "Second image prompt",
        "alt": "第二张图替代文本",
        "caption": "第二张图图注",
        "placement": "middle",
        "purpose": "支持核心风险段落"
      }
    ]
  },
  "notes": []
}
```

## Validation Rules

- `research.searchQueries` must contain at least 1 query.
- `research.sources` must contain at least 2 sources.
- Every source needs `title`, `url`, and `note`.
- `plan.sections` must be non-empty.
- `plan.imagePlan` must contain at least 2 image plans.
- `article.title` and `article.summary` are required.
- `article.images` must contain at least 2 images.
- `article.blocks` must contain at least 2 image blocks.
- Every `image` block must reference an existing `article.images[*].key`.
- `article.humanizer.required` must stay `true`.
- `article.humanizer.status` must be `done` before final validation passes.

## Writing Notes

- Use `blocks` as the exact reading order.
- Keep image placement intentional. Images should support argument progression, not act as decorative filler.
- Keep source notes concrete. Say what each source contributes.
