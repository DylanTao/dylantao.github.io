---
layout: page
title: HCI Spooder-Man
description: A remix kit for playful academic failure, images first.
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
      <span>Failure XP</span>
      <span>Origin</span>
      <span>Remix kit</span>
      <span>Source videos</span>
    </div>
    <div class="project-case-actions">
      <a href="#spooder-capsule">See the kit</a>
      <a href="#spooder-agent-kit">Grab files</a>
      <a href="#spooder-video-title">Watch</a>
    </div>
  </div>
  <div class="project-case-media hci-spooder-hero-media" data-random-teaser data-random-teasers="{{ spooder_teaser_paths | strip }}">
    {% include figure.liquid loading="eager" path=spooder.hero.teaser title="HCI Spooder-Man teaser" alt="A group of playful Spooder-Man characters moving through a city" class="img-fluid" %}
  </div>
</section>

<section class="hci-spooder-origin" aria-labelledby="spooder-origin-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Origin story</p>
    <h2 id="spooder-origin-title">A failed submission. A cape.</h2>
    <p>The research stays serious. The messy part gets a costume.</p>
  </div>
  <div class="hci-spooder-origin-grid">
    <article>
      <span>01</span>
      <strong>Show the no.</strong>
      <p>A rejection can be evidence, not a secret.</p>
    </article>
    <article>
      <span>02</span>
      <strong>Keep the map.</strong>
      <p>Papers, CV, contact, and project proof stay easy to find.</p>
    </article>
    <article>
      <span>03</span>
      <strong>Pass the mask.</strong>
      <p>The joke works better when someone else can remix it.</p>
    </article>
  </div>
</section>

<section id="spooder-capsule" class="hci-spooder-gallery" data-spooder-image-carousel aria-labelledby="spooder-gallery-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Visual kit</p>
    <h2 id="spooder-gallery-title">The visual kit carries the story.</h2>
    <p>Pick a frame. Swap the captions. Keep moving.</p>
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
    <h2 id="spooder-remix-title">Three moves.</h2>
    <p>Start from a real scar; leave the site useful.</p>
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
      <h2 id="spooder-agent-kit-title">Prompt + ZIP</h2>
      <button type="button" data-spooder-copy-prompt>Copy agent prompt</button>
    </div>
    <p>Download, adapt, ship your own version.</p>
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
      <h2 id="spooder-video-title">Source videos.</h2>
      <p>The motion language starts here.</p>
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
    <a href="{{ spooder.hero.playlist_url }}" target="_blank" rel="noopener noreferrer">open the 10-video playlist</a>.
  </p>
</section>

<section class="hci-spooder-credits" aria-label="Credits and invitation">
  <p>Credit Sirui Tao as the OG HCI Spooder-Man. Keep the paper trail visible.</p>
  <strong>Join the nerdy Spooder-Verse. Let the visual bit do the talking.</strong>
</section>
