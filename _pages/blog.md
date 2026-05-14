---
layout: default
permalink: /blog/
title: blog
nav: true
nav_order: 3
panel_wide: true
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 5
  sort_field: date
  sort_reverse: true
  trail:
    before: 1 # The number of links before the current page
    after: 3 # The number of links after the current page
---

<div class="post">

{% assign blog_name_size = site.blog_name | size %}
{% assign blog_description_size = site.blog_description | size %}
{% assign active_posts = site.posts | where_exp: 'post', 'post.published != false and post.date <= site.time' %}
{% assign all_active_tags = '' | split: '' %}
{% assign all_active_categories = '' | split: '' %}

{% for post in active_posts %}
{% if post.tags %}
{% assign all_active_tags = all_active_tags | concat: post.tags %}
{% endif %}
{% if post.categories %}
{% assign all_active_categories = all_active_categories | concat: post.categories %}
{% endif %}
{% endfor %}

{% assign unique_active_tags = all_active_tags | uniq %}
{% assign ranked_tag_entries = '' | split: '' %}

{% for tag in unique_active_tags %}
{% assign tag_count = 0 %}
{% assign latest_tag_date = '00000000' %}

{% for post in active_posts %}
{% if post.tags and post.tags contains tag %}
{% assign tag_count = tag_count | plus: 1 %}
{% assign post_date_key = post.date | date: '%Y%m%d' %}
{% if post_date_key > latest_tag_date %}
{% assign latest_tag_date = post_date_key %}
{% endif %}
{% endif %}
{% endfor %}

{% if tag_count > 0 %}
{% assign inverse_tag_count = 9999 | minus: tag_count %}
{% assign inverse_tag_date = 99999999 | minus: latest_tag_date %}
{% capture padded_inverse_tag_count %}0000{{ inverse_tag_count }}{% endcapture %}
{% capture padded_inverse_tag_date %}00000000{{ inverse_tag_date }}{% endcapture %}
{% capture rank_entry %}{{ padded_inverse_tag_count | slice: -4, 4 }}::{{ padded_inverse_tag_date | slice: -8, 8 }}::{{ tag }}{% endcapture %}
{% assign ranked_tag_entries = ranked_tag_entries | push: rank_entry %}
{% endif %}
{% endfor %}

{% assign ranked_tag_entries = ranked_tag_entries | sort %}
{% assign display_tags_limit = site.display_tags_limit | default: 5 %}
{% assign featured_tags = '' | split: '' %}

{% for rank_entry in ranked_tag_entries limit: display_tags_limit %}
{% assign rank_parts = rank_entry | split: '::' %}
{% assign featured_tags = featured_tags | push: rank_parts[2] %}
{% endfor %}

{% assign unique_active_categories = all_active_categories | uniq %}
{% assign ranked_category_entries = '' | split: '' %}

{% for category in unique_active_categories %}
{% assign category_count = 0 %}
{% assign latest_category_date = '00000000' %}

{% for post in active_posts %}
{% if post.categories and post.categories contains category %}
{% assign category_count = category_count | plus: 1 %}
{% assign post_date_key = post.date | date: '%Y%m%d' %}
{% if post_date_key > latest_category_date %}
{% assign latest_category_date = post_date_key %}
{% endif %}
{% endif %}
{% endfor %}

{% if category_count > 0 %}
{% assign inverse_category_count = 9999 | minus: category_count %}
{% assign inverse_category_date = 99999999 | minus: latest_category_date %}
{% capture padded_inverse_category_count %}0000{{ inverse_category_count }}{% endcapture %}
{% capture padded_inverse_category_date %}00000000{{ inverse_category_date }}{% endcapture %}
{% capture rank_entry %}{{ padded_inverse_category_count | slice: -4, 4 }}::{{ padded_inverse_category_date | slice: -8, 8 }}::{{ category }}{% endcapture %}
{% assign ranked_category_entries = ranked_category_entries | push: rank_entry %}
{% endif %}
{% endfor %}

{% assign ranked_category_entries = ranked_category_entries | sort %}
{% assign display_categories_limit = site.display_categories_limit | default: 2 %}
{% assign featured_categories = '' | split: '' %}

