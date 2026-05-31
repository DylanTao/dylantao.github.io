---
layout: page
title: HCI Spooder-Man
description: A remixable guide for turning an academic website into a playful, human, and still-credible artifact.
img: assets/img/project_pics/hci-spooder-man/hci-spooder-man-teaser.png
image_aspect: 16 / 9
card_image_fit: cover
card_image_position: center
importance: -10
category: fun
year: 2026
role: OG HCI Spooder-Man
status: Remix guide
hide_title: true
random_teasers: false
spooder_project: true
---

{% assign spooder = site.data.spooder_man %}

<section class="project-case-hero hci-spooder-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">{{ spooder.hero.kicker }}</p>
    <h1>{{ spooder.hero.title }}</h1>
    <p class="project-case-lede">{{ spooder.hero.lede }}</p>
    <div class="project-case-facts">
      <span>Website remix</span>
      <span>Academic play</span>
      <span>Assets included</span>
      <span>Prompt scaffold</span>
    </div>
    <div class="project-case-actions">
      <a href="#spooder-remix-recipe">Start remixing</a>
      <a href="{{ spooder.downloads.remix_kit_zip | relative_url }}" download>Download remix kit</a>
      <a href="{{ spooder.hero.playlist_url }}" target="_blank" rel="noopener noreferrer">Watch the playlist</a>
    </div>
  </div>
  <div class="project-case-media hci-spooder-hero-media">
    {% include figure.liquid loading="eager" path=spooder.hero.teaser title="HCI Spooder-Man teaser" alt="A group of playful Spooder-Man characters moving through a city" class="img-fluid" %}
  </div>
</section>

<section id="spooder-remix-recipe" class="hci-spooder-remix-flow" aria-labelledby="spooder-remix-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">How to remix this</p>
    <h2 id="spooder-remix-title">Hand the prompt and kit to your coding agent, then make it yours.</h2>
    <p>The move is simple: keep the serious portfolio trustworthy, attach one playful artifact, and publish the scaffold so the next person can adapt it.</p>
  </div>
  <ol>
    {% for step in spooder.guide_steps %}
      <li>
        <span>{{ forloop.index | prepend: '0' | slice: -2, 2 }}</span>
        <strong>{{ step.title }}</strong>
        {{ step.text }}
      </li>
    {% endfor %}
  </ol>
</section>

<section class="hci-spooder-gallery" data-spooder-image-carousel aria-labelledby="spooder-gallery-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Asset carousel</p>
    <h2 id="spooder-gallery-title">Browse the visual kit before you remix.</h2>
    <p>These are the local screenshots I used for the guide. Move through them here, then download the ZIP if you want to hand everything to a coding agent at once.</p>
  </div>

  <div class="hci-spooder-gallery-stage" tabindex="0" aria-label="HCI Spooder-Man visual assets">
    <button class="hci-spooder-gallery-arrow hci-spooder-gallery-arrow-prev" type="button" data-spooder-image-prev aria-label="Previous image">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
    </button>
    <div class="hci-spooder-gallery-slides" aria-live="polite">
      {% for asset in spooder.assets limit: 9 %}
        <figure class="hci-spooder-gallery-slide" data-spooder-image-slide {% unless forloop.first %}hidden{% endunless %}>
          <img src="{{ asset.path | relative_url }}" alt="{{ asset.label }}" loading="{% if forloop.first %}eager{% else %}lazy{% endif %}">
          <figcaption>
            <strong>{{ asset.label }}</strong>
            {{ asset.caption }}
          </figcaption>
        </figure>
      {% endfor %}
    </div>
    <button class="hci-spooder-gallery-arrow hci-spooder-gallery-arrow-next" type="button" data-spooder-image-next aria-label="Next image">
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>

  <div class="hci-spooder-gallery-thumbs" aria-label="Select visual asset">
    {% for asset in spooder.assets limit: 9 %}
      <button type="button" data-spooder-image-thumb aria-label="Show {{ asset.label }}">
        <img src="{{ asset.path | relative_url }}" alt="" loading="lazy">
        <span>{{ forloop.index | prepend: '0' | slice: -2, 2 }}</span>
      </button>
    {% endfor %}
  </div>
</section>

