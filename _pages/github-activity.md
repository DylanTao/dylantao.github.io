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
      <p class="github-activity-lede">I wanted the logs to show where the work bunches up. Follow the accumulated history, then look closer at a year.</p>
    </div>
    {% include widget_origin_link.liquid href="/projects/build-rhythm/" label="Read how Build Rhythm began" %}
  </header>

  <section class="build-rhythm-overview" data-build-rhythm-overview data-personal-daily-copy aria-label="Personal commit history">
    <header class="build-rhythm-toolbar">
      <div class="build-rhythm-summary" data-rhythm-summary>
        <strong data-rhythm-total></strong>
        <p data-rhythm-total-label>Recorded commits</p>
      </div>
      <div class="build-rhythm-range-controls" role="group" aria-label="Year range">
        <label class="build-rhythm-range-picker">From <select data-rhythm-range-start aria-label="Range start year"></select></label>
        <label class="build-rhythm-range-picker">To <select data-rhythm-range-end aria-label="Range end year"></select></label>
        <button class="build-rhythm-range-reset" type="button" data-rhythm-range-reset>All years</button>
      </div>
    </header>
    <p class="build-rhythm-context" data-rhythm-view-note>Cumulative recorded commits within the selected range. Each range starts from zero.</p>
    <div class="build-rhythm-history-stage">
      <p class="sr-only" id="rhythm-history-instructions">Choose From and To years to rebase the accumulated total to that range. Left and right arrows inspect exact recorded dates; Home and End choose the first and last verified date. Enter opens that date in the year detail below. The line stops at the verified cutoff.</p>
      <svg class="build-rhythm-chart" data-rhythm-chart aria-label="Cumulative recorded commits within the selected range" aria-describedby="rhythm-history-instructions"></svg>
    </div>
    <p class="build-rhythm-readout" data-rhythm-history-readout></p>
    <section class="build-rhythm-detail" aria-label="Year detail">
      <header class="build-rhythm-detail-toolbar">
        <label class="build-rhythm-year-picker">Year detail <select data-rhythm-year aria-label="Detail year"></select></label>
        <div class="github-activity-segments" role="group" aria-label="Detail view">
          <button type="button" data-rhythm-view="daily" aria-pressed="true">Daily</button>
          <button type="button" data-rhythm-view="weekly" aria-pressed="false">Weekly</button>
        </div>
      </header>
      <p class="build-rhythm-detail-context" data-rhythm-detail-note></p>
      <div class="build-rhythm-plot-stage">
        <p class="sr-only" id="rhythm-detail-instructions">Choose a detail year within the selected range. Daily shows Sunday-start calendar columns, split into two half-year blocks on small screens. Left and right move seven days; up and down move one day. Weekly shows only the dates in this year, with partial weeks labeled. Home and End choose the first and last verified value. Touch or point to a mark to read its exact date and count.</p>
        <svg class="build-rhythm-chart" data-rhythm-detail-chart aria-label="Recorded daily commits for the detail year" aria-describedby="rhythm-detail-instructions"></svg>
      </div>
      <p class="build-rhythm-readout" data-rhythm-readout></p>
    </section>
    <div class="build-rhythm-legend" aria-label="Chart legend">
      <span><i class="is-zero" aria-hidden="true"></i>Verified zero</span>
      <span><i class="is-active" aria-hidden="true"></i>Recorded commits</span>
      <span><i class="is-unverified" aria-hidden="true"></i>No verified value</span>
    </div>
    <p class="build-rhythm-coverage" data-rhythm-coverage></p>
  </section>

  <p class="github-activity-unavailable" data-personal-code-unavailable>Code history is being rebuilt.</p>

  <details class="build-rhythm-disclosure" data-rhythm-method data-personal-daily-copy>
    <summary>About the data</summary>
    <div class="build-rhythm-method-copy">
      <p><strong>What counts.</strong> This chart uses Personal's reported commits on eligible default and <code>gh-pages</code> branches, merges included. The authored subset excludes merges and deploys. GitHub's contribution calendar also counts pull requests, issues, and reviews, so its total is a different measure. Intern work is a separate source and is not added to this chart.</p>
      <p><strong>Calendar and cutoff.</strong> Personal follows GitHub profile author-date labels, with completeness checked in <code>America/Los_Angeles</code>. Dates are not rebinned into the visitor's time zone. Zero appears only inside verified coverage. Dates before coverage, after the cutoff, and in the future keep separate marks.</p>
      <p><strong>Reading the chart.</strong> From and To choose the accumulated history. The headline and line count only recorded commits within that range, rebased from zero; earlier work is excluded. All years restores 2017–2026. Year detail stays within the range and changes independently of the upper history. Daily and Weekly replace the same lower slot. Weeks start on Sunday and exclude dates outside the detail year; a partial week reports its verified dates explicitly. Only verified dates contribute; the curve begins at verified coverage and stops at the last verified date in the range. Color intensity uses a logarithmic scale to keep smaller daily counts visible.</p>
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
