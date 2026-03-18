# Draft Schema

Use this schema for `jobs/<job-id>/draft.json`.

## Root

```json
{
  "jobId": "20260314-153000-user-topic",
  "theme": "用户指定主题",
  "direction": "用户指定方向",
  "brief": "用户给出的简要思路",
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
      "topic": "用户指定主题",
      "direction": "用户指定方向",
      "brief": "用户给出的简要思路"
    },
    "searchQueries": [
      "用户主题 关键词 1",
      "用户主题 关键词 2"
    ],
    "sources": [
      {
        "title": "Example source title",
        "url": "https://example.com/report",
        "publishedAt": "2026-03-13",
        "note": "Explain exactly what this source contributes to the article."
      }
    ],
    "exemplars": [
      {
        "title": "同主题高质量范文标题",
        "url": "https://example.com/high-performing-article",
        "platform": "mp.weixin.qq.com",
        "publishedAt": "2026-03-12",
        "engagementEvidence": "Search snippet or page text shows 10w+, high likes, viral wording, or clearly state that manual verification is still needed.",
        "reason": "Explain what to borrow from this article: angle, structure, narrative rhythm, evidence handling, etc.",
        "takeaways": [
          "A concrete editorial lesson from this exemplar.",
          "Another concrete structural takeaway."
        ],
        "qualitySignals": [
          "出现高传播描述",
          "更像深度文章而非浅层摘要"
        ]
      }
    ],
    "findings": [
      "A concrete finding derived from the sources.",
      "Another concrete finding derived from the sources."
    ]
  },
  "plan": {
    "angle": "State the article's chosen angle based on the user's direction.",
    "audience": "The intended reader group",
    "promise": "What the reader should understand or gain after reading",
    "sections": [
      {
        "heading": "Section heading",
        "purpose": "What this section is doing for the article",
        "keyPoints": [
          "Key point 1",
          "Key point 2"
        ]
      }
    ],
    "imagePlan": [
      {
        "key": "banner-hero",
        "placement": "banner",
        "size": "3200x1280",
        "purpose": "Top title banner in a 5:2 ratio",
        "prompt": "Prompt for a clean title banner background that matches the article topic",
        "alt": "Banner alt text",
        "caption": "Banner caption"
      },
      {
        "key": "image-1",
        "placement": "middle",
        "size": "2400x1600",
        "purpose": "What this image adds to the article",
        "relatedSectionHeading": "The section this image supports",
        "scene": "A concrete usage scene or article-related moment",
        "prompt": "First inline image prompt focused on a concrete usage scene",
        "alt": "First inline image alt text",
        "caption": "First inline image caption"
      },
      {
        "key": "image-2",
        "placement": "middle",
        "size": "2400x1600",
        "purpose": "What this image adds to the article",
        "relatedSectionHeading": "The section this image supports",
        "scene": "A second concrete usage scene or article-related moment",
        "prompt": "Second inline image prompt focused on a concrete usage scene",
        "alt": "Second inline image alt text",
        "caption": "Second inline image caption"
      }
    ]
  },
  "article": {
    "title": "Article title",
    "subtitle": "Article subtitle",
    "summary": "Summarize the article's core judgment in 1-2 sentences",
    "bannerImageKey": "banner-hero",
    "humanizer": {
      "required": true,
      "preferredSkill": "humanizer",
      "source": "bundled-humanizer",
      "status": "done",
      "appliedAt": "2026-03-14T07:45:00.000Z",
      "notes": [
        "Removed vague authority phrases.",
        "Tightened section transitions."
      ]
    },
    "blocks": [
      { "type": "paragraph", "text": "Opening paragraph" },
      { "type": "image", "imageKey": "image-1", "caption": "Image caption" },
      { "type": "heading", "text": "Section heading" },
      { "type": "paragraph", "text": "Body paragraph" },
      { "type": "image", "imageKey": "image-2", "caption": "Second image caption" },
      { "type": "list", "items": ["Point 1", "Point 2"] }
    ],
    "images": [
      {
        "key": "banner-hero",
        "prompt": "Prompt for the 5:2 title banner background",
        "alt": "Banner alt text",
        "caption": "Banner caption",
        "placement": "banner",
        "size": "3200x1280",
        "purpose": "Top title banner in a 5:2 ratio"
      },
      {
        "key": "image-1",
        "relatedSectionHeading": "The section this image supports",
        "scene": "A concrete usage scene or article-related moment",
        "prompt": "Prompt for first inline image generation",
        "alt": "First inline image alt text",
        "caption": "First inline image caption",
        "placement": "middle",
        "size": "2400x1600",
        "purpose": "What this image adds to the article"
      },
      {
        "key": "image-2",
        "relatedSectionHeading": "The section this image supports",
        "scene": "A second concrete usage scene or article-related moment",
        "prompt": "Second inline image prompt",
        "alt": "Second inline image alt text",
        "caption": "Second inline image caption",
        "placement": "middle",
        "size": "2400x1600",
        "purpose": "What this image adds to the article"
      }
    ]
  },
  "notes": []
}
```

## Validation Rules

- `research.searchQueries` must contain at least 1 query.
- `research.sources` must contain at least 2 sources.
- `research.exemplars` must contain at least 1 reference article.
- Every source needs `title`, `url`, and `note`.
- Every exemplar needs `title`, `url`, `engagementEvidence`, and `reason`.
- `plan.sections` must be non-empty.
- `plan.imagePlan` must contain at least 3 image plans.
- `plan.imagePlan` must contain one banner image with `placement = "banner"` and a 5:2 `size`.
- `article.title` and `article.summary` are required.
- `article.bannerImageKey` is required and must point to a 5:2 banner image.
- `article.images` must contain at least 3 images: 1 banner + 2 inline images.
- Inline image entries should include `size`, typically `2400x1600` or another platform-appropriate ratio above the current upstream minimum pixel requirement.
- Inline image entries should preferably include `relatedSectionHeading` and `scene` so the visuals stay tied to the exact paragraph or usage scenario.
- `article.blocks` must contain at least 2 inline image blocks besides the banner.
- Every `image` block must reference an existing `article.images[*].key`.
- `article.humanizer.required` must stay `true`.
- `article.humanizer.status` must be `done` before final validation passes.

## Writing Notes

- Use `blocks` as the exact reading order.
- Put the banner at the title level, then use at least 2 inline image blocks inside the body flow.
- Keep image placement intentional. Images should support argument progression, not act as decorative filler.
- The banner image should be a clean visual background only. Put the title text on the HTML layer instead of baking text into the generated image.
- Inline images should depict article-specific scenes, product usage, workflow moments, or environments from the actual section. Avoid generic symbolic illustrations.
- Do not request QR codes, barcodes, payment codes, political/public figures, propaganda visuals, celebrity portraits, or scam-like marketing cards.
- Keep source notes concrete. Say what each source contributes.
- Use exemplars to borrow angle and structure, not to copy sentences.
