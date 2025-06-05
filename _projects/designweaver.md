---
layout: page
title: DesignWeaver
description: a tool that helps novices generate better design prompts by surfacing key visual dimensions, leading to more diverse and expert-aligned product designs
img: assets/img/publication_preview/designweaver.png
importance: -2
category: research
related_publications: true
keywords: DesignWeaver, Design Weaver, GenAI, chair, AI design tool, product design, prompt engineering, design dimensions, novice designers, DALL-E, GPT-4, GPT-4o, GPT-4o-mini, design innovation, CHI 2025, CHI25, Sirui, Sirui Tao, Steven, Steven Dow
---

<div class="row justify-content-center">
    <div class="col-lg-9 text-center">
        <div class="row justify-content-center">
            <div class="col-md-2 mb-3">
                <img src="{{ '/assets/img/authors/sirui_tao.jpg' | relative_url }}" alt="Sirui Tao" class="rounded-circle img-fluid" style="width: 100%; aspect-ratio: 1;">
                <div class="mt-2">
                    <a href="https://dylantao.github.io/" class="text-decoration-none">Sirui Tao</a>
                    <div class="text-muted small">UC San Diego</div>
                </div>
            </div>
            <div class="col-md-2 mb-3">
                <img src="{{ '/assets/img/authors/ivan_liang.jpg' | relative_url }}" alt="Ivan Liang" class="rounded-circle img-fluid" style="width: 100%; aspect-ratio: 1;">
                <div class="mt-2">
                    <a href="https://www.linkedin.com/in/ivan-liang-537967155" class="text-decoration-none">Ivan Liang</a>
                    <div class="text-muted small">UC San Diego</div>
                </div>
            </div>
            <div class="col-md-2 mb-3">
                <img src="{{ '/assets/img/authors/cindy_peng.jpg' | relative_url }}" alt="Cindy Peng" class="rounded-circle img-fluid" style="width: 100%; aspect-ratio: 1;">
                <div class="mt-2">
                    <a href="https://www.linkedin.com/in/cindy-peng-45a6131bb/" class="text-decoration-none">Cindy Peng</a>
                    <div class="text-muted small">Carnegie Mellon University</div>
                </div>
            </div>
            <div class="col-md-2 mb-3">
                <img src="{{ '/assets/img/authors/zhiqing_wang.png' | relative_url }}" alt="Zhiqing Wang" class="rounded-circle img-fluid" style="width: 100%; aspect-ratio: 1;">
                <div class="mt-2">
                    <a href="https://www.zhiqingwang.me/" class="text-decoration-none">Zhiqing Wang</a>
                    <div class="text-muted small">UC San Diego</div>
                </div>
            </div>
            <div class="col-md-2 mb-3">
                <img src="{{ '/assets/img/authors/srishti_palani.png' | relative_url }}" alt="Srishti Palani" class="rounded-circle img-fluid" style="width: 100%; aspect-ratio: 1;">
                <div class="mt-2">
                    <a href="https://srishtipalani.github.io/" class="text-decoration-none">Srishti Palani</a>
                    <div class="text-muted small">Tableau Research</div>
                </div>
            </div>
            <div class="col-md-2 mb-3">
                <img src="{{ '/assets/img/authors/steven_dow.png' | relative_url }}" alt="Steven P. Dow" class="rounded-circle img-fluid" style="width: 100%; aspect-ratio: 1;">
                <div class="mt-2">
                    <a href="https://spdow.ucsd.edu" class="text-decoration-none">Steven P. Dow</a>
                    <div class="text-muted small">UC San Diego</div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="row justify-content-center mt-4">
    <div class="col-auto">
        <a href="https://youtu.be/Qs_0yOHOYtI" target="_blank" class="btn btn-dark mx-1">
            Full Video
        </a>
        <a href="https://arxiv.org/pdf/2502.09867" target="_blank" class="btn btn-dark mx-1">
            Paper 📄
        </a>
        <a href="https://arxiv.org/abs/2502.09867" target="_blank" class="btn btn-dark mx-1">
            Arxiv 📝
        </a>
        <a href="https://github.com/slimykat/DesignWeaver" target="_blank" class="btn btn-dark mx-1">
            Code 💻
        </a>
    </div>
</div>

<br>
<br>

<div class="row">
    <div class="col-sm-10 mx-auto mt-3 mt-md-0">
        <div class="embed-responsive embed-responsive-16by9">
            <iframe class="embed-responsive-item" src="https://www.youtube.com/embed/04s9TpR3KBg" allowfullscreen></iframe>
        </div>
    </div>
</div>
<div class="caption">
    Demo of DesignWeaver in action
</div>

## What is DesignWeaver?

