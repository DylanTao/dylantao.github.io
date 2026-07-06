---
layout: post
title: technical papers i want to remember
date: 2026-07-05 22:00:00
description: Short notes on technical papers that changed how I explain AI systems, research artifacts, and model behavior.
tags: hci research gen-ai reading-notes papers diffusion-models
categories: reflections
related_posts: false
blog_nav_pool: personal
blog_nav_track: research
blog_nav_stage: 5
blog_nav_prev:
  - /blog/2026/prototyping-to-understand-humans/
permalink: /blog/2026/technical-papers-i-want-to-remember/
toc:
  beginning: true
---

_I want a place to keep technical papers that are too useful to disappear into my tabs._

Some papers are not directly "my work," but they change how I explain things. They give me a sharper phrase, a better causal story, or a cleaner warning sign. I do not always need to write a full essay about them. Sometimes I just want a small handle I can come back to later.

So this is a running note for technical papers I want to remember.

The format is simple:

- why I'm saving this
- my TL;DR
- what it changes in my thinking
- where it might connect

## Locality in Image Diffusion Models Emerges from Data Statistics

Artem Lukoianov, Chenyang Yuan, Justin Solomon, and Vincent Sitzmann. NeurIPS 2025 Spotlight.

Project page: [Locality in Image Diffusion Models Emerges from Data Statistics](https://locality.lukoianov.com/)

### Why I'm saving this

This paper is a clean reminder that model behavior is not always best explained by architecture alone.

Sometimes the important structure comes from the data.

That sounds obvious at a high level, but the paper makes it very concrete. It looks at locality in image diffusion models: the pattern where an output pixel mostly depends on a limited neighborhood of input pixels. Previous work connected locality to generalization. A tempting explanation is that locality comes from CNN architecture, especially because many diffusion models use U-Nets.

This paper shows a different story. U-Nets, DiTs, and even a simple linear denoiser can show similar locality patterns on the same data. The locality changes when the dataset changes.

The sentence I want to remember is:

> The model inherits a neighborhood from the dataset.

### My TL;DR

Diffusion models have a closed-form optimal denoiser under the training objective. But when this empirical optimal denoiser is used for sampling, it tends to memorize training data. Trained deep diffusion models generalize and produce novel images.

The paper asks what helps bridge memorization and generalization.

Their answer is locality.

The key result is that locality is not just an architectural bias from CNNs. It emerges from the statistics of the data. On natural images, the learned locality is compact and roughly isotropic. On more specialized datasets, like centered face datasets, the sensitivity fields can become nonlocal and face-like. If the dataset has an artificial correlation pattern, the learned locality can reflect that too.

### What it changes in my thinking

I want to be more careful when I explain AI systems.

It is easy to say:

> The model does this because the architecture has this property.

Sometimes that is true. But this paper is a good example of why the explanation may live somewhere else: in the data distribution, the objective, the task setup, or the interaction among all of them.

For my own thinking, the useful move is to ask:

> Where did this behavior come from?

Not just "what did the model do?" but "what part of the system made that behavior likely?"

That feels useful for reading AI papers, but also for HCI. When a prototype works, the interesting question is often not only whether it works. The interesting question is what explains the behavior we are seeing.

Is it the model? The data? The interface? The task distribution? The evaluation setup? The way users adapt around the tool?

Good research should help reveal that structure.

### Where it might connect

This connects lightly to my note on [prototyping to understand humans](/blog/2026/prototyping-to-understand-humans/).

In that post, I was asking what makes HCI research valuable when AI makes it easier to build plausible systems. This paper gives me one more way to say it: a good artifact should help us see where behavior comes from.

The locality result itself is about image diffusion models. The broader habit is what I want to keep: when a system looks intelligent, look for the surrounding structure that made the intelligence possible.

That is the first note. I want more of these: small technical reads that give me better language for explaining AI systems.
