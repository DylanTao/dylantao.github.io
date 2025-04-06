---
layout: page
title: DesignWeaver
description: a tool that helps novices generate better design prompts by surfacing key visual dimensions, leading to more diverse and expert-aligned product designs
img: assets/img/publication_preview/designweaver.png
importance: -1
category: research
related_publications: true
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
    System demo of DesignWeaver
</div>

**DesignWeaver** is an AI-enabled tool that empowers novice designers by scaffolding the design process through key visual dimensions. By automatically extracting and organizing design elements from images and design documents, DesignWeaver enables users to generate richer text prompts and, in turn, more innovative design outputs _{% cite tao2024designweaver %}_.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/DesignWeaver_teaser.jpg" title="DesignWeaver_teaser" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 1: DesignWeaver: An AI-enabled product design interface for novices. The components include (A) Prompt Box, (B) Dimension Palette, (C) Image Gallery, and (D) Favorite Folder
</div>

## What is DesignWeaver?

DesignWeaver leverages advanced models (such as GPT-4 for text and DALL-E 3 for image generation) to:

- **Extract Design Dimensions:** Automatically identify and categorize key design elements (e.g., style, color, material) from user-provided documents.
- **Guide Prompt Engineering:** Offer an interactive prompt box that blends user input with expert-recommended design tags.
- **Iterate with Visual Feedback:** Enable users to refine their designs by linking textual prompts to AI-generated images.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/tool_design_system_diagram.jpg" title="tool_design_system_diagram" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 2: Overview of the iterative design process using DesignWeaver. The process involves four main stages: (1) Ingest the design document to extract initial dimensions and tags, (2) Refine and recommend dimensions to generate prompts, (3) Use prompts to render and refine images, and (4) Iterate based on new dimensions and tags inspired by the generated images.
</div>

## Key Features

- **Dimensional Scaffolding:** Creates a palette of design dimensions to help users explore the design space systematically.
- **Interactive Interface:** Combines a prompt box for text input with an image panel that displays generated visuals.
- **Iterative Refinement:** Supports a bi-directional feedback loop where users update prompts based on visual outputs.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/tool_design_all_features.jpg" title="tool_design_all_features" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 3: User Interface of DesignWeaver. The UI facilitates structured dimensional tagging and interactive exploration of AI-generated designs. Key features include a design document for guidance, a prompt box for input, a dimension palette for organizing and modifying design aspects, and an image panel displaying generated outputs. Users can add or delete dimensions, tag designs, view detailed image information, and curate favorite designs for final selection. This workflow supports iterative refinement and creativity.
</div>

## User Study & Results

A user study involving 52 novice designers revealed that DesignWeaver:

- Encouraged longer and more nuanced text prompts.
- Led to the creation of more diverse and innovative images.
- Enhanced the overall creative exploration and articulation of design ideas.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/user_study_workflow.jpg" title="user_study_workflow" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 4: Workflow of the user study.
</div>

## Implementation Highlights

- **Frontend:** Built with React to ensure a responsive and intuitive user experience.
- **Backend:** Powered by Python, with Firebase and Google FireStore managing data and image storage.
- **AI Integration:** Utilizes GPT-4 for prompt generation and DALL-E 3 for image synthesis, ensuring high-quality design outputs.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/project_pics/designweaver/user_study_baseline.jpg" title="user_study_baseline" class="img-fluid rounded z-depth-1" %}
    </div>
</div>
<div class="caption">
    Figure 5: The baseline interface mimics a standard text-to-image setup, excluding scaffolding components.
</div>

## Discussion & Impact

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

DesignWeaver demonstrates that integrating AI into the design process can significantly enhance the creative workflow, making expert-level design concepts accessible to novices. Its dimensional scaffolding approach not only improves prompt quality but also fosters innovative design thinking.

## BibTeX

{% raw %}

```html
@inproceedings{tao2024designweaver, 
title = {DesignWeaver: Dimensional Scaffolding for Text-to-Image Product Design}, 
author = {Tao, Sirui and Liang, Ivan and Peng, Cindy and Wang, Zhiqing and Palani, Srishti and Dow, Steven}, booktitle = {Conference on Human Factors in Computing Systems}, 
year = {2025}
}
```

{% endraw %}
