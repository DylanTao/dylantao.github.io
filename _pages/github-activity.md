---
layout: page
title: Build rhythm
description: Independent views of Sirui Tao's recent Codex tokens and long-term GitHub commits.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

<section class="github-activity-page" data-github-activity data-source="/DylanTao/github-activity.json">
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">CODEX TOKENS + GITHUB COMMITS</p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      Two independent measures: recent Codex tokens and long-term GitHub commits. Each keeps its own time horizon, source, and controls.
    </p>
    {% assign account_lifetime = site.data.agentic_usage.account_lifetime %}
  </header>

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
        <p class="github-activity-module-kicker">GITHUB COMMITS</p>
        <h2 id="github-activity-github-title">GitHub contribution history</h2>
        <p>Weekly commits across the selected history. Readable keeps quieter weeks visible beside large release bursts.</p>
      </div>
      <span class="github-activity-scope-badge" data-github-scope>5 YEARS · WEEKLY</span>
    </div>

    <div class="github-activity-controls" aria-label="GitHub commit chart controls">
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
        <legend>Commit scale</legend>
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
          <span class="github-activity-commits" id="github-activity-selected-commits"></span>
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
      <h2 class="sr-only" id="github-activity-chart-title">Weekly GitHub commits</h2>
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
        <h2>Two units, two horizons</h2>
        <p>Codex tokens cover 30 days. GitHub commits use a separate weekly calendar across the selected repository history.</p>
      </div>
      <div>
        <h2>Readable or literal</h2>
        <p>Readable uses a log1p commit scale so quieter weeks remain visible. Literal uses the full linear range. Exact values never change.</p>
      </div>
      <div>
        <h2>What's counted</h2>
        <p>Owned public and private repositories, rolled up by week on their default branches. Only aggregate commit totals leave the generator.</p>
      </div>
      <div>
        <h2>GitHub's edges</h2>
        <p>Contributor statistics supply totals and commit history fills gaps. Merge commits are skipped, so this is a build-rhythm view rather than a productivity score.</p>
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
    <div class="github-activity-table-wrap">
      <table class="github-activity-table">
        <caption id="github-activity-table-caption">Exact weekly commits in the selected time window</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Commits</th>
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
