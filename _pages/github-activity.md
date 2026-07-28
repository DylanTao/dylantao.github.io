---
layout: page
title: Build rhythm
description: Combined daily code activity, estimated site-build tokens, and anonymous lifetime Codex usage.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

{% assign combined_activity = site.data.combined_code_activity %}
{% assign combined_daily_ready = false %}
{% if combined_activity.schema == 2 and combined_activity.daily and combined_activity.daily.points and combined_activity.daily.points.size > 0 %}
{% assign combined_daily_ready = true %}
{% endif %}

<section
  class="github-activity-page"
  data-github-activity
  data-state="{% if combined_daily_ready %}loading{% else %}awaiting{% endif %}"
  data-profile-svg="{{ '/assets/data/combined-code-activity.svg' | relative_url }}"
>
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">
      <span data-combined-daily-copy>BUILDING, DAY BY DAY</span>
      <span data-combined-awaiting-copy>DAILY HISTORY AWAITING REFRESH</span>
    </p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      <span data-combined-daily-copy>
        I wanted the logs to show where the work bunches up. Start with the combined daily code record, follow this site's token trace, then
        zoom out to the anonymous lifetime usage history.
      </span>
      <span data-combined-awaiting-copy>
        The verified combined lifetime totals and this site's token trace remain available while the exact daily code record awaits its next
        synchronized refresh.
      </span>
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
    data-combined-daily-copy
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
        I start with when the code changed and how much moved. Then I follow this site's token trace before zooming out to the lifetime history.
      </p>
    </header>

    <div class="build-rhythm-story-layout">
      <div class="build-rhythm-story-stage-wrap" aria-hidden="true">
        <div class="build-rhythm-story-stage" data-build-rhythm-story-stage data-scene="complete" data-transitioning="false">
          <div class="build-rhythm-story-stage-heading">
            <span data-build-rhythm-story-label>THE WHOLE RHYTHM</span>
            <span data-build-rhythm-story-scope>COMMITS + LINES + LIFETIME TOKENS</span>
          </div>
          <svg class="build-rhythm-story-chart" data-build-rhythm-story-chart focusable="false"></svg>
          <p class="build-rhythm-story-readout" data-build-rhythm-story-readout>
            Daily code activity beside anonymous, dated lifetime token usage.
          </p>
        </div>
      </div>

      <div class="build-rhythm-story-steps">
        <article class="build-rhythm-story-step" data-build-rhythm-step="cadence">
          <p class="build-rhythm-story-step-number">01 · WHEN</p>
          <h3>First, I look for the bursts.</h3>
          <p>The commits bunch into bursts, with quieter days between. That uneven shape is the rhythm I was looking for.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="magnitude">
          <p class="build-rhythm-story-step-number">02 · HOW MUCH MOVED</p>
          <h3>Commit count tells me when. Line changes tell me how much.</h3>
          <p>Added lines climb above zero and removed lines fall below, so I can see how much code moved in each direction.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="bursts">
          <p class="build-rhythm-story-step-number">03 · TWO SCALES</p>
          <h3>One giant day was flattening everything else.</h3>
          <p>Readable lets the ordinary days breathe. Literal restores the full distance to the biggest spike. I kept both.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="tokens">
          <p class="build-rhythm-story-step-number">04 · THIS SITE</p>
          <h3>Then I follow the site build day by day.</h3>
          <p>
            Some days barely nudge the line. Long build days make it jump. This site's rounded estimate now reaches
            <strong>{{ token_latest.tokens_label }}</strong> through <time datetime="{{ token_latest.date }}">{{ token_latest.date | date: "%b %-d, %Y" }}</time>;
            its biggest adjacent jump was
            <data value="{{ token_largest_increase }}">
              {% if token_largest_increase >= 1000000000 %}
                {{- token_largest_increase | divided_by: 1000000000.0 | round: 2 -}}B
              {% else %}
                {{- token_largest_increase | divided_by: 1000000 -}}M
              {% endif %}
            </data>
            estimated tokens on <time datetime="{{ token_largest_increase_date }}">{{ token_largest_increase_date | date: "%b %-d, %Y" }}</time>.
          </p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="explore">
          <p class="build-rhythm-story-step-number">05 · YOUR TURN</p>
          <h3>Now read the whole rhythm yourself.</h3>
          <p>
            Change the range or scale, move day by day with the keyboard, and inspect the final plot. Complete lifetime coverage begins at
            zero; partial coverage leaves earlier usage explicitly unobserved.
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
        <p class="github-activity-module-kicker">COMBINED CODE ACTIVITY</p>
        <h2 id="github-activity-github-title">Code activity history</h2>
        <p>
          <span data-combined-daily-copy>
            The combined date-only record behind the opening story. Switch scales, inspect a day, or select a stretch of time.
          </span>
          <span data-combined-awaiting-copy>
            The exact daily record is not published yet. The verified lifetime totals and independent Codex status remain available.
          </span>
        </p>
      </div>
      <span class="github-activity-scope-badge" data-github-scope>
        {%- if combined_daily_ready -%}
          5 YEARS · DAILY
        {%- else -%}
          DAILY HISTORY · AWAITING
        {%- endif -%}
      </span>
    </div>
    <p class="github-activity-awaiting" data-combined-daily-awaiting {% if combined_daily_ready %}hidden{% endif %}>
      Combined daily history is awaiting the next synchronized refresh. The verified lifetime totals remain available below.
    </p>

    <div class="github-activity-controls" aria-label="Code activity chart controls">
      <fieldset class="github-activity-control-group">
        <legend>Code activity time window</legend>
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
      <div class="github-activity-readout-content">
        <p class="github-activity-readout-label" id="github-activity-selected-date">Latest day</p>
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
          <span class="github-activity-value-group github-activity-token-value-group">
            <span aria-hidden="true">&middot;</span>
            <span class="github-activity-selected-tokens" id="github-activity-selected-tokens"></span>
          </span>
        </p>
        {% if direct_tracker.schema >= 3 and combined_lifetime %}
          <div
            class="github-activity-lifetime-inline"
            data-codex-usage
            data-state="loading"
            data-source="{{ '/assets/data/codex-profile-usage.json' | relative_url }}"
            aria-label="Combined lifetime token history metadata"
            aria-describedby="github-activity-lifetime-status"
            aria-busy="true"
          >
            <span class="sr-only" data-codex-lifetime data-format="readable">{{ combined_lifetime.tokens_label }} tokens</span>
            <p class="github-activity-lifetime-status" id="github-activity-lifetime-status" data-codex-status>
              {% if direct_tracker.combined_daily_usage %}
                {% if direct_tracker.combined_daily_usage.coverage.completeness == "whole_lifetime" %}
                  Combined daily usage complete through
                  <time data-codex-observed datetime="{{ direct_tracker.combined_daily_usage.coverage.complete_through }}">
                    {{- direct_tracker.combined_daily_usage.coverage.complete_through | date: "%b %-d, %Y" -}}
                  </time>.
                {% else %}
                  Combined daily usage observed through
                  <time data-codex-observed datetime="{{ direct_tracker.combined_daily_usage.coverage.complete_through }}">
                    {{- direct_tracker.combined_daily_usage.coverage.complete_through | date: "%b %-d, %Y" -}}
                  </time>; earlier lifetime usage remains unobserved.
                {% endif %}
              {% elsif direct_tracker.combined_lifetime_history %}
                Legacy lifetime history observed through
                <time data-codex-observed datetime="{{ direct_tracker.observed_on }}">{{ direct_tracker.observed_on | date: "%b %-d, %Y" }}</time>.
              {% else %}
                Lifetime fallback: one rounded snapshot observed
                <time data-codex-observed datetime="{{ direct_tracker.observed_on }}">{{ direct_tracker.observed_on | date: "%b %-d, %Y" }}</time>.
              {% endif %}
            </p>
            <p class="github-activity-lifetime-cost" data-codex-cost hidden>
              Burned <span data-codex-cost-value></span> of Sam's imaginary money &middot; public API-rate replay, not a bill.
            </p>
          </div>
        {% endif %}
      </div>
      <button type="button" class="github-activity-latest" data-jump-latest>Jump to latest</button>
    </div>

    <div class="github-activity-range-status">
      <p class="github-activity-range-summary" id="github-activity-range-summary"></p>
      <button type="button" class="github-activity-clear-selection" data-clear-selection hidden>Clear selection</button>
      <span class="sr-only" id="github-activity-selection-announcement" aria-live="polite"></span>
    </div>

    <div class="github-activity-chart-shell">
      <h2 class="sr-only" id="github-activity-chart-title">
        Daily combined commits, additions and deletions, plus combined Codex token usage
      </h2>
      <p class="sr-only" id="github-activity-chart-instructions">
        Hover or click to inspect a day and its combined token usage. Drag horizontally to select a range. With
        keyboard focus, use arrow keys to inspect, Shift plus an arrow key to extend a range, Home or End to jump, Page Up or Page Down
        to move seven days, and Escape to clear a selection.
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

