---
layout: page
title: Build rhythm
description: A privacy-safe, outlier-aware view of Sirui Tao's weekly GitHub commits and code changes.
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
      Weekly commits and lines touched across owned repositories. Aligned panels keep the units honest; the readable line scale keeps
      ordinary weeks visible beside rare, unusually large changes.
    </p>
    <p class="github-activity-boundary">Lines touched are evidence of change, not a productivity score.</p>
    {% assign local_lifetime = site.data.agentic_usage.local_lifetime %}
    {% if local_lifetime %}
      <p class="github-activity-local-history">
        Retained local Codex history since {{ local_lifetime.since_label }}:
        <strong>{{ local_lifetime.tokens_label }} tracked tokens</strong> across {{ local_lifetime.sessions }} sessions · about
        {{ local_lifetime.api_cost_equivalence.usd_label | remove: ' API cosplay' }} at logged-model Standard short-context API rates,
        excluding unobserved cache writes and long-context premiums.
        This is retained device history, not account lifetime usage or an actual bill; ChatGPT exposes usage limits, not a lifetime token counter.
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
        <p class="github-activity-tier-context" id="github-activity-selected-tier"></p>
      </div>
      <button type="button" class="github-activity-latest" data-jump-latest>Jump to latest</button>
    </div>

    <div class="github-activity-range-status">
      <p class="github-activity-range-summary" id="github-activity-range-summary"></p>
      <button type="button" class="github-activity-clear-selection" data-clear-selection hidden>Clear selection</button>
      <span class="sr-only" id="github-activity-selection-announcement" aria-live="polite"></span>
    </div>

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
        <h2>Aligned, not dual-axis</h2>
        <p>
          Commits use a compact panel above the line-change panel. The shared time axis supports exact-week hover, click-to-pin, and a
          snapped drag selection without pretending commits and lines share a unit.
        </p>
      </div>
      <div>
        <h2>Readable and literal</h2>
        <p>
          Readable uses log1p for commits and a symmetric-log transform for added and removed lines, preserving zero while compressing
          extremes. Literal switches both panels to independent linear scales. Exact values never change.
        </p>
      </div>
      <div>
        <h2>Scope and privacy</h2>
        <p>
          The data is aggregated from owned repositories' default-branch activity. Repository identities are never published.
        </p>
      </div>
      <div>
        <h2>GitHub boundaries</h2>
        <p>
          Default-branch activity uses GitHub contributor statistics, with a commit-history fallback when those statistics are
          unavailable. GitHub's statistics exclude merge commits; the fallback also excludes true empty commits. The contributor-stat
          source zeroes line totals for repositories with 10,000 or more commits.
        </p>
      </div>
      <div>
        <h2>Subscription context</h2>
        <p>
          The thin timeline ribbon uses user-supplied billing dates rounded to Plus $20, $100, or $200 tiers. A week is assigned by its
          Wednesday midpoint. Billing tier is context—not measured AI use, causation, or productivity—and raw invoices are not published.
        </p>
      </div>
    </div>
    <section class="github-activity-tier-comparison" aria-labelledby="github-activity-tier-title">
      <div>
        <h2 id="github-activity-tier-title">Observed active weeks by subscription tier in this scope</h2>
        <p>Median active-week values update with the time window or drag selection. They reduce unequal-duration and outlier effects; association only.</p>
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