<section class="hci-spooder-toolkit" aria-label="HCI Spooder-Man remix toolkit">
  <section id="spooder-agent-kit" class="hci-spooder-agent-kit hci-spooder-prompt" data-spooder-prompt-card aria-labelledby="spooder-agent-kit-title">
    <div>
      <h2 id="spooder-agent-kit-title">Prompt and ZIP for a coding agent</h2>
      <button type="button" data-spooder-copy-prompt>Copy agent prompt</button>
    </div>
    <p>
      The easiest path is to download the kit, drop it into your site repo, paste this prompt into your coding agent, and ask it to adapt the pattern to your own voice.
    </p>
    <div class="hci-spooder-agent-actions">
      <a href="{{ spooder.downloads.remix_kit_zip | relative_url }}" download>
        <i class="fa-solid fa-file-zipper" aria-hidden="true"></i>
        Download remix kit
      </a>
      <a href="{{ spooder.downloads.prompt_markdown | relative_url }}" download>
        <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
        Download prompt markdown
      </a>
      <a href="#spooder-assets">
        <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
        Use local assets
      </a>
    </div>
    <textarea class="hci-spooder-agent-prompt" readonly rows="18" aria-label="Copyable HCI Spooder-Man remix prompt">{{ spooder.agent_prompt | strip }}</textarea>
  </section>

  <section id="spooder-assets" class="hci-spooder-assets" aria-labelledby="spooder-assets-title">
    <div class="hci-spooder-section-heading">
      <p class="project-case-kicker">Local assets</p>
      <h2 id="spooder-assets-title">Assets you can use</h2>
      <p>Use these local files as references, placeholders, or remix ingredients if you do not want to regenerate your own visual set first.</p>
    </div>
    <div class="hci-spooder-asset-grid">
      {% for asset in spooder.assets %}
        <a href="{{ asset.path | relative_url }}" download>
          <span>{{ asset.label }}</span>
          <small>{{ asset.caption }}</small>
        </a>
      {% endfor %}
    </div>
  </section>
</section>

<section class="spooder-video-section" data-spooder-carousel aria-labelledby="spooder-video-title">
  <div class="spooder-video-heading">
    <div>
      <p class="project-case-kicker">Source chaos</p>
      <h2 id="spooder-video-title">The movement, in release order</h2>
      <p>The center card is the current player; the side cards stay visible so the playlist feels browsable without jumping to YouTube.</p>
    </div>
    <div class="spooder-video-controls" aria-label="Spooder video carousel controls">
      <button type="button" data-spooder-prev aria-label="Previous video">
        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
      </button>
      <button type="button" data-spooder-next aria-label="Next video">
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <div class="spooder-video-track" data-spooder-track tabindex="0">
    {% for video in spooder.videos %}
      <article class="spooder-video-card" data-spooder-slide data-spooder-video-id="{{ video.id }}">
        <div class="spooder-video-frame" data-spooder-video-frame>
          <img src="https://i.ytimg.com/vi/{{ video.id }}/hqdefault.jpg" alt="{{ video.title }} thumbnail" loading="lazy">
          <button type="button" data-spooder-load-video>
            <i class="fa-solid fa-play" aria-hidden="true"></i>
            <span>Load video</span>
          </button>
        </div>
        <div class="spooder-video-meta">
          <span>{{ forloop.index | prepend: '0' | slice: -2, 2 }}</span>
          <h3>{{ video.title }}</h3>
          <a href="{{ video.url }}" target="_blank" rel="noopener noreferrer">
            Watch on YouTube
            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
          </a>
        </div>
      </article>
    {% endfor %}
  </div>
  <p class="spooder-video-playlist">
    Full playlist:
    <a href="{{ spooder.hero.playlist_url }}" target="_blank" rel="noopener noreferrer">open the 10-video Spooder-Man playlist</a>.
    YouTube decides the final playback quality for each viewer, even when the embed asks for a high-quality stream.
  </p>
</section>

<section class="hci-spooder-credits" aria-label="Credits and invitation">
  <p>
    Inspired by the Spooder-Man trailers and playlist. Credit Sirui Tao as the OG HCI Spooder-Man if this scaffold helps you make your own version, then invite more people to join the HCI Spooder-Verse.
  </p>
  <strong>This is the creativity I want to scaffold for everyone.</strong>
</section>