{% assign combined_code_lifetime = nil %}
{% assign combined_code_through = nil %}
{% if combined_activity.schema == 2 and combined_activity.lifetime %}
{% assign combined_code_lifetime = combined_activity.lifetime %}
{% assign combined_code_through = combined_activity.lifetime.through %}
{% elsif combined_activity.schema == 1 and combined_activity.points and combined_activity.points.size > 0 %}
{% assign combined_code_lifetime = combined_activity.points | last %}
{% assign combined_code_through = combined_code_lifetime.date %}
{% endif %}
{% if combined_code_lifetime %}

<section
      class="github-activity-combined-lifetime"
      id="combined-code-activity"
      aria-labelledby="combined-code-activity-title"
    >
<div class="github-activity-module-heading">
<div>
<p class="github-activity-module-kicker">COMBINED CODE ACTIVITY</p>
<h2 id="combined-code-activity-title">Combined lifetime code activity</h2>
</div>
<span class="github-activity-scope-badge">LIFETIME &middot; AGGREGATE ONLY</span>
</div>

      <dl class="github-activity-lifetime-summary" aria-label="Combined lifetime code activity">
        <div>
          <dt><data data-format-integer value="{{ combined_code_lifetime.commits }}">{{ combined_code_lifetime.commits }}</data></dt>
          <dd>commits</dd>
        </div>
        <div>
          <dt class="github-activity-added">
            <span aria-hidden="true">+</span><data data-format-integer value="{{ combined_code_lifetime.additions }}">{{ combined_code_lifetime.additions }}</data>
          </dt>
          <dd>lines added</dd>
        </div>
        <div>
          <dt class="github-activity-removed">
            <span aria-hidden="true">&minus;</span><data data-format-integer value="{{ combined_code_lifetime.deletions }}">{{ combined_code_lifetime.deletions }}</data>
          </dt>
          <dd>lines removed</dd>
        </div>
      </dl>

      <p class="github-activity-lifetime-note">
        Through <time datetime="{{ combined_code_through }}">{{ combined_code_through | date: "%b %-d, %Y" }}</time>. Some counts come
        from other internship or work accounts; source identities, repositories, commit details, and exact timestamps stay private.
      </p>
    </section>

