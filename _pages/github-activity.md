---
layout: page
title: Build rhythm
description: Independent views of repo-scoped retained-session token rhythm, rounded lifetime Codex usage, and long-term GitHub build rhythm.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

<section class="github-activity-page" data-github-activity data-source="/DylanTao/github-activity.json">
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">REPO TOKEN RHYTHM + LIFETIME CODEX USAGE + GITHUB BUILD RHYTHM</p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      Three bounded views: a repo-scoped retained-session token estimate, one rounded lifetime Codex total, and long-term GitHub activity. They share a page, not a denominator.
    </p>
    {% assign direct_tracker = site.data.direct_usage_tracker %}
    {% assign combined_lifetime = direct_tracker.combined_lifetime %}
    {% assign token_rhythm = site.data.agentic_usage.total.token_rhythm %}
    {% assign token_latest = token_rhythm.points | last %}
    {% assign token_previous_count = 0 %}
    {% assign token_largest_increase = 0 %}
    {% assign token_largest_increase_date = token_rhythm.since %}
    {% for token_point in token_rhythm.points %}
      {% assign token_daily_increase = token_point.token_count | minus: token_previous_count %}
      {% if token_daily_increase > token_largest_increase %}
        {% assign token_largest_increase = token_daily_increase %}
        {% assign token_largest_increase_date = token_point.date %}
      {% endif %}
      {% assign token_previous_count = token_point.token_count %}
    {% endfor %}
  </header>

  <section
    class="build-rhythm-story"
    data-build-rhythm-story
    data-state="loading"
    data-story-static="true"
    aria-labelledby="build-rhythm-story-title"
  >
    <header class="build-rhythm-story-heading">
      <p class="build-rhythm-story-kicker">A SCROLL-LED READING</p>
      <div class="build-rhythm-story-title-row">
        <h2 id="build-rhythm-story-title">Three clocks, no one score.</h2>
        {% include widget_origin_link.liquid href="/projects/build-rhythm/" label="Want to learn this widget's origin?" %}
      </div>
      <p>
        Commits and line changes describe a long build rhythm. Retained-session tokens trace this site's estimated build history on a daily
        clock. The direct tracker adds one rounded lifetime Codex total. It stays separate from the repo-scoped estimate.
      </p>
    </header>

    <div class="build-rhythm-story-layout">
      <div class="build-rhythm-story-stage-wrap" aria-hidden="true">
        <div class="build-rhythm-story-stage" data-build-rhythm-story-stage data-scene="complete" data-transitioning="false">
          <div class="build-rhythm-story-stage-heading">
            <span data-build-rhythm-story-label>COMPLETE VIEW</span>
            <span data-build-rhythm-story-scope>5 YEARS + DAILY REPO TOKENS + LIFETIME TOTAL</span>
          </div>
          <svg class="build-rhythm-story-chart" data-build-rhythm-story-chart focusable="false"></svg>
          <p class="build-rhythm-story-readout" data-build-rhythm-story-readout>
            GitHub cadence, repo-scoped token rhythm, and separate lifetime Codex usage.
          </p>
        </div>
      </div>

      <div class="build-rhythm-story-steps">
        <article class="build-rhythm-story-step" data-build-rhythm-step="cadence">
          <p class="build-rhythm-story-step-number">01 · CADENCE</p>
          <h3>A commit is a beat, not a score.</h3>
          <p>
            Weekly commits show when building clustered and when it went quiet. They describe cadence, not effort, quality, or productivity.
          </p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="magnitude">
          <p class="build-rhythm-story-step-number">02 · MAGNITUDE + DIRECTION</p>
          <h3>The same week can carry a different amount of change.</h3>
          <p>
            Additions rise above the baseline and deletions fall below it. These measures stay synchronized to the same week, but neither
            explains why the change happened.
          </p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="bursts">
          <p class="build-rhythm-story-step-number">03 · READABLE + LITERAL</p>
          <h3>Large releases can flatten the quieter weeks.</h3>
          <p>
            The readable transform gives smaller bursts room to remain visible. Literal restores the full linear distance. The underlying
            reported values never change.
          </p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="tokens">
          <p class="build-rhythm-story-step-number">04 · RETAINED-SESSION TOKENS</p>
          <h3>Token accumulation is a trace, not a score.</h3>
          <p>
            Daily cumulative points use the same deduplicated, repo-scoped retained-log estimate as the homepage ledger and can revise when
            retained local evidence changes. The current rounded endpoint is
            <strong>{{ token_latest.tokens_label }}</strong> through <time datetime="{{ token_latest.date }}">{{ token_latest.date | date: "%b %-d, %Y" }}</time>;
            the largest rounded adjacent-point increase is <data value="{{ token_largest_increase }}">{{ token_largest_increase }}</data>
            estimated tokens on <time datetime="{{ token_largest_increase_date }}">{{ token_largest_increase_date | date: "%b %-d, %Y" }}</time>.
          </p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="lifetime">
          <p class="build-rhythm-story-step-number">05 · CHANGE THE MEASURE</p>
          <h3>A lifetime total is not this repo's trace.</h3>
          <p>
            The direct tracker publishes one rounded combined total with its own observation date. The daily trace above estimates the retained-token
            rhythm for this repository. They answer different questions, so the page never adds them.
          </p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="explore">
          <p class="build-rhythm-story-step-number">06 · GITHUB EXPLORATION</p>
          <h3>The story chooses a few views. The explorer keeps the record.</h3>
          <p>
            Continue for GitHub range and scale controls, selected-week keyboard inspection, source notes, and exact weekly aggregate tables.
          </p>
          <a class="build-rhythm-story-explore" href="#github-activity-github-title">Explore the full build rhythm</a>
        </article>
      </div>
    </div>

    <p class="build-rhythm-story-credit">
      Interaction direction inspired by
      <a href="https://rhythm-of-food.net/" target="_blank" rel="noopener noreferrer"><em>The Rhythm of Food</em></a>
      by Google News Lab and Truth &amp; Beauty, shared with me by <a href="https://jrthomp.com/" target="_blank" rel="noopener noreferrer">John Thompson</a>.
    </p>

  </section>

