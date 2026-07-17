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
      <a href="{{ '/projects/wall-of-rejection/' | relative_url }}">Open the Wall</a>
      <a href="#spooder-agent-kit">Get spoody-suits</a>
      <a href="#spooder-capsule">Join in</a>
    </div>
  </div>
  <div class="project-case-media hci-spooder-hero-media" data-random-teaser data-random-teasers="{{ spooder_teaser_paths | strip }}">
    {% include figure.liquid loading="eager" path=spooder.hero.teaser title="HCI Spooder-Man remix artwork" alt="Playful HCI Spooder-Man remix artwork from a set of city scenes, character lineups, and title cards" class="img-fluid" %}
  </div>
</section>

<section class="project-case-summary" aria-label="HCI Spooder-Man summary">
  <div>
    <span>Why</span>
    <p>Two paper rejections needed somewhere to go besides another private note about resilience.</p>
  </div>
  <div>
    <span>What</span>
    <p>A lab meme became a playful remix page, a downloadable prompt, and a set of visual placeholders.</p>
  </div>
  <div>
    <span>How</span>
    <p>Tell the real academic moment first, keep serious portfolio routes obvious, then invite someone else to adapt the bit to their own story.</p>
  </div>
</section>

<section class="hci-spooder-origin" aria-labelledby="spooder-origin-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Origin story</p>
    <h2 id="spooder-origin-title">Two rejections, one Steam meme, then Spooder-Man.</h2>
    <p>The order is the story: rejection event, lab artifact, then reusable invitation. The joke works only if the real academic moment stays legible.</p>
  </div>
  <ol class="project-story-beats" aria-label="HCI Spooder-Man origin beats">
    <li class="project-story-beat">
      <p class="project-case-kicker">Spark</p>
      <h3>Same paper, two noes.</h3>
      <p>CHI said no. UIST said no. The factual origin is small: one paper, two rejection events, and the decision to turn the mood into something shareable.</p>
    </li>
    <li class="project-story-beat">
      <p class="project-case-kicker">Turn</p>
      <h3>Make the receipt funny enough to send.</h3>
      <p>The Steam-style achievement image began as a labmate meme. It later became the starting artifact for the separate <a href="{{ '/projects/wall-of-rejection/' | relative_url }}">Wall of Rejection</a>, where badges open receipts instead of pretending rejection is a productivity score.</p>
    </li>
    <li class="project-story-beat">
      <p class="project-case-kicker">Now</p>
      <h3>Turn one private joke into a remix invitation.</h3>
      <p>The Spooder-Man page adds visual frames, a prompt, a downloadable kit, and a path back to serious work. A remix should begin with the next person's real academic moment, not copy this page's surface.</p>
    </li>
  </ol>
</section>

<aside class="project-story-note" data-spooder-artwork-boundary="remix-material-not-history" aria-labelledby="spooder-artwork-boundary-title">
  <p class="project-case-kicker">Artwork boundary</p>
  <h2 id="spooder-artwork-boundary-title">These frames are remix material, not documentary history.</h2>
  <p>The gallery contains playful scene and title frames for browsing, reference, and reuse. Their order is not a chronology, and the images are not photos of the rejection events, screenshots of an earlier interface, or evidence that a particular scene happened. The origin beats above carry the factual story; the source playlist carries the tonal credit.</p>
</aside>

<section id="spooder-capsule" class="hci-spooder-gallery" data-spooder-image-carousel aria-labelledby="spooder-gallery-title">
  <div class="hci-spooder-section-heading">
    <p class="project-case-kicker">Spoody kit</p>
    <h2 id="spooder-gallery-title">Pick a spoody-suit.</h2>
    <p>Use these remix frames as placeholders or references; swap in your own academic no rather than reading their order as project history.</p>
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

<details class="project-story-disclosure site-experiment-technical-details">
  <summary id="spooder-technical-summary">Remix provenance and technical record</summary>
  <div class="project-story-disclosure-body" aria-labelledby="spooder-technical-summary">
    <ul>
      <li><strong>Source of truth:</strong> <code>_data/spooder_man.yml</code> supplies the hero copy, gallery labels, remix steps, downloadable prompt, asset paths, and video list used by this page.</li>
      <li><strong>Artwork status:</strong> the local gallery files and ZIP are current remix materials. This page makes no claim that their sequence documents historical versions or rejection events.</li>
      <li><strong>Video boundary:</strong> thumbnails identify the credited source playlist. The privacy-enhanced YouTube player is created only after a visitor chooses <em>Load video</em>.</li>
      <li><strong>Remix boundary:</strong> the downloadable prompt asks readers to start with their own real moment, preserve clear routes back to serious work, adapt the tone to their site, and credit the source idea.</li>
    </ul>
    <ol class="site-experiment-ledger" aria-label="HCI Spooder-Man revision record">
      <li><time datetime="2026-05-30">May 30</time><code>95acdb781</code><span>Added the project page, structured Spooder data, and the first page interaction script.</span></li>
      <li><time datetime="2026-05-31">May 31</time><code>5b6ae82ea</code><span>Added the downloadable remix ZIP and Markdown prompt, then reorganized the page around reuse.</span></li>
      <li><time datetime="2026-05-31">May 31</time><code>c91889bd5</code><span>Refined the image and source-video carousels without changing the origin story.</span></li>
      <li><time datetime="2026-07-15">Jul 15</time><code>f05f02b41</code><span>Registered the page as a site experiment with its original May 30 debut timestamp.</span></li>
    </ol>
  </div>
</details>

<section class="hci-spooder-credits" aria-label="Credits and invitation">
  <p>Credit Sirui Tao as the OG HCI Spooder-Man. The original spark was a double rejection and a lab meme; the linked Spooder-Man trailers and playlist supplied the chaotic remix tone.</p>
  <strong>Become a Spooder-Man. Join the nerdy Spooder-Verse.</strong>
</section>