{% endif %}

  <section
    class="github-activity-token-rhythm"
    data-token-rhythm
    data-state="loading"
    aria-labelledby="github-activity-token-rhythm-title"
  >
    <div class="github-activity-module-heading">
      <div>
        <p class="github-activity-module-kicker">SITE-BUILD TOKEN RHYTHM</p>
        <h2 id="github-activity-token-rhythm-title">Estimated tokens accumulated while building this site</h2>
        <p>A rounded daily trace for this repository: the running total above and each day's increase below.</p>
      </div>
      <span class="github-activity-scope-badge">REPO-SCOPED &middot; DAILY</span>
    </div>

    <dl class="github-activity-token-summary" aria-label="Site-build token rhythm summary">
      <div>
        <dt>{{ token_latest.tokens_label }}</dt>
        <dd>cumulative estimate through <time datetime="{{ token_latest.date }}">{{ token_latest.date | date: "%b %-d, %Y" }}</time></dd>
      </div>
      <div>
        <dt>
          <data value="{{ token_largest_increase }}">
            +{% if token_largest_increase >= 1000000000 %}
              {{- token_largest_increase | divided_by: 1000000000.0 | round: 2 -}}B
            {% else %}
              {{- token_largest_increase | divided_by: 1000000 -}}M
            {% endif %}
          </data>
        </dt>
        <dd>largest rounded daily increase, on <time datetime="{{ token_largest_increase_date }}">{{ token_largest_increase_date | date: "%b %-d, %Y" }}</time></dd>
      </div>
    </dl>

    <div class="github-activity-token-chart-shell">
      <svg
        id="github-activity-token-rhythm-chart"
        class="github-activity-token-rhythm-chart"
        data-token-rhythm-chart
        aria-hidden="true"
        focusable="false"
      ></svg>
      <p class="github-activity-token-annotation" data-token-rhythm-readout>
        Cumulative estimated tokens and rounded daily increases from {{ token_rhythm.since | date: "%b %-d, %Y" }} through
        {{ token_rhythm.updated_at | date: "%b %-d, %Y" }}.
      </p>
    </div>

    <details class="github-activity-token-evidence" data-token-rhythm-details>
      <summary id="github-activity-token-table-title">Exact daily values</summary>
      <div class="github-activity-token-evidence-body">
        <p>The same rounded series, row by row.</p>
        <p class="github-activity-table-scroll-hint" id="github-activity-token-table-scroll-hint">Scroll horizontally for all three columns.</p>
        <div
          class="github-activity-table-wrap"
          role="region"
          aria-label="Daily cumulative repo-token estimate table"
          aria-describedby="github-activity-token-table-scroll-hint"
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
                <th scope="col">Rounded increase</th>
              </tr>
            </thead>
            <tbody id="github-activity-token-table-body">
              {% assign token_table_previous_count = 0 %}
              {% for token_point in token_rhythm.points %}
                {% assign token_table_increase = token_point.token_count | minus: token_table_previous_count %}
                <tr>
                  <th scope="row"><time datetime="{{ token_point.date }}">{{ token_point.date | date: "%b %-d, %Y" }}</time></th>
                  <td><data value="{{ token_point.token_count }}">{{ token_point.tokens_label }} estimated tokens</data></td>
                  <td>
                    <data value="{{ token_table_increase }}">
                      +{% if token_table_increase >= 1000000000 %}
                        {{- token_table_increase | divided_by: 1000000000.0 | round: 2 -}}B
                      {% else %}
                        {{- token_table_increase | divided_by: 1000000 -}}M
                      {% endif %}
                      estimated tokens
                    </data>
                  </td>
                </tr>
                {% assign token_table_previous_count = token_point.token_count %}
              {% endfor %}
            </tbody>
          </table>
        </div>
      </div>
    </details>

  </section>

  <details class="github-activity-method" data-combined-daily-copy>
    <summary>How this view works</summary>
    <div class="github-activity-method-grid">
      <div>
        <h2>Separate scales</h2>
        <p>Daily combined code activity, site-build estimates, and lifetime Codex usage keep their own units and dates.</p>
      </div>
      <div>
        <h2>Token rhythm</h2>
        <p>Deduplicated retained logs attributed to this repo produce rounded cumulative daily estimates for the site.</p>
      </div>
      <div>
        <h2>Readable or literal</h2>
        <p>Readable uses log1p for commits and a symmetric log view for line changes. Literal uses the full linear range; both plot the same reported values.</p>
      </div>
      <div>
        <h2>What's counted</h2>
        <p>The code chart sums identity-free personal and external account activity by UTC date. It publishes counts only, never account or repository details.</p>
      </div>
      <div>
        <h2>Daily completeness boundary</h2>
        <p>Zero-activity dates appear only inside verified complete coverage. An incomplete or malformed refresh leaves the last valid record in place.</p>
      </div>
      <div>
        <h2>Codex privacy boundary</h2>
        <p>The collector publishes one combined daily series. Whole-lifetime coverage begins at zero; partial coverage keeps earlier usage as an explicitly unobserved baseline.</p>
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
      aria-label="Daily combined code activity table"
      aria-describedby="github-activity-table-scroll-hint"
      tabindex="0"
    >
      <table class="github-activity-table">
        <caption id="github-activity-table-caption">Reported daily activity in the selected time window</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
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
    Combined code activity updated <time id="github-activity-updated"></time>.
    <span data-combined-daily-copy>
      The retained-session token rhythm is generated with the public agentic-usage ledger; the combined Codex plot identifies its own
      completeness boundary above. Time-window and scale controls draw on
      <a href="https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf">UW's Vega-Lite interaction research</a>; keyboard and
      alternative-reading paths draw on <a href="https://www.frank.computer/chartability/">CMU's Chartability heuristics</a>.
    </span>
    <span data-combined-awaiting-copy>
      Exact daily code history is awaiting the next synchronized refresh. The retained-session token rhythm and verified combined Codex
      metadata remain available.
    </span>
  </p>

  <script id="combined-code-activity-data" type="application/json">
    {{ site.data.combined_code_activity | jsonify }}
  </script>
  <script id="build-rhythm-token-data" type="application/json">
    {{ token_rhythm | jsonify }}
  </script>
</section>
