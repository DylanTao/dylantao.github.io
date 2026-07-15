---
layout: page
title: HCI Spooder-Man
description: Double rejection, a Steam-style lab meme, and a small door into the nerdy Spooder-Verse.
img: assets/img/project_pics/hci-spooder-man/hci-spooder-man-teaser.png
image_aspect: 16 / 9
card_image_fit: cover
card_image_position: center
importance: -10
category: fun
site_experiment: true
debut_date: 2026-05-30T19:29:43-07:00
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
      <span>Double reject</span>
      <span>Lab meme</span>
      <span>Spooder turn</span>
      <span>Remix kit</span>
    </div>
    <div class="project-case-actions">
      <a href="#spooder-origin-title">Read origin</a>
      <a href="#spooder-agent-kit">Get spoody-suits</a>
      <a href="#spooder-capsule">Join in</a>
    </div>
  </div>
  <div class="project-case-media hci-spooder-hero-media" data-random-teaser data-random-teasers="{{ spooder_teaser_paths | strip }}">
    {% include figure.liquid loading="eager" path=spooder.hero.teaser title="HCI Spooder-Man teaser" alt="A group of playful Spooder-Man characters moving through a city" class="img-fluid" %}
  </div>
</section>

<section class="hci-spooder-origin" aria-labelledby="spooder-origin-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Origin story</p>
    <h2 id="spooder-origin-title">Two rejections, one Steam meme, then Spooder-Man.</h2>
    <p>CHI said no. UIST said no. I made a Steam-style rejection badge meme, sent it to my labmates, then the Spooder-Man idea had too much chaotic energy to leave alone.</p>
  </div>
  <div class="hci-spooder-origin-grid">
    <article>
      <span>01</span>
      <strong>Double reject.</strong>
      <p>Same paper, two noes, still moving.</p>
    </article>
    <article>
      <span>02</span>
      <strong>Steam meme.</strong>
      <p>The Wall of Rejection started as an achievement-card joke for labmates.</p>
    </article>
    <article>
      <span>03</span>
      <strong>Spooder turn.</strong>
      <p>The meme became a remix page: assets, prompt, and a weird little invitation.</p>
    </article>
  </div>
</section>

<section id="spooder-capsule" class="hci-spooder-gallery" data-spooder-image-carousel aria-labelledby="spooder-gallery-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Spoody kit</p>
    <h2 id="spooder-gallery-title">Pick a spoody-suit.</h2>
    <p>Use these frames as placeholders or references; swap in your own academic no.</p>
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
    <h2 id="spooder-remix-title">Remix it in three moves.</h2>
    <p>Start with your no, use the files, keep the serious work easy to find.</p>
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
      <h2 id="spooder-agent-kit-title">Spoody-suit files.</h2>
      <button type="button" data-spooder-copy-prompt>Copy agent prompt</button>
    </div>
    <p>Markdown prompt plus asset ZIP: enough structure, not a clone.</p>
    <div class="hci-spooder-agent-actions">
      <a href="{{ spooder.downloads.remix_kit_zip | relative_url }}" download>
        <i class="fa-solid fa-file-zipper" aria-hidden="true"></i>
        Download spoody-suits
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
      <h2 id="spooder-video-title">Where the bit came from.</h2>
      <p>The Spooder-Man meme supplied the chaotic tone.</p>
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
  <p>Credit Sirui Tao as the OG HCI Spooder-Man. The original spark was a double rejection, a lab meme, and too much Spooder-Man energy.</p>
  <strong>Become a Spooder-Man. Join the nerdy Spooder-Verse.</strong>
</section>