{% for rank_entry in ranked_category_entries limit: display_categories_limit %}
{% assign rank_parts = rank_entry | split: '::' %}
{% assign featured_categories = featured_categories | push: rank_parts[2] %}
{% endfor %}
{% assign deduped_featured_tags = '' | split: '' %}

{% for tag in featured_tags %}
{% unless featured_categories contains tag %}
{% assign deduped_featured_tags = deduped_featured_tags | push: tag %}
{% endunless %}
{% endfor %}

{% assign featured_tags = deduped_featured_tags %}

{% if blog_name_size > 0 or blog_description_size > 0 %}

  <div class="header-bar">
    <h1 class="blog-secret-title">
      {{ site.blog_name }}
      <button id="sirui-secret-dog" class="sirui-secret-dog" type="button" aria-label="unlock sirui's secrets">
        <img src="{{ '/assets/img/meme_dog.png' | relative_url }}" alt="">
      </button>
    </h1>
    <h2>{{ site.blog_description }}</h2>
  </div>

  <div id="sirui-secret-dialog" class="sirui-secret-dialog" hidden>
    <div class="sirui-secret-panel" role="dialog" aria-modal="true" aria-labelledby="sirui-secret-title">
      <button id="sirui-secret-close" class="sirui-secret-close" type="button" aria-label="close">&times;</button>
      <h3 id="sirui-secret-title">the hidden gate</h3>
      <form id="sirui-secret-form">
        <label for="sirui-secret-password">speak the spell</label>
        <div class="sirui-secret-row">
          <input id="sirui-secret-password" type="password" autocomplete="current-password" required>
          <button type="submit">unlock</button>
        </div>
      </form>
    </div>
  </div>

  <style>
    .blog-secret-title {
      align-items: center;
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.18em;
      justify-content: center;
    }

    .sirui-secret-dog {
      -webkit-tap-highlight-color: transparent;
      align-items: center;
      background: transparent;
      border: 0;
      cursor: pointer;
      display: inline-flex;
      justify-content: center;
      line-height: 1;
      min-height: 44px;
      min-width: 44px;
      padding: 0;
      touch-action: manipulation;
      transform: translateY(0.04em);
    }

    .sirui-secret-dog img {
      border-radius: 50%;
      height: 0.84em;
      object-fit: cover;
      transform-origin: 50% 78%;
      transition:
        transform 160ms ease,
        filter 160ms ease;
      vertical-align: middle;
      width: 0.84em;
    }

    .sirui-secret-dog:focus-visible {
      outline: 2px solid var(--global-theme-color);
      outline-offset: 0.18em;
    }

    @keyframes sirui-dog-curious {
      0% {
        filter: saturate(1) drop-shadow(0 0 0 transparent);
        transform: translateY(0) rotate(0deg) scale(1);
      }

      12% {
        transform: translateY(0.02em) rotate(-4deg) scale(0.97);
      }

      38% {
        filter: saturate(1.08) drop-shadow(0 0.08rem 0.16rem rgba(0, 0, 0, 0.12));
        transform: translateY(-0.02em) rotate(14deg) scale(1.08);
      }

      68% {
        transform: translateY(-0.01em) rotate(10deg) scale(1.05);
      }

      100% {
        filter: saturate(1.12) drop-shadow(0 0.1rem 0.2rem rgba(0, 0, 0, 0.14));
        transform: translateY(-0.01em) rotate(12deg) scale(1.06);
      }
    }

    @keyframes sirui-dog-suspicious {
      0%,
      100% {
        filter: saturate(1) drop-shadow(0 0 0 transparent);
        transform: translateX(0) translateY(0) rotate(0deg) scale(1);
      }

      16% {
        transform: translateX(0) translateY(0.025em) rotate(2deg) scale(0.96);
      }

      34%,
      48% {
        filter: saturate(1.08) drop-shadow(0 0.09rem 0.18rem rgba(0, 0, 0, 0.13));
        transform: translateX(-0.045em) translateY(-0.02em) rotate(-9deg) scale(1.09);
      }

      58% {
        transform: translateX(0.035em) translateY(-0.02em) rotate(6deg) scale(1.07);
      }

      69% {
        transform: translateX(-0.025em) translateY(-0.015em) rotate(-5deg) scale(1.06);
      }

      80% {
        transform: translateX(0.015em) translateY(-0.01em) rotate(3deg) scale(1.04);
      }
    }

    @keyframes sirui-dog-wiggle {
      0%,
      100% {
        filter: saturate(1) drop-shadow(0 0 0 transparent);
        transform: rotate(0deg) scale(1);
      }

      10% {
        transform: rotate(0deg) scale(0.97, 1.03);
      }

      26% {
        transform: rotate(-16deg) scale(1.08, 0.96);
      }

      43% {
        filter: saturate(1.1) drop-shadow(0 0.1rem 0.18rem rgba(0, 0, 0, 0.14));
        transform: rotate(15deg) scale(0.98, 1.08);
      }

      60% {
        transform: rotate(-10deg) scale(1.05, 0.98);
      }

      78% {
        transform: rotate(5deg) scale(1.02);
      }
    }

    @keyframes sirui-dog-victory-roll {
      0% {
        filter: saturate(1) drop-shadow(0 0 0 transparent);
        transform: translateY(0) rotate(0deg) scale(1);
      }

      14% {
        transform: translateY(0.02em) rotate(-8deg) scale(0.95);
      }

      54% {
        filter: saturate(1.16) drop-shadow(0 0.12rem 0.22rem rgba(0, 0, 0, 0.16));
        transform: translateY(-0.07em) rotate(370deg) scale(1.12);
      }

      74% {
        transform: translateY(0.025em) rotate(354deg) scale(0.98);
      }

      88% {
        transform: translateY(-0.015em) rotate(363deg) scale(1.05);
      }

      100% {
        filter: saturate(1.08) drop-shadow(0 0.07rem 0.14rem rgba(0, 0, 0, 0.12));
        transform: translateY(0) rotate(360deg) scale(1.03);
      }
    }

    @keyframes sirui-dog-glitch-secret {
      0%,
      100% {
        filter: saturate(1) hue-rotate(0deg) drop-shadow(0 0 0 transparent);
        transform: translate(0, 0) rotate(0deg) scale(1);
      }

      12% {
        transform: translateY(0.02em) rotate(-3deg) scale(0.95);
      }

      25% {
        filter: saturate(1.45) hue-rotate(10deg)
          drop-shadow(0 0 0.24rem rgba(199, 0, 194, 0.36));
        transform: translate(-0.035em, -0.025em) rotate(8deg) scale(1.18);
      }

      34% {
        transform: translate(0.04em, 0.015em) rotate(-7deg) scale(1.08);
      }

      46% {
        filter: saturate(1.6) hue-rotate(-12deg)
          drop-shadow(0 0 0.3rem rgba(199, 0, 194, 0.42));
        transform: translate(-0.025em, -0.04em) rotate(378deg) scale(1.16);
      }

      63% {
        transform: translate(0.015em, 0.015em) rotate(356deg) scale(0.98);
      }

      82% {
        filter: saturate(1.18) hue-rotate(0deg)
          drop-shadow(0 0.08rem 0.18rem rgba(0, 0, 0, 0.15));
        transform: translateY(-0.01em) rotate(362deg) scale(1.06);
      }
    }

    @keyframes sirui-dog-boop {
      0% {
        filter: saturate(1) drop-shadow(0 0 0 transparent);
        transform: translateY(0) rotate(0deg) scale(1);
      }

      18% {
        transform: translateY(0.025em) rotate(-6deg) scale(0.94);
      }

      46% {
        filter: saturate(1.16) drop-shadow(0 0.12rem 0.22rem rgba(0, 0, 0, 0.16));
        transform: translateY(-0.045em) rotate(18deg) scale(1.18);
      }

      68% {
        transform: translateY(0.01em) rotate(-8deg) scale(0.99);
      }

      84% {
        transform: translateY(-0.015em) rotate(4deg) scale(1.07);
      }

      100% {
        filter: saturate(1.08) drop-shadow(0 0.06rem 0.12rem rgba(0, 0, 0, 0.11));
        transform: translateY(0) rotate(0deg) scale(1.03);
      }
    }

    @media (hover: hover) and (pointer: fine) {
      .sirui-secret-dog.is-curious img {
        animation: sirui-dog-curious 1.55s ease-in-out infinite alternate;
      }

      .sirui-secret-dog.is-suspicious img {
        animation: sirui-dog-suspicious 1.45s ease-in-out infinite;
      }

      .sirui-secret-dog.is-wiggle img {
        animation: sirui-dog-wiggle 1.08s cubic-bezier(0.34, 1.56, 0.64, 1)
          both;
      }

      .sirui-secret-dog.is-victory-roll img {
        animation: sirui-dog-victory-roll 1.42s cubic-bezier(0.22, 1, 0.36, 1)
          both;
      }

      .sirui-secret-dog.is-glitch-secret img {
        animation: sirui-dog-glitch-secret 1.18s steps(2, end) both;
      }
    }

    .sirui-secret-dog.is-booping img {
      animation: sirui-dog-boop 780ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .sirui-secret-dialog[hidden] {
      display: none;
    }

    .sirui-secret-dialog {
      align-items: center;
      background: rgba(0, 0, 0, 0.42);
      display: flex;
      inset: 0;
      justify-content: center;
      padding: max(1rem, env(safe-area-inset-top))
        max(1rem, env(safe-area-inset-right))
        max(1rem, env(safe-area-inset-bottom))
        max(1rem, env(safe-area-inset-left));
      position: fixed;
      z-index: 2000;
    }

    .sirui-secret-panel {
      background: var(--global-bg-color);
      border: 1px solid var(--global-divider-color);
      border-radius: 0.5rem;
      box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.2);
      max-height: calc(100dvh - 2rem);
      max-width: 22rem;
      overflow: auto;
      padding: 1.2rem;
      position: relative;
      text-align: left;
      width: 100%;
    }

    .sirui-secret-panel h3 {
      font-size: 1.15rem;
      margin: 0 1.5rem 1rem 0;
    }

    .sirui-secret-close {
      background: transparent;
      border: 0;
      color: var(--global-text-color);
      cursor: pointer;
      font-size: 1.5rem;
      line-height: 1;
      position: absolute;
      right: 0.7rem;
      top: 0.55rem;
    }

    .sirui-secret-panel label {
      display: block;
      font-size: 0.9rem;
      margin-bottom: 0.35rem;
    }

    .sirui-secret-row {
      display: flex;
      gap: 0.5rem;
    }

    .sirui-secret-row input {
      flex: 1;
      min-width: 0;
    }

    .sirui-secret-row input,
    .sirui-secret-row button {
      border: 1px solid var(--global-divider-color);
      border-radius: 0.25rem;
      font-size: 16px;
      min-height: 44px;
      padding: 0.55rem 0.75rem;
    }

    .sirui-secret-row button {
      background: var(--global-theme-color);
      color: var(--global-bg-color);
      cursor: pointer;
    }

    @media (hover: none), (pointer: coarse) {
      .sirui-secret-dog img {
        height: 0.92em;
        width: 0.92em;
      }
    }

    @media (max-width: 420px) {
      .sirui-secret-dialog {
        align-items: flex-start;
      }

      .sirui-secret-panel {
        margin-top: 0.75rem;
        max-width: none;
      }

      .sirui-secret-row {
        flex-direction: column;
      }

      .sirui-secret-row button {
        width: 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sirui-secret-dog img,
      .sirui-secret-dog.is-curious img,
      .sirui-secret-dog.is-suspicious img,
      .sirui-secret-dog.is-wiggle img,
      .sirui-secret-dog.is-victory-roll img,
      .sirui-secret-dog.is-glitch-secret img,
      .sirui-secret-dog.is-booping img {
        animation: none;
        transition: none;
      }
    }
  </style>

  <script>
    (() => {
      const dog = document.getElementById("sirui-secret-dog");
      const dialog = document.getElementById("sirui-secret-dialog");
      const closeButton = document.getElementById("sirui-secret-close");
      const form = document.getElementById("sirui-secret-form");
      const password = document.getElementById("sirui-secret-password");
      const secretUrl = "{{ '/blog/2026/sirui-research-thoughts/' | relative_url }}";

      if (!dog || !dialog || !closeButton || !form || !password) return;

      const animationClasses = [
        "is-curious",
        "is-curious",
        "is-suspicious",
        "is-suspicious",
        "is-wiggle",
        "is-wiggle",
        "is-victory-roll",
        "is-glitch-secret",
      ];
      const animationClassSet = new Set(animationClasses);
      const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let activeDogAnimation = "";
      let dogResetTimer;

      const clearDogAnimation = () => {
        animationClassSet.forEach((className) => dog.classList.remove(className));
        activeDogAnimation = "";
      };

      const pickDogAnimation = () =>
        animationClasses[Math.floor(Math.random() * animationClasses.length)];

      const startDogHoverAnimation = () => {
        window.clearTimeout(dogResetTimer);

        if (!finePointer.matches || reducedMotion.matches || activeDogAnimation) {
          return;
        }

        clearDogAnimation();
        activeDogAnimation = pickDogAnimation();
        dog.classList.add(activeDogAnimation);
      };

      const stopDogHoverAnimation = () => {
        if (!activeDogAnimation) return;

        window.clearTimeout(dogResetTimer);
        dogResetTimer = window.setTimeout(clearDogAnimation, 140);
      };

      const boopDog = () => {
        if (reducedMotion.matches) return;

        window.clearTimeout(dogResetTimer);
        dog.classList.remove("is-booping");
        void dog.offsetWidth;
        dog.classList.add("is-booping");
        window.setTimeout(() => dog.classList.remove("is-booping"), 820);
      };

      const openDialog = () => {
        boopDog();
        dialog.hidden = false;
        password.value = "";
        if (window.matchMedia("(pointer: fine)").matches) {
          window.setTimeout(() => password.focus(), 0);
        }
      };

      const closeDialog = () => {
        dialog.hidden = true;
      };

      dog.addEventListener("pointerenter", startDogHoverAnimation);
      dog.addEventListener("pointerleave", stopDogHoverAnimation);
      dog.addEventListener("focus", startDogHoverAnimation);
      dog.addEventListener("blur", stopDogHoverAnimation);
      dog.addEventListener("click", openDialog);
      closeButton.addEventListener("click", closeDialog);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !dialog.hidden) closeDialog();
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        sessionStorage.setItem(
          "siruiResearchThoughtsPassword",
          password.value.trim(),
        );
        window.location.href = secretUrl;
      });
    })();
  </script>