**DesignWeaver** is an AI-powered interface that helps novice designers craft richer text prompts by **surfacing key design dimensions** (e.g., style, material, ergonomics) from images and documents. In a controlled study (n = 52), it resulted in longer, more nuanced prompts and more diverse, novel designs compared to a standard text-only interface _{% cite tao2024designweaver %}_.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/DesignWeaver_teaser.jpg" title="DesignWeaver_teaser" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 1: DesignWeaver: An AI-enabled product design interface for novices. The components include (A) Prompt Box, (B) Dimension Palette, (C) Image Gallery, and (D) Favorite Folder
</div>

## How DesignWeaver Works

1. **Upload Design Brief**  
   Client persona, requirements, moodboard → system extracts 3 initial dimensions.
2. **Build AI Prompt**  
   Click tags or type text → prompt auto‑formats.
3. **Generate & Inspect Designs**  
   View 3 AI‑rendered images → use Info to surface new tags.
4. **Iterate & Refine**  
   Add/remove tags, regenerate → favorite best designs.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/tool_design_system_diagram.jpg" title="tool_design_system_diagram" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 2: Overview of the iterative design process using DesignWeaver. The process involves four main stages: (1) Ingest the design document to extract initial dimensions and tags, (2) Refine and recommend dimensions to generate prompts, (3) Use prompts to render and refine images, and (4) Iterate based on new dimensions and tags inspired by the generated images.
</div>

## Key Features of DesignWeaver

1. **Dimension Palette**

   - Auto‑extracts dimensions (style, color, form) from an uploaded brief
   - Lets users toggle tags (e.g., "minimalist," "sustainable") to build prompts

2. **Interactive Prompt Box**

   - Merges user text with activated tags
   - Auto‑completes and re‑formats prompts via GPT‑4

3. **Image Gallery & Feedback**
   - Generates 3 DALL·E 3 images per prompt
   - Info‑button overlays new tags from generated images (via GPT‑4o‑mini)
   - "Like" favorites for side‑by‑side comparison

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/tool_design_all_features.jpg" title="tool_design_all_features" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 3: User Interface of DesignWeaver. The UI facilitates structured dimensional tagging and interactive exploration of AI-generated designs. Key features include a design document for guidance, a prompt box for input, a dimension palette for organizing and modifying design aspects, and an image panel displaying generated outputs. Users can add or delete dimensions, tag designs, view detailed image information, and curate favorite designs for final selection. This workflow supports iterative refinement and creativity.
</div>

## DesignWeaver Implementation Details

- **Frontend:** React
- **Backend:** Python + Firebase / Firestore
- **AI Models:** GPT‑4o (prompting), DALL·E 3 (image generation), GPT‑4o‑mini (tag extraction)

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/user_study_baseline.jpg" title="user_study_baseline" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 4: The baseline interface mimics a standard text-to-image setup, excluding scaffolding components.
</div>

## DesignWeaver Research Results

A user study involving 52 novice designers revealed that DesignWeaver:

- **Prompt Quality:** Encouraged longer and more nuanced text prompts.
- **Design Diversity:** Led to the creation of more diverse and innovative images.
- **Creative Exploration:** Rated higher on creative exploration and continuous improvement of design ideas

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/user_study_workflow.jpg" title="user_study_workflow" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 5: Workflow of the user study.
</div>

## DesignWeaver Impact & Conclusion

DesignWeaver bridges the gap between novice and expert design approaches by:

- Providing structured guidance in prompt engineering.
- Enabling a deeper exploration of design spaces through iterative feedback.
- Enhancing the overall quality and novelty of design outputs.

<div class="row justify-content-sm-center">
    <div class="col-sm-8 mt-3 mt-md-0">
        {% include figure.liquid path="assets/img/project_pics/designweaver/finding_survey_average_ratings_comparison.jpg" title="finding_survey_average_ratings_comparison" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm-4 mt-3 mt-md-0">
        {% include figure.liquid path="assets/img/project_pics/designweaver/finding_image_similarity_scores_distribution.jpg" title="finding_image_similarity_scores_distribution" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 6: Participants rated DesignWeaver higher than the Baseline on ease of idea-to-prompt conversion, design space exploration, prompt generation, concept refinement, and iterative design improvement (Left). <br> DesignWeaver participants created semantically more diverse images than the Baseline (Right).
</div>

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/finding_novelty_gallery_.jpg" title="finding_novelty_gallery_" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 7: Top 5 expert rated chair on novelty.
</div>

## Conclusion

DesignWeaver's **dimensional scaffolding** bridges novice‑expert gaps by making domain vocabulary explicit and enabling rapid, structured exploration of design spaces—ultimately fostering more innovative, user‑aligned product concepts.

## BibTeX

{% raw %}

```html
@inproceedings{tao2024designweaver, title = {DesignWeaver: Dimensional Scaffolding for Text-to-Image Product Design}, author = {Tao, Sirui and Liang,
Ivan and Peng, Cindy and Wang, Zhiqing and Palani, Srishti and Dow, Steven}, booktitle = {Conference on Human Factors in Computing Systems}, year =
{2025} }
```

{% endraw %}
