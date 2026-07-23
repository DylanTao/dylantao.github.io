---
layout: page
title: Build rhythm
description: Weekly GitHub activity, daily estimated site-build tokens, and one rounded lifetime Codex snapshot.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

<section class="github-activity-page" data-github-activity data-source="/DylanTao/github-activity.json">
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">BUILDING, WEEK BY WEEK</p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      I wanted the logs to show where the work bunches up. Start with five years of GitHub weeks, follow this site's token trace,
      then zoom out to one rounded lifetime checkpoint.
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
      <p class="build-rhythm-story-kicker">HOW I READ IT</p>
      <div class="build-rhythm-story-title-row">
        <h2 id="build-rhythm-story-title">Start with the weeks. Then zoom out.</h2>
        {% include widget_origin_link.liquid href="/projects/build-rhythm/" label="Read how Build Rhythm began" %}
      </div>
      <p>
        I start with when the code changed and how much moved. Then I follow this site's token trace before zooming out to the lifetime total.
      </p>
    </header>

    <div class="build-rhythm-story-layout">
      <div class="build-rhythm-story-stage-wrap" aria-hidden="true">
        <div class="build-rhythm-story-stage" data-build-rhythm-story-stage data-scene="complete" data-transitioning="false">
          <div class="build-rhythm-story-stage-heading">
            <span data-build-rhythm-story-label>THE WHOLE RHYTHM</span>
            <span data-build-rhythm-story-scope>5 YEARS + DAILY REPO TOKENS + LIFETIME TOTAL</span>
          </div>
          <svg class="build-rhythm-story-chart" data-build-rhythm-story-chart focusable="false"></svg>
          <p class="build-rhythm-story-readout" data-build-rhythm-story-readout>
            Five years, week by week; this site's daily token trace; and the latest rounded lifetime checkpoint.
          </p>
        </div>
      </div>

      <div class="build-rhythm-story-steps">
        <article class="build-rhythm-story-step" data-build-rhythm-step="cadence">
          <p class="build-rhythm-story-step-number">01 · WHEN</p>
          <h3>First, I look for the bursts.</h3>
          <p>The commits bunch into bursts, with quieter stretches between. That uneven shape is the rhythm I was looking for.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="magnitude">
          <p class="build-rhythm-story-step-number">02 · HOW MUCH MOVED</p>
          <h3>Commit count tells me when. Line changes tell me how much.</h3>
          <p>Added lines climb above zero and removed lines fall below, so I can see how much code moved in each direction.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="bursts">
          <p class="build-rhythm-story-step-number">03 · TWO SCALES</p>
          <h3>One giant week was flattening everything else.</h3>
          <p>Readable lets the ordinary weeks breathe. Literal restores the full distance to the biggest spike. I kept both.</p>
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

        <article class="build-rhythm-story-step" data-build-rhythm-step="lifetime">
          <p class="build-rhythm-story-step-number">05 · ZOOM OUT</p>
          <h3>Finally, I zoom out to lifetime use.</h3>
          <p>For the widest view, I keep one dated, rounded lifetime checkpoint.</p>
        </article>

        <article class="build-rhythm-story-step" data-build-rhythm-step="explore">
          <p class="build-rhythm-story-step-number">06 · YOUR TURN</p>
          <h3>Now poke at the weeks yourself.</h3>
          <p>Change the range or scale, move week by week with the keyboard, or open the exact table when a spike catches your eye.</p>
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
<p>A single dated checkpoint for the bigger picture.</p>
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
<p class="github-activity-codex-note">One public checkpoint. Source histories and reset times stay private.</p>
</section>
{% endif %}

  <section class="github-activity-workbench" aria-labelledby="github-activity-github-title">
    <div class="github-activity-module-heading">
      <div>
        <p class="github-activity-module-kicker">GITHUB ACTIVITY</p>
        <h2 id="github-activity-github-title">GitHub contribution history</h2>
        <p>The five-year record behind the opening story. Switch scales, inspect a week, or select a stretch of time.</p>
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

  <details class="github-activity-method">
    <summary>How this view works</summary>
    <div class="github-activity-method-grid">
      <div>
        <h2>Three scales</h2>
        <p>Weekly repository activity, daily site-build estimates, and lifetime Codex usage each carry their own units and dates.</p>
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
        <p>Owned public and private repositories are rolled up by week on default branches. Contributor statistics supply totals, commit history fills gaps, merge commits are skipped, and very large repositories may omit line totals.</p>
      </div>
      <div>
        <h2>Codex privacy boundary</h2>
        <p>The collector publishes one rounded lifetime sum; source-level readings stay private.</p>
      </div>
      <div>
        <h2>Motion with a stop condition</h2>
        <p>Changing range or scale redraws the selected view once. The chart settles immediately, keeps exact tables, and remains static under reduced motion.</p>
      </div>
    </div>
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