{% endif %}

{% if featured_tags.size > 0 or featured_categories.size > 0 %}

  <div class="tag-category-list">
    <ul class="p-0 m-0">
      {% for tag in featured_tags %}
        <li>
          <i class="fa-solid fa-hashtag fa-sm"></i> <a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">{{ tag }}</a>
        </li>
        {% unless forloop.last %}
          <p>&bull;</p>
        {% endunless %}
      {% endfor %}
      {% if featured_categories.size > 0 and featured_tags.size > 0 %}
        <p>&bull;</p>
      {% endif %}
      {% for category in featured_categories %}
        <li>
          <i class="fa-solid fa-tag fa-sm"></i> <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">{{ category }}</a>
        </li>
        {% unless forloop.last %}
          <p>&bull;</p>
        {% endunless %}
      {% endfor %}
    </ul>
  </div>
  {% endif %}

{% assign featured_posts = site.posts | where: "featured", "true" %}
{% if featured_posts.size > 0 %}
<br>

<div class="featured-posts">
{% assign is_even = featured_posts.size | modulo: 2 %}
<div class="row row-cols-{% if featured_posts.size <= 2 or is_even == 0 %}2{% else %}3{% endif %}">
{% for post in featured_posts %}
<div class="col mb-4">
<a href="{{ post.url | relative_url }}">
<div class="card hoverable">
<div class="row g-0">
<div class="col-md-12">
<div class="card-body">
<div class="float-right">
<i class="fa-solid fa-thumbtack fa-xs"></i>
</div>
<h3 class="card-title text-lowercase">{{ post.title }}</h3>
<p class="card-text">{{ post.description }}</p>

                    {% if post.external_source == blank %}
                      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
                    {% else %}
                      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
                    {% endif %}
                    {% assign year = post.date | date: "%Y" %}

                    <p class="post-meta">
                      {{ read_time }} min read &nbsp; &middot; &nbsp;
                      <a href="{{ year | prepend: '/blog/' | relative_url }}">
                        <i class="fa-solid fa-calendar fa-sm"></i> {{ year }} </a>
                      <span class="js-blog-read-count-wrap" hidden>
                        &nbsp; &middot; &nbsp;
                        <span class="blog-read-count js-blog-read-count" data-blog-read-url="{{ post.url | absolute_url }}" data-blog-read-mode="display" hidden></span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </a>
        </div>
      {% endfor %}
      </div>
    </div>
    <hr>

