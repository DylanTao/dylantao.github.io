---
layout: page
title: HCI Spooder-Man
description: A simple remix guide for making an academic website playful without hiding the serious work.
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
random_teasers: true
spooder_project: true
---

{% assign spooder = site.data.spooder_man %}
{% capture spooder_teaser_paths %}
{% for teaser in spooder.teasers %}
{{ teaser | relative_url }}{% unless forloop.last %}|{% endunless %}
{% endfor %}
{% endcapture %}

<section class="project-case-hero hci-spooder-hero">
  <div class="project-case-copy">
    <p class="project-case-kicker">{{ spooder.hero.kicker }}</p>
    <h1>{{ spooder.hero.title }}</h1>
    <p class="project-case-lede">{{ spooder.hero.lede }}</p>
    <div class="project-case-facts">
      <span>Rejection XP</span>
      <span>Origin story</span>
      <span>Remix images</span>
      <span>Prompt + ZIP</span>
    </div>
    <div class="project-case-actions">
      <a href="#spooder-capsule">Join the movement</a>
      <a href="#spooder-agent-kit">Grab the kit</a>
      <a href="#spooder-video-title">Watch the source</a>
    </div>
  </div>
  <div class="project-case-media hci-spooder-hero-media" data-random-teaser data-random-teasers="{{ spooder_teaser_paths | strip }}">
    {% include figure.liquid loading="eager" path=spooder.hero.teaser title="HCI Spooder-Man teaser" alt="A group of playful Spooder-Man characters moving through a city" class="img-fluid" %}
  </div>
</section>

<section class="hci-spooder-origin" aria-labelledby="spooder-origin-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Origin story</p>
    <h2 id="spooder-origin-title">Academic rejection is already dramatic. Give it a cape.</h2>
    <p>HCI Spooder-Man started as a small way to stop hiding failed submissions. The work stays serious; the messy parts can be visible, funny, and easy to remix.</p>
  </div>
  <div class="hci-spooder-origin-grid">
    <article>
      <span>01</span>
      <strong>Show the closed door.</strong>
      <p>A rejection is not something to hide. It is a note about timing, framing, fit, or what to try next.</p>
    </article>
    <article>
      <span>02</span>
      <strong>Keep the portfolio credible.</strong>
      <p>The serious site still comes first. Visitors should find papers, CV, contact, and project evidence without decoding the joke.</p>
    </article>
    <article>
      <span>03</span>
      <strong>Invite people in.</strong>
      <p>A playful section makes research feel more human and invites others to make their own version.</p>
    </article>
  </div>
</section>

<section id="spooder-capsule" class="hci-spooder-gallery" data-spooder-image-carousel aria-labelledby="spooder-gallery-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Visual kit</p>
    <h2 id="spooder-gallery-title">A small visual kit for the Spooder-Verse.</h2>
    <p>These images make the page feel joinable. The prompt and ZIP make it easy to reuse.</p>
  </div>

  <div class="hci-spooder-gallery-stage" tabindex="0" aria-label="HCI Spooder-Man recruitment capsule images">
    <button class="hci-spooder-gallery-arrow hci-spooder-gallery-arrow-prev" type="button" data-spooder-image-prev aria-label="Previous image">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
    </button>
    <div class="hci-spooder-gallery-slides" aria-live="polite">
      {% for asset in spooder.assets limit: 9 %}
        {% assign title_frame = false %}
        {% if asset.path contains 'title' %}
          {% assign title_frame = true %}
        {% endif %}
        <figure class="hci-spooder-gallery-slide{% if title_frame %} hci-spooder-gallery-slide-contain{% endif %}{% if forloop.first %} is-active{% endif %}" data-spooder-image-slide aria-hidden="{% if forloop.first %}false{% else %}true{% endif %}">
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

<section id="spooder-remix-recipe" class="hci-spooder-remix-flow" aria-labelledby="spooder-remix-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">How to remix this</p>
    <h2 id="spooder-remix-title">Turn one rough research moment into a reusable page idea.</h2>
    <p>The recipe is small: pick a real academic tension, keep the main site usable, and share enough structure that someone else can adapt the idea.</p>
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

<section class="hci-spooder-toolkit" aria-label="HCI Spooder-Man remix toolkit">
  <section id="spooder-agent-kit" class="hci-spooder-agent-kit hci-spooder-prompt" data-spooder-prompt-card aria-labelledby="spooder-agent-kit-title">
    <div>
      <h2 id="spooder-agent-kit-title">Prompt and ZIP for your coding agent</h2>
      <button type="button" data-spooder-copy-prompt>Copy agent prompt</button>
    </div>
    <p>
      Download the ZIP, keep the prompt nearby, and ask your coding agent to adapt the page to your field, voice, and humor level.
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
    </div>
    <textarea class="hci-spooder-agent-prompt" readonly rows="18" aria-label="Copyable HCI Spooder-Man remix prompt">{{ spooder.agent_prompt | strip }}</textarea>
  </section>
</section>

<section class="spooder-video-section" data-spooder-carousel aria-labelledby="spooder-video-title">
  <div class="spooder-video-heading">
    <div>
      <p class="project-case-kicker">Source playlist</p>
      <h2 id="spooder-video-title">Spooder source videos.</h2>
      <p>These videos inspired the page. Browse them here or open the playlist for the full run.</p>
    </div>
  </div>

  <div class="spooder-video-stage">
    <button class="hci-spooder-gallery-arrow hci-spooder-gallery-arrow-prev spooder-video-arrow" type="button" data-spooder-prev aria-label="Previous video">
      <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
    </button>
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
    <button class="hci-spooder-gallery-arrow hci-spooder-gallery-arrow-next spooder-video-arrow" type="button" data-spooder-next aria-label="Next video">
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>
  <p class="spooder-video-playlist">
    Full playlist:
    <a href="{{ spooder.hero.playlist_url }}" target="_blank" rel="noopener noreferrer">open the 10-video Spooder-Man playlist</a>.
    YouTube still decides the final playback quality for each viewer.
  </p>
</section>

<section class="hci-spooder-credits" aria-label="Credits and invitation">
  <p>
    If this helps you make your own playful academic page, credit Sirui Tao as the OG HCI Spooder-Man. Keep the scholarship easier to find than the joke.
  </p>
  <strong>Join the HCI Spooder-Verse, keep your site useful, and let the web feel a little more alive.</strong>
</section>
