# Bundled Humanizer

This file bundles the working rules from the public `humanizer` skill on OpenClawHub so this writer skill can run a humanization pass without requiring a separate install.

Source:

- OpenClawHub skill: `biostartechnology/humanizer`
- Upstream skill name: `humanizer`

Use this reference after the first article draft is complete and before image generation.

## Goal

Make the article sound like a real person wrote it:

- specific
- natural
- varied in rhythm
- clear in judgment
- free of obvious AI phrasing

Do not flatten the article into bland copy.
The point is not only to remove AI fingerprints. The point is to keep depth and add pulse.

## Keep

- the article's meaning
- concrete facts
- the intended tone
- the author's judgment
- useful detail

## Remove or Rewrite

### Inflated significance

Cut phrases like:

- pivotal moment
- evolving landscape
- serves as a testament
- underscores the significance
- reflects a broader trend

Replace with direct factual statements.

### Promotional language

Cut phrases like:

- vibrant
- breathtaking
- groundbreaking
- renowned
- stunning
- rich cultural heritage

Replace with plain specifics.

### Fake depth with `-ing`

Cut patterns like:

- highlighting
- underscoring
- symbolizing
- fostering
- showcasing
- ensuring

Especially when they are attached to vague abstractions.

### Vague attributions

Cut phrases like:

- experts believe
- observers say
- industry reports suggest
- some critics argue

Replace with named sources or direct statements.

### AI vocabulary

Watch for:

- additionally
- crucial
- delve
- enhance
- fostering
- interplay
- intricate
- landscape
- pivotal
- showcase
- underscore
- valuable

Prefer simpler, more direct wording.

### Formulaic structures

Cut or reduce:

- not only ... but also ...
- it's not just ... it's ...
- rigid rule-of-three phrasing
- generic challenge / future outlook sections
- generic positive conclusions

### Surface polish that still feels empty

Even if the wording is clean, rewrite if the article still has these problems:

- every sentence has the same rhythm
- no opinion or judgment
- no uncertainty where uncertainty is real
- no lived texture
- no specific emotional or practical stakes

## Add Back Human Texture

- let some sentences be short
- let some sentences take their time
- state a view when a view is warranted
- admit uncertainty when uncertainty is real
- prefer grounded observations over grand framing
- use one sharp line when the article needs force

## Final Pass Checklist

Before marking `article.humanizer.status = "done"`, confirm:

- the article no longer reads like generated marketing copy
- broad claims are tied to facts or sources
- transitions feel natural instead of templated
- section openings are not repetitive
- the ending lands on a concrete point, not a vague uplift
- the article sounds credible when read aloud
