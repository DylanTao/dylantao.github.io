---
layout: page
title: Build rhythm
description: Daily code activity by named source, showing when the work bunched up and how much moved.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

{% assign code_activity = site.data.code_activity %}
{% assign personal_daily_ready = false %}
{% if code_activity.schema == 5 and code_activity.date_basis == "source_reported_calendar" and code_activity.scope == "code_activity" and code_activity.coverage.status == "complete" and code_activity.sources and code_activity.sources.size > 0 and code_activity.points and code_activity.points.size > 0 %}
{% assign personal_daily_ready = true %}
{% endif %}

<section
  class="github-activity-page"
  data-github-activity
  data-state="{% if personal_daily_ready %}loading{% else %}unavailable{% endif %}"
>
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">BUILDING, DAY BY DAY</p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      I wanted the logs to show where the work bunches up. Daily code activity by source keeps that rhythm inspectable without turning
      it into a productivity score.
    </p>
  </header>

  <section
    class="build-rhythm-story"
    data-build-rhythm-story
    data-personal-daily-copy
    data-state="loading"
    data-story-static="true"
    aria-labelledby="build-rhythm-story-title"
  >
    <header class="build-rhythm-story-heading">
      <p class="build-rhythm-story-kicker">HOW I READ IT</p>
      <div class="build-rhythm-story-title-row">
        <h2 id="build-rhythm-story-title">Start with the days. Then zoom out.</h2>
        {% include widget_origin_link.liquid href="/projects/build-rhythm/" label="Read how Build Rhythm began" %}
      </div>
      <p>
        I start with when the recorded code changed, then how much moved, then why one giant day needed a second scale.
      </p>
    </header>

    <div class="build-rhythm-story-layout">
      <div class="build-rhythm-story-stage-wrap" aria-hidden="true">
        <div class="build-rhythm-story-stage" data-build-rhythm-story-stage data-scene="complete" data-transitioning="false">
          <div class="build-rhythm-story-stage-heading">
            <span data-build-rhythm-story-label>THE WHOLE RHYTHM</span>
            <span data-build-rhythm-story-scope>COMMITS + LINES</span>
          </div>
          <svg class="build-rhythm-story-chart" data-build-rhythm-story-chart focusable="false"></svg>
          <p class="build-rhythm-story-readout" data-build-rhythm-story-readout>
            Daily code activity by source.
          </p>
        </div>
      </div>

      <div class="build-rhythm-story-steps">
        <article class="build-rhythm-story-step" data-build-rhythm-step="cadence">
          <p class="build-rhythm-story-step-number">01 · WHEN</p>
          <h3>First, I look for the bursts.</h3>
          <p>Reported commits bunch into bursts, with quieter days between. That uneven shape is the rhythm I was looking for.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="magnitude">
          <p class="build-rhythm-story-step-number">02 · HOW MUCH MOVED</p>
          <h3>Total commits tell me when. Authored line changes tell me how much.</h3>
          <p>Added lines climb above zero and removed lines fall below, so I can see how much authored repository text moved in each direction.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="bursts">
          <p class="build-rhythm-story-step-number">03 · TWO SCALES</p>
          <h3>One giant day was flattening everything else.</h3>
          <p>Readable lets the ordinary days breathe. Literal restores the full distance to the biggest spike. I kept both.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="explore">
          <p class="build-rhythm-story-step-number">04 · YOUR TURN</p>
          <h3>Now read the whole rhythm yourself.</h3>
          <p>
            Change the range or scale, move day by day with the keyboard, and inspect the final plot. The reported-value table stays one
            disclosure away.
          </p>
          <a class="build-rhythm-story-explore" href="#github-activity-github-title">Open the explorer</a>
        </article>
      </div>
    </div>

    <p class="build-rhythm-story-credit">
      Interaction direction inspired by
      <a href="https://rhythm-of-food.net/" target="_blank" rel="noopener noreferrer"><em>The Rhythm of Food</em></a>
      by Google News Lab and Truth &amp; Beauty, shared with me by <a href="https://jrthomp.com/" target="_blank" rel="noopener noreferrer">John Thompson</a>.
    </p>

  </section>

  <section class="github-activity-workbench" aria-labelledby="github-activity-github-title">
    <div class="github-activity-module-heading">
      <div>
        <p class="github-activity-module-kicker">CODE ACTIVITY</p>
        <h2 id="github-activity-github-title">Code history</h2>
        <p data-personal-daily-copy>Switch scales, inspect a reported calendar date, or select a stretch of labels.</p>
        <p class="github-activity-module-note" data-personal-daily-copy>
          The quiet outer line is the reported total across visible sources. The crisp inner line is authored commits; the soft band between them is merges and deploys.
        </p>
      </div>
      <span class="github-activity-scope-badge" data-github-scope>
        {%- if personal_daily_ready -%}
          LIFETIME · DAILY
        {%- else -%}
          CODE ACTIVITY
        {%- endif -%}
      </span>
    </div>
    <p class="github-activity-unavailable" data-personal-code-unavailable>
      Code history is being rebuilt.
    </p>

    <div class="github-activity-controls" data-personal-daily-copy aria-label="Code activity chart controls">
      <fieldset class="github-activity-control-group">
        <legend>Code activity time window</legend>
        <div class="github-activity-segments" data-range-controls>
          <button type="button" data-range="1" aria-pressed="false">1 year</button>
          <button type="button" data-range="3" aria-pressed="true">3 years</button>
          <button type="button" data-range="5" aria-pressed="false">5 years</button>
          <button type="button" data-range="all" aria-pressed="false">Lifetime</button>
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

    <div class="github-activity-readout" data-personal-daily-copy>
      <div class="github-activity-readout-content">
        <p class="github-activity-readout-label" id="github-activity-selected-date">Latest date label</p>
        <p class="github-activity-values">
          <span class="github-activity-value-group github-activity-commit-value-group"
            ><span class="github-activity-commits" id="github-activity-selected-commits"></span
          ></span>
          <span class="github-activity-value-group">
            <span class="github-activity-added" id="github-activity-selected-additions"></span>
          </span>
          <span class="github-activity-value-group">
            <span class="github-activity-removed" id="github-activity-selected-deletions"></span>
          </span>
        </p>
      </div>
      <button type="button" class="github-activity-latest" data-jump-latest>Jump to latest</button>
    </div>

    <div class="github-activity-range-status" data-personal-daily-copy>
      <p class="github-activity-range-summary" id="github-activity-range-summary"></p>
      <button type="button" class="github-activity-clear-selection" data-clear-selection hidden>Clear selection</button>
      <span class="sr-only" id="github-activity-selection-announcement" aria-live="polite"></span>
    </div>

    <div class="github-activity-chart-shell" data-personal-daily-copy>
      <h2 class="sr-only" id="github-activity-chart-title">
        Total and authored commits, authored additions and deletions by source-reported calendar label
      </h2>
      <p class="sr-only" id="github-activity-chart-instructions">
        Hover or click to inspect a source-reported date label and its code activity. Drag horizontally to select a range. With
        keyboard focus, use arrow keys to inspect, Shift plus an arrow key to extend a range, Home or End to jump, Page Up or Page Down
        to move seven calendar labels, and Escape to clear a selection.
      </p>
      <div class="github-activity-key" data-chart-key>
        <div class="github-activity-key-group" role="group" aria-labelledby="github-activity-key-commits-label">
          <p class="github-activity-key-label" id="github-activity-key-commits-label">Commits</p>
          <ul class="github-activity-key-items">
            <li class="github-activity-key-item">
              <svg class="github-activity-key-glyph is-total" viewBox="0 0 18 10" aria-hidden="true" focusable="false">
                <line x1="0" y1="5" x2="18" y2="5"></line>
              </svg>
              <span>All commits</span>
            </li>
            <li class="github-activity-key-item">
              <svg class="github-activity-key-glyph is-gap" viewBox="0 0 18 10" aria-hidden="true" focusable="false">
                <rect x="0" y="1" width="18" height="8"></rect>
                <line class="is-boundary" x1="0" y1="1" x2="18" y2="1"></line>
                <line class="is-authored" x1="0" y1="9" x2="18" y2="9"></line>
              </svg>
              <span>Merges + deploys</span>
            </li>
            <li class="github-activity-key-item">
              <svg class="github-activity-key-glyph is-authored" viewBox="0 0 18 10" aria-hidden="true" focusable="false">
                <line x1="0" y1="5" x2="18" y2="5"></line>
              </svg>
              <span>Authored only</span>
            </li>
          </ul>
        </div>
        <div class="github-activity-key-group" role="group" aria-labelledby="github-activity-key-lines-label">
          <p class="github-activity-key-label" id="github-activity-key-lines-label">Lines</p>
          <ul class="github-activity-key-items">
            <li class="github-activity-key-item">
              <svg class="github-activity-key-glyph is-added" viewBox="0 0 18 10" aria-hidden="true" focusable="false">
                <line x1="0" y1="5" x2="18" y2="5"></line>
              </svg>
              <span>+ added</span>
            </li>
            <li class="github-activity-key-item">
              <svg class="github-activity-key-glyph is-removed" viewBox="0 0 18 10" aria-hidden="true" focusable="false">
                <line x1="0" y1="5" x2="18" y2="5"></line>
              </svg>
              <span>− removed</span>
            </li>
          </ul>
        </div>
        <div class="github-activity-source-legend github-activity-key-group" data-source-legend hidden>
          <p class="github-activity-source-legend-label github-activity-key-label" id="github-activity-source-legend-label">Sources</p>
          <div class="github-activity-legend-items" data-source-legend-items role="group" aria-labelledby="github-activity-source-legend-label"></div>
        </div>
      </div>
      <svg
        id="github-activity-chart"
        class="github-activity-chart"
        role="group"
        aria-labelledby="github-activity-chart-title github-activity-chart-instructions"
      ></svg>
      <p class="github-activity-annotation" id="github-activity-annotation"></p>
    </div>

  </section>

  <details class="github-activity-method" data-personal-daily-copy>
    <summary>How this view works</summary>
    <div class="github-activity-method-grid">
      <div>
        <h2>Separate scales</h2>
        <p>Commits and line changes keep their own units and axes. The two panels share only the date axis and the selected label.</p>
      </div>
      <div>
        <h2>Source calendars</h2>
        <p>
          Personal follows GitHub profile author-date labels completed in <code>America/Los_Angeles</code>; contributed feeds use UTC labels.
          Matching <code>YYYY-MM-DD</code> labels align the display, not one shared 24-hour window.
        </p>
      </div>
      <div>
        <h2>Readable or literal</h2>
        <p>Readable uses log1p for commits and a symmetric log view for line changes. Literal uses the full linear range; both plot the same reported values.</p>
      </div>
      <div>
        <h2>What's counted</h2>
        <p>
          The quiet outer line is the reported commit total across visible sources. For <strong>Personal</strong> alone, that means every commit
          GitHub credits, so it matches the contribution graph: the default branch plus <code>gh-pages</code>, merges included. The crisp inner
          line is the summed non-merge, non-deploy authored subset. The soft band between them makes the difference visible without switching
          views.
        </p>
      </div>
      <div>
        <h2>Why lines follow authored commits</h2>
        <p>
          A merge diff restates the branch it absorbs and a deploy rewrites the whole generated site, so counting their lines would report
          machine output as writing. Added and removed lines use each authored commit's first-parent raw-text diff. Documentation and data text
          count; intrinsic binary changes count as zero, and repository attributes are neutralized so local diff rules cannot change the measure.
        </p>
      </div>
      <div>
        <h2>Daily completeness boundary</h2>
        <p>Zero-activity dates appear only inside verified complete coverage. An incomplete or malformed refresh leaves the last valid record in place.</p>
      </div>
      <div>
        <h2>Motion with a stop condition</h2>
        <p>Changing range or scale redraws the selected view once. The chart settles immediately, keeps exact tables, and remains static under reduced motion.</p>
      </div>
    </div>
    <p class="github-activity-table-scroll-hint" id="github-activity-table-scroll-hint">Scroll horizontally to read every daily column.</p>
    <div
      class="github-activity-table-wrap"
      role="region"
      aria-label="Daily code activity table"
      aria-describedby="github-activity-table-scroll-hint"
      tabindex="0"
    >
      <table class="github-activity-table">
        <caption id="github-activity-table-caption">Reported activity by source calendar label in the selected time window</caption>
        <thead>
          <tr>
            <th scope="col">Date label</th>
            <th scope="col">Total commits</th>
            <th scope="col">Authored commits</th>
            <th scope="col">Added</th>
            <th scope="col">Removed</th>
            <th scope="col">Line changes</th>
          </tr>
        </thead>
        <tbody id="github-activity-table-body"></tbody>
      </table>
    </div>
  </details>

  <p class="github-activity-source" data-personal-daily-copy>
    Code activity's latest reported date label is <time id="github-activity-updated"></time>. Time-window and scale controls draw on
    <a href="https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf">UW's Vega-Lite interaction research</a>; keyboard and
    alternative-reading paths draw on <a href="https://www.frank.computer/chartability/">CMU's Chartability heuristics</a>.
  </p>

  <script id="code-activity-data" type="application/json">
    {{ site.data.code_activity | jsonify }}
  </script>
</section>
