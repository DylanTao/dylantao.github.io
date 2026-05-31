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
random_teasers: true
spooder_project: true
---

{% assign spooder = site.data.spooder_man %}
{% capture spooder_teasers %}
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
      <span>Website remix</span>
      <span>Academic play</span>
      <span>Assets included</span>
      <span>Prompt scaffold</span>
    </div>
    <div class="project-case-actions">
      <a href="#spooder-remix-recipe">Start remixing</a>
      <a href="#spooder-assets">Use the assets</a>
      <a href="{{ spooder.hero.playlist_url }}" target="_blank" rel="noopener noreferrer">Watch the playlist</a>
    </div>
  </div>
  <div class="project-case-media hci-spooder-hero-media" data-random-teaser data-random-teasers="{{ spooder_teasers | strip }}">
    {% include figure.liquid loading="eager" path=spooder.hero.teaser title="HCI Spooder-Man teaser" alt="A group of playful Spooder-Man characters moving through a city" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary hci-spooder-principles" aria-label="HCI Spooder-Man design principles">
  <div>
    <span>Keep trust</span>
    <p>The publications, CV, and contact paths stay plain and findable. The joke never blocks the serious route.</p>
  </div>
  <div>
    <span>Make process visible</span>
    <p>Rejection, revision, and weird taste become evidence that the website was made by a person.</p>
  </div>
  <div>
    <span>Invite remix</span>
    <p>The best version is not a clone of this page. It is someone else's site becoming more theirs.</p>
  </div>
</section>

<section class="hci-spooder-brief" aria-label="Why HCI Spooder-Man exists">
  <div>
    <p class="project-case-kicker">The move</p>
    <h2>One playful artifact, attached to a serious portfolio.</h2>
  </div>
  <p>
    HCI Spooder-Man is a small design pattern for academic websites: keep the page useful for visitors who need the work, then add one generous, funny layer that makes the maker visible. For me, that layer is the Wall of Rejection and this remix guide. For someone else, it might be a fieldwork postcard drawer, a prototype graveyard, a tiny conference-badge game, or a comic strip about reviewer feedback.
  </p>
</section>

<div class="hci-spooder-gallery" aria-label="HCI Spooder-Man visual references">
  {% for asset in spooder.assets limit: 9 %}
    <figure>
      <img src="{{ asset.path | relative_url }}" alt="{{ asset.label }}" loading="lazy">
      <figcaption>
        <strong>{{ asset.label }}</strong>
        {{ asset.caption }}
      </figcaption>
    </figure>
  {% endfor %}
</div>

<section id="spooder-remix-recipe" class="hci-spooder-remix-flow" aria-labelledby="spooder-remix-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Remix recipe</p>
    <h2 id="spooder-remix-title">Build your own version without losing the plot.</h2>
    <p>Use this as a markdown-level scaffold: swap the subject, tune the humor, keep the navigation boring in the best way, and make the playful part easy to reuse.</p>
  </div>
  <ol>
    <li>
      <span>01</span>
      <strong>Choose an honest tension.</strong>
      Pick rejection, messy iteration, field notes, prototype failures, weird tools, or another part of research people usually hide.
    </li>
    <li>
      <span>02</span>
      <strong>Turn it into an interface moment.</strong>
      Make a badge shelf, receipt drawer, comic panel, tiny game card, image viewer, or project page that still feels native to your site.
    </li>
    <li>
      <span>03</span>
      <strong>Publish the scaffold.</strong>
      Share assets, prompts, credits, and enough structure that someone else can adapt the idea in their own voice.
    </li>
  </ol>
</section>

<section class="hci-spooder-toolkit" aria-label="HCI Spooder-Man remix toolkit">
  <section id="spooder-assets" class="hci-spooder-assets" aria-labelledby="spooder-assets-title">
    <div class="hci-spooder-section-heading">
      <p class="project-case-kicker">Reuse kit</p>
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

  <section id="spooder-prompts" class="hci-spooder-prompts" aria-labelledby="spooder-prompts-title">
    <div class="hci-spooder-section-heading">
      <p class="project-case-kicker">Prompt scaffold</p>
      <h2 id="spooder-prompts-title">Prompts to adapt</h2>
      <p>Change the colors, academic identity, institution, field, humor level, and website tone. The point is not to become my copy. It is to make your own site braver.</p>
    </div>
    <div class="hci-spooder-prompt-list">
      {% for prompt in spooder.prompts %}
        <article class="hci-spooder-prompt">
          <div>
            <h3>{{ prompt.title }}</h3>
            <button type="button" data-spooder-copy-prompt>Copy prompt</button>
          </div>
          <textarea readonly rows="7">{{ prompt.text }}</textarea>
        </article>
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
