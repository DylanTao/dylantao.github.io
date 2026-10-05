---
layout: page
title: Build rhythm
description: Recorded Personal commit history, from daily work to accumulated totals.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

{% assign code_activity = site.data.code_activity %}
{% assign code_schema_supported = false %}
{% if code_activity.schema == 5 or code_activity.schema == 6 %}
{% assign code_schema_supported = true %}
{% endif %}
{% assign personal_daily_ready = false %}
{% if code_schema_supported and code_activity.date_basis == "source_reported_calendar" and code_activity.scope == "code_activity" and code_activity.coverage.status == "complete" and code_activity.sources and code_activity.sources.size > 0 and code_activity.points and code_activity.points.size > 0 %}
{% assign personal_daily_ready = true %}
{% endif %}

<section
  class="github-activity-page"
  data-github-activity
  data-state="{% if personal_daily_ready %}loading{% else %}unavailable{% endif %}"
>
  <header class="github-activity-hero">
    <div>
      <p class="github-activity-eyebrow">BUILDING, DAY BY DAY</p>
      <h1 id="github-activity-title">Build rhythm.</h1>
      <p class="github-activity-lede">I wanted the logs to show where the work bunches up. Explore the same history at four scales.</p>
    </div>
    {% include widget_origin_link.liquid href="/projects/build-rhythm/" label="Read how Build Rhythm began" %}
  </header>

  <section class="build-rhythm-overview" data-build-rhythm-overview data-personal-daily-copy aria-label="Personal commit history">
    <header class="build-rhythm-toolbar">
      <div class="github-activity-segments" role="group" aria-label="Commit view">
        <button type="button" data-rhythm-view="history" aria-pressed="true">History</button>
        <button type="button" data-rhythm-view="daily" aria-pressed="false">Daily</button>
        <button type="button" data-rhythm-view="weekly" aria-pressed="false">Weekly</button>
        <button type="button" data-rhythm-view="cumulative" aria-pressed="false">Cumulative</button>
      </div>
      <label class="build-rhythm-year-picker">Year <select data-rhythm-year aria-label="Choose a year"></select></label>
    </header>
    <p class="build-rhythm-summary" data-rhythm-summary></p>
    <p class="build-rhythm-context" data-rhythm-view-note></p>
    <div class="build-rhythm-plot-stage">
      <p class="sr-only" id="rhythm-chart-instructions">Use arrow keys to inspect dates or weeks. In History, up and down change years; Enter opens that year in Daily view. In Daily, up and down change days. Home and End select the first and last verified value. You can also select a year with the Year menu.</p>
      <svg class="build-rhythm-chart" data-rhythm-chart aria-label="Personal commit history" aria-describedby="rhythm-chart-instructions"></svg>
    </div>
    <p class="build-rhythm-readout" data-rhythm-readout></p>
    <div class="build-rhythm-legend" aria-label="Chart legend">
      <span><i class="is-zero" aria-hidden="true"></i>Verified zero</span>
      <span><i class="is-active" aria-hidden="true"></i>Recorded commits</span>
      <span><i class="is-unverified" aria-hidden="true"></i>After cutoff</span>
      <span><i class="is-precoverage" aria-hidden="true"></i>Before coverage</span>
      <span><i class="is-future" aria-hidden="true"></i>Future</span>
      <span><i class="is-partial" aria-hidden="true"></i>Partial week</span>
      <span data-rhythm-carry-legend hidden><i class="is-carry" aria-hidden="true"></i>Before this year</span>
    </div>
    <p class="build-rhythm-coverage" data-rhythm-coverage></p>
  </section>

  <p class="github-activity-unavailable" data-personal-code-unavailable>Code history is being rebuilt.</p>

  <details class="build-rhythm-disclosure" data-rhythm-method data-personal-daily-copy>
    <summary>About the data</summary>
    <div class="build-rhythm-method-copy">
      <p><strong>What counts.</strong> This chart uses Personal's reported commits on eligible default and <code>gh-pages</code> branches, merges included. The authored subset excludes merges and deploys. GitHub's contribution calendar also counts pull requests, issues, and reviews, so its total is a different measure. Intern work is a separate source and is not added to this chart.</p>
      <p><strong>Calendar and cutoff.</strong> Personal follows GitHub profile author-date labels, with completeness checked in <code>America/Los_Angeles</code>. Dates are not rebinned into the visitor's time zone. Zero appears only inside verified coverage. Dates before coverage, after the cutoff, and in the future keep separate marks.</p>
      <p><strong>Reading the views.</strong> History groups Sunday-start weeks by year; selecting a year opens its days in this same chart. Daily and History use logarithmic color intensity. Weekly uses a linear count axis. Cumulative uses a linear running total, with earlier years shown as a quiet carry-in band. Only verified dates contribute to partial weeks; boundary cells include only dates in their displayed year. Cumulative values stop at the cutoff.</p>
      <p><strong>Sources and credits.</strong> Values come from the <a href="https://github.com/DylanTao/DylanTao/blob/main/docs/github-activity.json">published Personal snapshot</a>. The original story drew on <a href="https://rhythm-of-food.net/">Rhythm of Food</a>, by Google News Lab and Truth &amp; Beauty, and <a href="https://jrthomp.com/">John Thompson's visualization work</a>. Interaction and alternative reading paths draw on <a href="https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf">UW's Vega-Lite research</a> and <a href="https://www.frank.computer/chartability/">CMU's Chartability heuristics</a>.</p>
      <details class="build-rhythm-records" data-rhythm-records>
        <summary>Read recorded daily values</summary>
        <div class="build-rhythm-table-wrap" role="region" aria-label="Recorded Personal daily values" tabindex="0">
          <table class="build-rhythm-table">
            <caption data-rhythm-table-caption>Reported Personal values by source date label</caption>
            <thead><tr><th scope="col">Date label</th><th scope="col">Total commits</th><th scope="col">Authored commits</th></tr></thead>
            <tbody data-rhythm-table-body></tbody>
          </table>
        </div>
      </details>
    </div>
  </details>

  <script id="code-activity-data" type="application/json">
    {{ site.data.code_activity | jsonify }}
  </script>
</section>
