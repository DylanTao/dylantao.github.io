---
layout: page
title: Context-Aware Encoding for LLMs
description: A tree-of-thoughts context encoding experiment for improving retrieval and long-document contextual understanding.
img: assets/img/project_pics/context-aware-encoding/context-aware-encoding-teaser.png
image_aspect: 16 / 9
importance: 1
category: research
year: 2023
role: Builder
status: Prototype
github: https://github.com/DylanTao/CAC
hide_title: true
---

<section class="project-case-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">LLM context prototype - retrieval structure</p>
    <h1>Context-Aware Encoding for LLMs</h1>
    <p class="project-case-lede">
      I explored a tree-of-thoughts style encoding algorithm for organizing long-context material before it reaches a language model.
    </p>
    <div class="project-case-facts">
      <span>Context trees</span>
      <span>Retrieval paths</span>
      <span>Long documents</span>
      <span>Prototype</span>
    </div>
    <div class="project-case-actions">
      <a href="https://github.com/DylanTao/CAC" target="_blank" rel="noopener noreferrer">View code</a>
    </div>
  </div>
  <div class="project-case-media">
    {% include figure.liquid loading="eager" path="assets/img/project_pics/context-aware-encoding/context-aware-encoding-teaser.png" title="Context-aware encoding teaser" alt="Documents flowing into a branching context tree and an LLM interface" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary" aria-label="Context-aware encoding summary">
  <div>
    <span>Question</span>
    <p>Can context be organized as a navigable structure, rather than treated as a flat bundle of retrieved snippets?</p>
  </div>
  <div>
    <span>Build</span>
    <p>A compact encoding prototype that groups long-document context into branching relationships so retrieval has a shape the model can use.</p>
  </div>
  <div>
    <span>Lesson</span>
    <p>Better model behavior often starts before generation: with the representation, compression, and routing decisions that frame the prompt.</p>
  </div>
</section>

## Why it belongs here

This project is intentionally small, but it captures a useful thread in my work: interfaces and algorithms both shape what a person or model can notice. The prototype asks how we might preserve relationships across context instead of only retrieving fragments.

## What I learned

The interesting part was deciding what structure should travel with a query. A tree can make context easier to inspect, summarize, and route, but it also forces design choices about granularity, hierarchy, and what counts as relevant evidence.
