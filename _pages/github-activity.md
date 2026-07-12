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
        <legend>Line scale</legend>
        <div class="github-activity-segments" data-scale-controls>
          <button type="button" data-scale="symlog" aria-pressed="true">Readable</button>
          <button type="button" data-scale="linear" aria-pressed="false">Literal</button>
        </div>
      </fieldset>
    </div>

    <div class="github-activity-readout" aria-live="polite">
      <div>
        <p class="github-activity-readout-label" id="github-activity-selected-date">Latest week</p>
        <p class="github-activity-values">
          <span class="github-activity-commits" id="github-activity-selected-commits" data-commit-only hidden></span>
          <span data-commit-only aria-hidden="true" hidden>·</span>
          <span class="github-activity-added" id="github-activity-selected-additions">+0 added</span>
          <span aria-hidden="true">·</span>
          <span class="github-activity-removed" id="github-activity-selected-deletions">−0 removed</span>
        </p>
      </div>
      <button type="button" class="github-activity-latest" data-jump-latest>Jump to latest</button>
    </div>

    <p class="github-activity-range-summary" id="github-activity-range-summary"></p>

    <div class="github-activity-chart-shell">
      <h2 class="sr-only" id="github-activity-chart-title">Weekly additions and deletions</h2>
      <p class="sr-only" id="github-activity-chart-instructions">
        Focus the chart and use arrow keys to inspect weeks, Home or End to jump, and Page Up or Page Down to move four weeks.
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
          Commits use a compact zero-preserving log1p panel above the line-change panel. Rare mass-commit weeks no longer flatten
          ordinary weeks; exact counts remain literal in the readout and table.
        </p>
      </div>
      <div>
        <h2>Readable and literal</h2>
        <p>
          Readable uses a symmetric logarithmic transform for added and removed lines, preserving zero and sign while compressing
          extremes. Literal gives those line changes one linear scale. The commit panel stays on its readable log1p scale in both views.
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
    </div>
    <div class="github-activity-table-wrap">
      <table class="github-activity-table">
        <caption>
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
</section>
