---
layout: page
title: Build rhythm
description: A five-year view of Sirui Tao's weekly GitHub commits and code changes.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

<section class="github-activity-page" data-github-activity data-source="/DylanTao/github-activity.json">
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">GITHUB ACTIVITY</p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      Five years of commits and lines changed, one week at a time. Huge code drops can flatten everything else, so Readable keeps the
      quieter weeks in view.
    </p>
    {% assign account_lifetime = site.data.agentic_usage.account_lifetime %}
    {% assign local_lifetime = site.data.agentic_usage.local_lifetime %}
    {% if account_lifetime and local_lifetime %}
      <dl class="github-activity-codex-ledger" aria-label="Codex usage snapshot">
        <div>
          <dt>{{ account_lifetime.tokens_label }}</dt>
          <dd>Codex lifetime</dd>
        </div>
        <div>
          <dt>{{ account_lifetime.api_cost_equivalence.usd_label }}</dt>
          <dd>API-rate estimate</dd>
        </div>
        <div>
          <dt>{{ local_lifetime.tokens_label }}</dt>
          <dd>local replay since {{ local_lifetime.since_label }}</dd>
        </div>
      </dl>
      <p class="github-activity-ledger-note">
        The account total gets the headline; the local replay keeps the receipts. Cost follows the observed model and cache mix, not the bill.
        {% if account_lifetime.recent_activity.partial_last_day %}{{ account_lifetime.recent_activity.end_label }} is partial.{% endif %}
      </p>
    {% endif %}
  </header>

  <section class="github-activity-workbench" aria-labelledby="github-activity-chart-title">
    <div class="github-activity-controls" aria-label="Chart controls">
      <fieldset class="github-activity-control-group">
        <legend>Time window</legend>
        <div class="github-activity-segments" data-range-controls>
          <button type="button" data-range="1" aria-pressed="false">1 year</button>
          <button type="button" data-range="3" aria-pressed="false">3 years</button>
          <button type="button" data-range="5" aria-pressed="true">5 years</button>
          <button type="button" data-range="all" aria-pressed="false">All</button>
        </div>
      </fieldset>
      <fieldset class="github-activity-control-group">
        <legend>Scale</legend>
        <div class="github-activity-segments" data-scale-controls>
          <button type="button" data-scale="symlog" aria-pressed="true">Readable</button>
          <button type="button" data-scale="linear" aria-pressed="false">Literal</button>
        </div>
      </fieldset>
    </div>

    <div class="github-activity-readout">
      <div>
        <p class="github-activity-readout-label" id="github-activity-selected-date">Latest week</p>
        <p class="github-activity-values">
          <span class="github-activity-commits" id="github-activity-selected-commits" data-commit-only hidden></span>
          <span data-commit-only aria-hidden="true" hidden>·</span>
          <span class="github-activity-added" id="github-activity-selected-additions">+0 added</span>
          <span aria-hidden="true">·</span>
          <span class="github-activity-removed" id="github-activity-selected-deletions">−0 removed</span>
        </p>
        <p class="github-activity-tier-context" id="github-activity-selected-tier" aria-live="polite"></p>
      </div>
      <button type="button" class="github-activity-latest" data-jump-latest>Jump to latest</button>
    </div>

    <div class="github-activity-range-status">
      <p class="github-activity-range-summary" id="github-activity-range-summary"></p>
      <button type="button" class="github-activity-clear-selection" data-clear-selection hidden>Clear selection</button>
      <span class="sr-only" id="github-activity-selection-announcement" aria-live="polite"></span>
    </div>

    <div class="github-activity-tier-legend" aria-label="Monthly plan price ribbon legend">
      <span>Plan price</span>
      <ul>
        <li>
          <button type="button" class="github-activity-tier-legend-button" data-tier-inspector="20" aria-controls="github-activity-selected-tier">
            <span class="github-activity-tier-swatch" data-tier-value="20" aria-hidden="true"></span>$20/mo
          </button>
        </li>
        <li>
          <button type="button" class="github-activity-tier-legend-button" data-tier-inspector="100" aria-controls="github-activity-selected-tier">
            <span class="github-activity-tier-swatch" data-tier-value="100" aria-hidden="true"></span>$100/mo
          </button>
        </li>
        <li>
          <button type="button" class="github-activity-tier-legend-button" data-tier-inspector="200" aria-controls="github-activity-selected-tier">
            <span class="github-activity-tier-swatch" data-tier-value="200" aria-hidden="true"></span>$200/mo
          </button>
        </li>
      </ul>
    </div>
    <p class="github-activity-tier-caveat">{{ site.data.github_ai_tiers.caveat }}</p>

    <div class="github-activity-chart-shell">
      <h2 class="sr-only" id="github-activity-chart-title">Weekly additions and deletions</h2>
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
        <h2>Two units, two panels</h2>
        <p>Commits sit above lines changed. They share a calendar, not a unit.</p>
      </div>
      <div>
        <h2>Readable or literal</h2>
        <p>Readable keeps quieter weeks visible. Literal shows the full linear range. The numbers stay the same.</p>
      </div>
      <div>
        <h2>What's counted</h2>
        <p>Owned public + private repositories, rolled up by week on their default branches. Only the totals leave the generator.</p>
      </div>
      <div>
        <h2>GitHub's edges</h2>
        <p>Contributor stats supply the totals; commit history fills gaps. Merge commits are skipped, and very large repositories may not report line totals.</p>
      </div>
      <div>
        <h2>Plan-price ribbon</h2>
        <p>The ribbon lines up each week with the monthly price paid at the time. Price is context—not measured AI use, productivity, or causation.</p>
      </div>
    </div>
    <section class="github-activity-tier-comparison" aria-labelledby="github-activity-tier-title">
      <div>
        <h2 id="github-activity-tier-title">Active weeks by plan price</h2>
        <p>Medians follow the current window or your drag selection.</p>
      </div>
      <div class="github-activity-table-wrap github-activity-tier-table-wrap">
        <table class="github-activity-table github-activity-tier-table">
          <caption id="github-activity-tier-caption">Subscription-tier comparison for the current time window</caption>
          <thead>
            <tr>
              <th scope="col">Tier</th>
              <th scope="col">Active / observed</th>
              <th scope="col">Median commits</th>
              <th scope="col">Median lines touched</th>
            </tr>
          </thead>
          <tbody id="github-activity-tier-table-body"></tbody>
        </table>
      </div>
    </section>
    <div class="github-activity-table-wrap">
      <table class="github-activity-table">
        <caption id="github-activity-table-caption">
          Exact weekly values in the selected time window
        </caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col" data-commit-only hidden>Commits</th>
            <th scope="col">Added</th>
            <th scope="col">Removed</th>
            <th scope="col">Lines touched</th>
          </tr>
        </thead>
        <tbody id="github-activity-table-body"></tbody>
      </table>
    </div>
  </details>

  <p class="github-activity-source">
    Aggregate snapshot updated <time id="github-activity-updated"></time>. The time-window and scale controls draw on
    <a href="https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf">UW's Vega-Lite interaction research</a>; keyboard and
    alternative-reading paths draw on <a href="https://www.frank.computer/chartability/">CMU's Chartability heuristics</a>.
  </p>

  <script id="github-activity-data" type="application/json">
    {{ site.data.github_activity | jsonify }}
  </script>
  <script id="github-activity-ai-tiers" type="application/json">
    {{ site.data.github_ai_tiers | jsonify }}
  </script>
</section>
