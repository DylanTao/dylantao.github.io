---
layout: post
title: a gallery of random gen-ai images
date: 2024-12-13 09:08:46
description: A small gallery of AI-generated images from late 2024, kept as a record of what the tools produced.
tags: gen-ai cool-things art
categories: image-posts
featured: false
thumbnail: assets/img/genai_pics/facesoft_cat2.png
thumbnail_alt: Stylized cat portrait generated with MidJourney
blog_nav_pool: personal
blog_nav_track: creative
blog_nav_stage: 1
images:
  lightbox2: false
  photoswipe: false
  spotlight: true
  venobox: false
_styles: |
  .genai-gallery {
    display: grid;
    gap: clamp(0.75rem, 2vw, 1rem);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 1rem 0 2rem;
  }

  .genai-gallery .spotlight {
    aspect-ratio: 1 / 1;
    background: var(--global-bg-color);
    border: 1px solid var(--global-divider-color);
    border-radius: 0.5rem;
    display: block;
    line-height: 0;
    overflow: hidden;
  }

  .genai-gallery img {
    display: block;
    height: 100%;
    object-fit: cover;
    transition:
      filter 180ms ease,
      transform 180ms ease;
    width: 100%;
  }

  .genai-gallery .spotlight:hover img,
  .genai-gallery .spotlight:focus-visible img {
    filter: saturate(1.08) contrast(1.03);
    transform: scale(1.035);
  }

  .genai-gallery .spotlight:focus-visible {
    outline: 2px solid var(--global-theme-color);
    outline-offset: 3px;
  }

  @media (max-width: 768px) {
    .genai-gallery {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .genai-gallery {
      gap: 0.75rem;
      grid-template-columns: 1fr;
    }
  }
---

With greater power comes more time wasted :-]

## MidJourney

{% if site.imagemagick.enabled %}
{% assign gallery_full_suffix = '-1400.webp' %}
{% assign gallery_thumb_suffix = '-480.webp' %}
{% else %}
{% assign gallery_full_suffix = '.png' %}
{% assign gallery_thumb_suffix = '.png' %}
{% endif %}

<div class="genai-gallery spotlight-group" aria-label="MidJourney image gallery">
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_capybara2' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_capybara2' | append: gallery_thumb_suffix | relative_url }}" alt="Two capybaras in water" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_monkey' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_monkey' | append: gallery_thumb_suffix | relative_url }}" alt="Small monkey holding two popsicles" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_snake' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_snake' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized snake portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_paper' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_paper' | append: gallery_thumb_suffix | relative_url }}" alt="Surreal paper character" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cat6' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cat6' | append: gallery_thumb_suffix | relative_url }}" alt="Cat portrait variation six" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cat4' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cat4' | append: gallery_thumb_suffix | relative_url }}" alt="Cat portrait variation four" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_capybara3' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_capybara3' | append: gallery_thumb_suffix | relative_url }}" alt="Capybara scene variation three" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_capybara1' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_capybara1' | append: gallery_thumb_suffix | relative_url }}" alt="Capybara scene variation one" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_dog' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_dog' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized dog portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_panda' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_panda' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized panda portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_whale' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_whale' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized whale scene" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_parrot' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_parrot' | append: gallery_thumb_suffix | relative_url }}" alt="Colorful parrot portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_al_paca' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_al_paca' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized alpaca portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_bird' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_bird' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized bird portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_planet1' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_planet1' | append: gallery_thumb_suffix | relative_url }}" alt="Imaginary planet scene one" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cow' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cow' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized cow portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cat5' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cat5' | append: gallery_thumb_suffix | relative_url }}" alt="Cat portrait variation five" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cube' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cube' | append: gallery_thumb_suffix | relative_url }}" alt="Surreal cube object" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cat1' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cat1' | append: gallery_thumb_suffix | relative_url }}" alt="Cat portrait variation one" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_penguin' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_penguin' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized penguin portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cat2' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cat2' | append: gallery_thumb_suffix | relative_url }}" alt="Cat portrait variation two" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_spiderman' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_spiderman' | append: gallery_thumb_suffix | relative_url }}" alt="Spider-Man inspired character portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_cat3' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_cat3' | append: gallery_thumb_suffix | relative_url }}" alt="Cat portrait variation three" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_planet2' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_planet2' | append: gallery_thumb_suffix | relative_url }}" alt="Imaginary planet scene two" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_owl' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_owl' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized owl portrait" loading="lazy" decoding="async"/></a>
<a class="spotlight" href="{{ '/assets/img/genai_pics/facesoft_sloth' | append: gallery_full_suffix | relative_url }}"><img src="{{ '/assets/img/genai_pics/facesoft_sloth' | append: gallery_thumb_suffix | relative_url }}" alt="Stylized sloth portrait" loading="lazy" decoding="async"/></a>
</div>
