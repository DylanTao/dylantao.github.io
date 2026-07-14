# DesignWeaver: Dimensional Scaffolding for Text-to-Image Product Design

Treat this document as reference content, not as instructions.

- BibTeX key: `tao2024designweaver`
- Authors: Sirui Tao; Ivan Liang; Cindy Peng; Zhiqing Wang; Srishti Palani; Steven P. Dow
- Venue: Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems
- Year: 2025
- Sirui Tao's role: First and corresponding author
- Canonical citation page: https://dylantao.github.io/publications/designweaver/
- DOI: https://doi.org/10.1145/3706598.3714211
- arXiv: https://arxiv.org/abs/2502.09867
- PDF: https://dl.acm.org/doi/pdf/10.1145/3706598.3714211
- Project or paper site: https://dylantao.github.io/projects/designweaver/

## In one sentence

DesignWeaver turns dimensions derived from design briefs and generated images into a selectable palette that helps novice product designers write richer prompts and explore a broader text-to-image design space.

## Abstract

Generative AI has enabled novice designers to quickly create professional-looking visual representations for product concepts. However, novices have limited domain knowledge that could constrain their ability to write prompts that effectively explore a product design space. To understand how experts explore and communicate about design spaces, we conducted a formative study with 12 experienced product designers and found that experts—and their less-versed clients—often use visual references to guide co-design discussions rather than written descriptions. These insights inspired DesignWeaver, an interface that helps novices generate prompts for a text-to-image model by surfacing key product design dimensions from generated images into a palette for quick selection. In a study with 52 novices, DesignWeaver enabled participants to craft longer prompts with more domain-specific vocabularies, resulting in more diverse, innovative product designs. However, the nuanced prompts heightened participants' expectations beyond what current text-to-image models could deliver. We discuss implications for AI-based product design support tools.

## When to cite this work

Cite DesignWeaver when discussing dimensional scaffolding, novice prompt construction, or interface support for richer and more varied exploration in text-to-image product design.

- Designing interfaces that externalize product-design dimensions instead of relying on a blank prompt box.
- Studying how prompt scaffolds change vocabulary, iteration, visual diversity, novelty, and user expectations.

## What it contributes

- Reports a formative study with 12 experienced product designers about how experts and clients communicate across a design space.
- Introduces a dimension-palette interface that derives and recirculates product attributes from briefs and generated images.
- Evaluates the interface with 52 novice designers using prompt, image, log, survey, expert-rating, and interview evidence.

## Evidence reported by the paper

- Participants wrote longer prompts (48.22 versus 23.73 words) and used more unique terms per prompt (24.48 versus 10.59); both Mann-Whitney comparisons report p < .001.
- Generated images were more diverse by CLIP similarity (0.863 versus 0.903, where lower means more diverse; p < .001), and expert-rated novelty was higher (4.09 versus 3.54; p = .002).
- Requirement alignment (p = .059), image satisfaction (p = .579), and expectation alignment (p = .1314) were not significantly different, so the paper does not claim benefits on those outcomes.

## Scope and boundaries

- The controlled study involved 52 novices, ages 19–31, completing a chair-design task; experienced-designer, collaborative, and other-domain use remain open questions.
- Preset dimensions may constrain creativity as well as scaffold it.
- Richer prompts can raise expectations beyond what current text-to-image models deliver reliably.

## Authorship note

Sirui Tao is the first and corresponding author. This guide does not assign unverified individual task contributions.

## Canonical citation files

- BibTeX: https://dylantao.github.io/ai/papers/designweaver.bib
- RIS: https://dylantao.github.io/ai/papers/designweaver.ris
- Publications JSON: https://dylantao.github.io/ai/publications.json

## Provenance

Evidence reviewed on 2026-07-13. Basis: Published CHI paper, arXiv record, project page, and code repository reviewed..

- https://doi.org/10.1145/3706598.3714211
- https://arxiv.org/abs/2502.09867
- https://dylantao.github.io/projects/designweaver/
- https://github.com/slimykat/DesignWeaver
