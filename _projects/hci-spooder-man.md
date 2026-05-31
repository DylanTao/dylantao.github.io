---
layout: page
title: HCI Spooder-Man
description: A playful remix guide for turning an academic website into a small, funny, human-centered artifact.
img: assets/img/project_pics/hci-spooder-man/hci-spooder-man-teaser.png
image_aspect: 16 / 9
card_image_fit: cover
card_image_position: center
importance: 1
category: fun
year: 2026
role: OG HCI Spooder-Man
status: Remix guide
hide_title: true
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
      <span>Rejection as receipt</span>
      <span>Prompt scaffold</span>
      <span>COGS 125 energy</span>
    </div>
    <div class="project-case-actions">
      <a href="#spooder-assets">Use the assets</a>
      <a href="#spooder-prompts">Borrow the prompts</a>
      <a href="{{ spooder.hero.trailer_url }}" target="_blank" rel="noopener noreferrer">Watch the trailer</a>
    </div>
  </div>
  <div class="project-case-media hci-spooder-hero-media">
    {% include figure.liquid loading="eager" path="assets/img/project_pics/hci-spooder-man/hci-spooder-man-teaser.png" title="HCI Spooder-Man group teaser" alt="A group of playful Spooder-Man characters walking together through a city crosswalk" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary" aria-label="HCI Spooder-Man summary">
  <div>
    <span>Premise</span>
    <p>A personal academic website can hold serious research and still make room for weird, generous jokes that invite remixing.</p>
  </div>
  <div>
    <span>Move</span>
    <p>Keep the portfolio credible, then add one playful artifact with receipts, prompts, and assets others can actually reuse.</p>
  </div>
  <div>
    <span>Invitation</span>
    <p>Credit Sirui Tao as the OG HCI Spooder-Man, then adapt the idea until it fits your own taste, field, and website.</p>
  </div>
</section>

## Become a Spooder-Man

This page is a small scaffold for anyone who wants their website to feel a little more alive. The joke works because it is not just decoration. It turns rejection, iteration, fandom, and academic self-presentation into a public artifact that says: we can take the work seriously without sanding off the human being who made it.

The design rule is simple: make the playful layer opt-in, keep evidence close, and give future remixers enough material to make their own version instead of copying mine exactly.

<div class="hci-spooder-gallery" aria-label="HCI Spooder-Man visual references">
  {% for asset in spooder.assets limit: 6 %}
    <figure>
      <img src="{{ asset.path | relative_url }}" alt="{{ asset.label }}">
      <figcaption>
        <strong>{{ asset.label }}</strong>
        {{ asset.caption }}
      </figcaption>
    </figure>
  {% endfor %}
</div>

## Remix recipe

1. Pick one honest tension in your website: rejection, messy process, revision, fieldwork, half-working prototypes, or a tool that taught you something.
2. Turn it into a small interface moment: a badge shelf, receipt drawer, comic panel, tiny game card, or project page.
3. Keep the serious path intact. Visitors should still find papers, projects, CV, and contact information without needing the joke.
4. Publish the scaffold: assets, prompts, credits, and enough markdown that someone else can make a version in their own voice.

<section id="spooder-assets" class="hci-spooder-assets" aria-labelledby="spooder-assets-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Reuse kit</p>
    <h2 id="spooder-assets-title">Assets you can use</h2>
    <p>These are local files from this site. Use them as references, placeholders, or remix ingredients if you do not want to regenerate your own visual set first.</p>
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

<section id="spooder-prompts" class="hci-spooder-prompts" aria-labelledby="spooder-prompts-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Prompt scaffold</p>
    <h2 id="spooder-prompts-title">Prompts to adapt</h2>
    <p>Swap in your own colors, research identity, institution, field, humor level, and website tone. The point is not to become my copy. It is to make your own site braver.</p>
  </div>
  <div class="hci-spooder-prompt-list">
    {% for prompt in spooder.prompts %}
      <article class="hci-spooder-prompt">
        <div>
          <h3>{{ prompt.title }}</h3>
          <button type="button" data-spooder-copy-prompt>Copy prompt</button>
        </div>
        <textarea readonly rows="6">{{ prompt.text }}</textarea>
      </article>
    {% endfor %}
  </div>
</section>

<section class="spooder-video-section" data-spooder-carousel aria-labelledby="spooder-video-title">
  <div class="spooder-video-heading">
    <div>
      <p class="project-case-kicker">Source chaos</p>
      <h2 id="spooder-video-title">The movement, in release order</h2>
      <p>
        The embeds request the richest normal YouTube playback experience the browser allows, but YouTube still decides the actual stream quality for each viewer.
      </p>
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
  </p>
</section>

## Credits and invitation

This page is inspired by the Spooder-Man trailers and the absurd generosity of the Spooder-Verse. Credit Sirui Tao as the OG HCI Spooder-Man if this scaffold helps you make your own version, then invite more people in. The best outcome is not one canonical joke. The best outcome is a small wave of websites where researchers let their taste, humor, and process show.

This is the creativity I want to scaffold for everyone.
