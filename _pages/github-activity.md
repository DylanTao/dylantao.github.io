---
layout: page
title: Build rhythm
description: Independent views of Sirui Tao's recent Codex tokens and long-term GitHub build rhythm.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

<section class="github-activity-page" data-github-activity data-source="/DylanTao/github-activity.json">
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">CODEX TOKENS + GITHUB BUILD RHYTHM</p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      Two independent views: recent Codex tokens and long-term GitHub activity. Each keeps its own time horizon, units, source, and controls.
    </p>
    {% assign account_lifetime = site.data.agentic_usage.account_lifetime %}
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
        <h2 id="build-rhythm-story-title">One page, two clocks.</h2>
        {% include widget_origin_link.liquid href="/projects/build-rhythm/" label="Want to learn this widget's origin?" %}
      </div>
      <p>
        Commits and line changes describe a long build rhythm. Codex tokens describe a separate, recent account snapshot. Scroll through the
        distinction, then use the explorer for every reported value.
      </p>
    </header>

    <div class="build-rhythm-story-layout">
      <div class="build-rhythm-story-stage-wrap" aria-hidden="true">
        <div class="build-rhythm-story-stage" data-build-rhythm-story-stage data-scene="complete" data-transitioning="false">
          <div class="build-rhythm-story-stage-heading">
            <span data-build-rhythm-story-label>COMPLETE VIEW</span>
            <span data-build-rhythm-story-scope>5 YEARS + LAST 30 DAYS</span>
          </div>
          <svg class="build-rhythm-story-chart" data-build-rhythm-story-chart focusable="false"></svg>
          <p class="build-rhythm-story-readout" data-build-rhythm-story-readout>
            GitHub build rhythm above. The separate Codex clock below.
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

        <article class="build-rhythm-story-step" data-build-rhythm-step="codex">
          <p class="build-rhythm-story-step-number">04 · RESET THE CLOCK</p>
          <h3>Codex tokens belong to a different horizon.</h3>
          <p>
            This view covers only the latest 30 calendar days from a dated account snapshot. The visual resets its units and time span instead
            of implying that tokens caused the GitHub rhythm.
          </p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="explore">
          <p class="build-rhythm-story-step-number">05 · EXACT EXPLORATION</p>
          <h3>The story chooses a few views. The explorer keeps the record.</h3>
          <p>
            Continue for range and scale controls, selected-week keyboard inspection, source notes, and the exact reported-value tables.
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

{% if account_lifetime %}

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
<p class="github-activity-codex-kicker">CODEX TOKENS</p>
<h2 id="github-activity-codex-title">Recent Codex use</h2>
<p>Account tokens over the latest 30 calendar days. The weekly view starts on Sunday.</p>
</div>
<div class="github-activity-module-actions">
<span class="github-activity-scope-badge" data-codex-scope>LAST 30 DAYS · DAILY</span>
<div class="github-activity-codex-grain" aria-label="Codex token chart grain">
<button type="button" data-codex-grain="daily" aria-pressed="true" disabled>Daily</button>
<button type="button" data-codex-grain="weekly" aria-pressed="false" disabled>Weekly</button>
</div>
</div>
</div>
<dl class="github-activity-codex-ledger" aria-label="Codex lifetime token context">
<div>
<dt>{{ account_lifetime.tokens_label }}</dt>
<dd>lifetime Codex tokens</dd>
</div>
</dl>
<p class="github-activity-ledger-note">
Lifetime context comes from authenticated Codex account activity; this chart is a dated 30-day snapshot.
{% if account_lifetime.recent_activity.partial_last_day %}{{ account_lifetime.recent_activity.end_label }} is partial.{% endif %}
</p>
<div class="github-activity-codex-readout">
<span data-codex-status>Loading recent Codex use…</span>
<span id="github-activity-codex-date" hidden></span>
<strong id="github-activity-codex-tokens" hidden></strong>
<span id="github-activity-codex-coverage" hidden></span>
</div>
<p class="sr-only" id="github-activity-codex-instructions">
Hover, tap, or focus the chart to inspect token use. With keyboard focus, use arrow keys to move one period and Home or End to jump.
</p>
<svg
        id="github-activity-codex-chart"
        class="github-activity-codex-chart"
        role="group"
        aria-labelledby="github-activity-codex-title github-activity-codex-instructions"
      ></svg>
<p class="github-activity-codex-note">
The chart and exact table share the same dated token snapshot. Partial days and weeks stay visibly labeled; values do not count up as if live.
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
        <h2>Four measures, two horizons</h2>
        <p>Codex tokens cover 30 days. GitHub commits, additions, and deletions use a separate weekly calendar across the selected history.</p>
      </div>
      <div>
        <h2>Readable or literal</h2>
        <p>Readable uses log1p for commits and a symmetric log view for line changes. Literal uses the full linear range. Reported values never change.</p>
      </div>
      <div>
        <h2>What's counted</h2>
        <p>Owned public and private repositories, rolled up by week on their default branches. Only weekly aggregate totals leave the generator.</p>
      </div>
      <div>
        <h2>GitHub's edges</h2>
        <p>Contributor statistics supply totals and commit history fills gaps. Merge commits are skipped, and very large repositories may omit line totals.</p>
      </div>
      <div>
        <h2>Codex account history</h2>
        <p>Daily account snapshots remain dated evidence. Weekly token totals use Sunday buckets; incomplete edge weeks stay partial.</p>
      </div>
      <div>
        <h2>Motion with a stop condition</h2>
        <p>Changing range or scale redraws the selected view once. The chart settles immediately, keeps exact tables, and remains static under reduced motion.</p>
      </div>
    </div>
    <section
      class="github-activity-codex-table-section"
      data-codex-table
      aria-labelledby="github-activity-codex-table-title"
      hidden
    >
      <div>
        <h2 id="github-activity-codex-table-title">Exact recent Codex values</h2>
        <p>The table follows the Daily or Weekly chart toggle.</p>
      </div>
      <div class="github-activity-table-wrap">
        <table class="github-activity-table github-activity-codex-table">
          <caption id="github-activity-codex-table-caption">Daily Codex account tokens</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Coverage</th>
              <th scope="col">Tokens</th>
            </tr>
          </thead>
          <tbody id="github-activity-codex-table-body"></tbody>
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
    Aggregate GitHub snapshot updated <time id="github-activity-updated"></time>. The Codex chart identifies its own dated coverage above. Time-window and
    scale controls draw on <a href="https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf">UW's Vega-Lite interaction research</a>; keyboard and
    alternative-reading paths draw on <a href="https://www.frank.computer/chartability/">CMU's Chartability heuristics</a>.
  </p>

  <script id="github-activity-data" type="application/json">
    {{ site.data.github_activity | jsonify }}
  </script>
</section>