{% if direct_tracker.schema == 3 and combined_lifetime %}

<section
      class="github-activity-codex-trend"
      data-codex-usage
      data-state="loading"
      data-source="{{ '/assets/data/codex-profile-usage.json' | relative_url }}"
      aria-labelledby="github-activity-codex-title"
      aria-busy="true"
    >
<div class="github-activity-codex-heading">
<div>
<p class="github-activity-codex-kicker">LIFETIME CODEX SNAPSHOT</p>
<h2 id="github-activity-codex-title">Combined lifetime Codex tokens</h2>
<p>One rounded total, refreshed independently from this repository's retained-session estimate.</p>
</div>
<div class="github-activity-module-actions">
<span class="github-activity-scope-badge" data-codex-scope>LIFETIME · ROUNDED</span>
</div>
</div>
<dl class="github-activity-codex-ledger" aria-label="Combined lifetime Codex usage">
<div>
<dt data-codex-lifetime>{{ combined_lifetime.tokens_label }}</dt>
<dd>combined lifetime Codex tokens</dd>
</div>
</dl>
<p class="github-activity-codex-readout" data-codex-status>
{% if direct_tracker.automated_refresh %}
  Refreshed <time datetime="{{ direct_tracker.updated_at }}">{{ direct_tracker.updated_at | date: "%b %-d, %Y at %-I:%M %p UTC" }}</time>.
{% else %}
  User-reported checkpoint · <time datetime="{{ direct_tracker.observed_on }}">{{ direct_tracker.observed_on | date: "%b %-d, %Y" }}</time> · automatic refresh pending.
{% endif %}
</p>
<p class="github-activity-codex-note">
Rounded before publication. No source-level identity, plan, history, reset time, or cost conversion reaches this page, and this total is never
added to the repo-scoped retained-session estimate.
</p>
</section>
{% endif %}

  <section class="github-activity-workbench" aria-labelledby="github-activity-github-title">
    <div class="github-activity-module-heading">
      <div>
        <p class="github-activity-module-kicker">GITHUB ACTIVITY</p>
        <h2 id="github-activity-github-title">GitHub contribution history</h2>
        <p>Weekly commits, additions, and deletions. Readable keeps quieter weeks visible beside large release bursts.</p>
      </div>
      <span class="github-activity-scope-badge" data-github-scope>5 YEARS · WEEKLY</span>
    </div>

    <div class="github-activity-controls" aria-label="GitHub activity chart controls">
      <fieldset class="github-activity-control-group">
        <legend>GitHub time window</legend>
        <div class="github-activity-segments" data-range-controls>
          <button type="button" data-range="1" aria-pressed="false">1 year</button>
          <button type="button" data-range="3" aria-pressed="false">3 years</button>
          <button type="button" data-range="5" aria-pressed="true">5 years</button>
          <button type="button" data-range="all" aria-pressed="false">All</button>
        </div>
      </fieldset>
      <fieldset class="github-activity-control-group">
        <legend>Chart scale</legend>
        <div class="github-activity-segments" data-scale-controls>
          <button type="button" data-scale="log" aria-pressed="true">Readable</button>
          <button type="button" data-scale="linear" aria-pressed="false">Literal</button>
        </div>
      </fieldset>
    </div>

    <div class="github-activity-readout">
      <div>
        <p class="github-activity-readout-label" id="github-activity-selected-date">Latest week</p>
        <p class="github-activity-values">
          <span class="github-activity-value-group"><span class="github-activity-commits" id="github-activity-selected-commits"></span></span>
          <span class="github-activity-value-group">
            <span aria-hidden="true">&middot;</span>
            <span class="github-activity-added" id="github-activity-selected-additions"></span>
          </span>
          <span class="github-activity-value-group">
            <span aria-hidden="true">&middot;</span>
            <span class="github-activity-removed" id="github-activity-selected-deletions"></span>
          </span>
        </p>
      </div>
      <button type="button" class="github-activity-latest" data-jump-latest>Jump to latest</button>
    </div>

    <div class="github-activity-range-status">
      <p class="github-activity-range-summary" id="github-activity-range-summary"></p>
      <button type="button" class="github-activity-clear-selection" data-clear-selection hidden>Clear selection</button>
      <span class="sr-only" id="github-activity-selection-announcement" aria-live="polite"></span>
    </div>

    <div class="github-activity-chart-shell">
      <h2 class="sr-only" id="github-activity-chart-title">Weekly GitHub commits, additions, and deletions</h2>
      <p class="sr-only" id="github-activity-chart-instructions">
        Hover or click to inspect a week. Drag horizontally to select a range. With keyboard focus, use arrow keys to inspect, Shift plus
        an arrow key to extend a range, Home or End to jump, Page Up or Page Down to move four weeks, and Escape to clear a selection.
      </p>
      <svg
        id="github-activity-chart"
        class="github-activity-chart"
        role="group"
        aria-labelledby="github-activity-chart-title github-activity-chart-instructions"
      ></svg>
      <p class="github-activity-annotation" id="github-activity-annotation"></p>
    </div>

  </section>

  <details class="github-activity-method">
    <summary>How this view works</summary>
    <div class="github-activity-method-grid">
      <div>
        <h2>Three bounded signals</h2>
        <p>Repo-scoped retained-session tokens, rounded lifetime Codex usage, and GitHub activity keep separate clocks and provenance.</p>
      </div>
      <div>
        <h2>Token rhythm</h2>
        <p>Rounded cumulative daily points come from deduplicated retained logs attributed to this site since the revamp cutoff. They are estimates, not lifetime totals.</p>
      </div>
      <div>
        <h2>Readable or literal</h2>
        <p>Readable uses log1p for commits and a symmetric log view for line changes. Literal uses the full linear range. Reported values never change.</p>
      </div>
      <div>
        <h2>What's counted</h2>
        <p>Owned public and private repositories are rolled up by week on default branches. Contributor statistics supply totals, commit history fills gaps, merge commits are skipped, and very large repositories may omit line totals.</p>
      </div>
      <div>
        <h2>Codex privacy boundary</h2>
        <p>Only a fresh sanitized collector projection can update the public total. It contains one rounded sum and no source-level readings.</p>
      </div>
      <div>
        <h2>Motion with a stop condition</h2>
        <p>Changing range or scale redraws the selected view once. The chart settles immediately, keeps exact tables, and remains static under reduced motion.</p>
      </div>
    </div>
    <section class="github-activity-token-evidence" aria-labelledby="github-activity-token-table-title">
      <h2 id="github-activity-token-table-title">Daily repo-token estimate</h2>
      <p>
        These server-rendered points remain available without JavaScript. They are rounded cumulative estimates, so differences between rows
        are rounded increases rather than exact daily usage.
      </p>
      <div
        class="github-activity-table-wrap"
        role="region"
        aria-label="Daily cumulative repo-token estimate table"
        tabindex="0"
      >
        <table class="github-activity-table">
          <caption>
            Rounded cumulative retained-session estimate from {{ token_rhythm.since | date: "%b %-d, %Y" }} through
            {{ token_rhythm.updated_at | date: "%b %-d, %Y" }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Cumulative estimate</th>
            </tr>
          </thead>
          <tbody id="github-activity-token-table-body">
            {% for token_point in token_rhythm.points %}
              <tr>
                <th scope="row"><time datetime="{{ token_point.date }}">{{ token_point.date | date: "%b %-d, %Y" }}</time></th>
                <td><data value="{{ token_point.token_count }}">{{ token_point.tokens_label }} estimated tokens</data></td>
              </tr>
            {% endfor %}
          </tbody>
        </table>
      </div>
    </section>
    <p class="github-activity-table-scroll-hint" id="github-activity-table-scroll-hint">Scroll horizontally for all columns.</p>
    <div
      class="github-activity-table-wrap"
      role="region"
      aria-label="Weekly GitHub activity table"
      aria-describedby="github-activity-table-scroll-hint"
      tabindex="0"
    >
      <table class="github-activity-table">
        <caption id="github-activity-table-caption">Reported weekly activity in the selected time window</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Commits</th>
            <th scope="col">Added</th>
            <th scope="col">Removed</th>
            <th scope="col">Line changes</th>
          </tr>
        </thead>
        <tbody id="github-activity-table-body"></tbody>
      </table>
    </div>
  </details>

  <p class="github-activity-source">
    Aggregate GitHub snapshot updated <time id="github-activity-updated"></time>. The retained-session token rhythm is generated with the public
    agentic-usage ledger; the direct tracker identifies its own coverage above. Time-window and scale controls draw on
    <a href="https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf">UW's Vega-Lite interaction research</a>; keyboard and
    alternative-reading paths draw on <a href="https://www.frank.computer/chartability/">CMU's Chartability heuristics</a>.
  </p>

  <script id="github-activity-data" type="application/json">
    {{ site.data.github_activity | jsonify }}
  </script>
  <script id="build-rhythm-token-data" type="application/json">
    {{ token_rhythm | jsonify }}
  </script>
</section>