{% endif %}

  <ul class="post-list">

    {% if page.pagination.enabled %}
      {% assign postlist = paginator.posts %}
    {% else %}
      {% assign postlist = site.posts %}
    {% endif %}

    {% for post in postlist %}

    {% if post.external_source == blank %}
      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
    {% else %}
      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
    {% endif %}
    {% assign year = post.date | date: "%Y" %}
    {% assign display_tags = '' | split: '' %}
    {% if post.tags %}
      {% for tag in post.tags %}
        {% unless post.categories and post.categories contains tag %}
          {% assign display_tags = display_tags | push: tag %}
        {% endunless %}
      {% endfor %}
    {% endif %}
    {% assign tags = display_tags | join: "" %}
    {% assign categories = post.categories | join: "" %}

    <li>

{% if post.thumbnail %}

<div class="row">
          <div class="col-sm-9">
{% endif %}
        <h3>
        {% if post.redirect == blank %}
          <a class="post-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
        {% elsif post.redirect contains '://' %}
          <a class="post-title" href="{{ post.redirect }}" target="_blank">{{ post.title }}</a>
          <svg width="2rem" height="2rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="#999" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        {% else %}
          <a class="post-title" href="{{ post.redirect | relative_url }}">{{ post.title }}</a>
        {% endif %}
      </h3>
      <p>{{ post.description }}</p>
      <p class="post-meta">
        {{ read_time }} min read &nbsp; &middot; &nbsp;
        {{ post.date | date: '%B %d, %Y' }}
        <span class="js-blog-read-count-wrap" hidden>
          &nbsp; &middot; &nbsp;
          <span class="blog-read-count js-blog-read-count" data-blog-read-url="{{ post.url | absolute_url }}" data-blog-read-mode="display" hidden></span>
        </span>
        {% if post.external_source %}
        &nbsp; &middot; &nbsp; {{ post.external_source }}
        {% endif %}
      </p>
      <p class="post-tags">
        <a href="{{ year | prepend: '/blog/' | relative_url }}">
          <i class="fa-solid fa-calendar fa-sm"></i> {{ year }} </a>

          {% if tags != "" %}
          &nbsp; &middot; &nbsp;
            {% for tag in display_tags %}
            <a href="{{ tag | slugify | prepend: '/blog/tag/' | relative_url }}">
              <i class="fa-solid fa-hashtag fa-sm"></i> {{ tag }}</a>
              {% unless forloop.last %}
                &nbsp;
              {% endunless %}
              {% endfor %}
          {% endif %}

          {% if categories != "" %}
          &nbsp; &middot; &nbsp;
            {% for category in post.categories %}
            <a href="{{ category | slugify | prepend: '/blog/category/' | relative_url }}">
              <i class="fa-solid fa-tag fa-sm"></i> {{ category }}</a>
              {% unless forloop.last %}
                &nbsp;
              {% endunless %}
              {% endfor %}
          {% endif %}
    </p>

{% if post.thumbnail %}

</div>

  <div class="col-sm-3">
    <img class="card-img" src="{{ post.thumbnail | relative_url }}" style="object-fit: cover; height: 90%" alt="image">
  </div>
</div>
{% endif %}
    </li>

    {% endfor %}

  </ul>

{% if page.pagination.enabled %}
{% include pagination.liquid %}
{% endif %}

</div>
