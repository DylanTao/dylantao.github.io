---
layout: page
title: Build rhythm
description: Weekly GitHub activity, daily estimated token deltas, and one rounded lifetime Codex snapshot.
permalink: /github-activity/
nav: false
hide_title: true
panel_wide: true
github_activity: true
---

{% assign direct_tracker = site.data.direct_usage_tracker %}
{% assign combined_lifetime = direct_tracker.combined_lifetime %}
{% assign token_rhythm = site.data.agentic_usage.total.token_rhythm %}
{% assign token_latest = token_rhythm.points | last %}
{% assign all_projects_rhythm = site.data.agentic_usage.local_lifetime.token_rhythm %}
{% assign all_projects_latest = all_projects_rhythm.points | last %}
{% assign local_replay = site.data.agentic_usage.local_lifetime.api_cost_equivalence %}
{% assign local_replay_tokens = site.data.agentic_usage.local_lifetime.raw_token_count %}
{% assign lifetime_mix_replay_usd = combined_lifetime.token_count | times: local_replay.usd_estimate | divided_by: local_replay_tokens %}
{% assign lifetime_mix_replay_k = lifetime_mix_replay_usd | divided_by: 1000.0 | round: 1 %}
{% assign token_previous_count = 0 %}
{% assign token_latest_delta = 0 %}
{% for token_point in token_rhythm.points %}
{% assign token_latest_delta = token_point.token_count | minus: token_previous_count %}
{% assign token_previous_count = token_point.token_count %}
{% endfor %}
{% assign all_projects_previous_count = 0 %}
{% assign all_projects_latest_delta = 0 %}
{% for token_point in all_projects_rhythm.points %}
{% assign all_projects_latest_delta = token_point.token_count | minus: all_projects_previous_count %}
{% assign all_projects_previous_count = token_point.token_count %}
{% endfor %}

<section class="github-activity-page" data-github-activity data-source="/DylanTao/github-activity.json">
  <header class="github-activity-hero">
    <p class="github-activity-eyebrow">THREE SCALES OF BUILDING</p>
    <h1 id="github-activity-title">Build rhythm.</h1>
    <p class="github-activity-lede">
      Read a rounded lifetime Codex snapshot, inspect weekly GitHub change, then compare daily tokens across all retained Codex work and this website.
    </p>
  </header>

  <section class="build-rhythm-guide" aria-labelledby="build-rhythm-guide-title">
    <header class="build-rhythm-story-heading">
      <p class="build-rhythm-story-kicker">THREE SCOPE GUIDE</p>
      <div class="build-rhythm-story-title-row">
        <h2 id="build-rhythm-guide-title">Three clocks, one reading path.</h2>
        {% include widget_origin_link.liquid href="/projects/build-rhythm/" label="Read how Build Rhythm began" %}
      </div>
      <p>Start with the scope, then inspect the date. These measures sit together for context; they are not added into one score.</p>
    </header>

    <div class="build-rhythm-guide-grid">
      <article>
        <p class="build-rhythm-story-step-number">01 · LIFETIME SNAPSHOT</p>
        <h3>How much Codex use is recorded?</h3>
        <p>One rounded combined total, refreshed on its own observation date.</p>
      </article>
      <article>
        <p class="build-rhythm-story-step-number">02 · WEEKLY GITHUB</p>
        <h3>When did code change?</h3>
        <p>Commits show cadence; additions and deletions show magnitude and direction.</p>
      </article>
      <article>
        <p class="build-rhythm-story-step-number">03 · DAILY TOKENS</p>
        <h3>Where did retained token work cluster?</h3>
        <p>Compare rounded daily deltas across all retained Codex work and this website.</p>
      </article>
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
<p>One rounded total with its own observation date.</p>
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
<p class="github-activity-lifetime-replay">
<strong
          data-hypothetical-mix-matched-api-rate-replay
          data-reference-token-count="{{ local_replay_tokens }}"
          data-reference-usd="{{ local_replay.usd_estimate }}"
        >~${{ lifetime_mix_replay_k }}K API-rate replay</strong> if this rounded lifetime total matched the retained local slice's model, cache, request-length, and input/output mix. Uses
<a href="{{ local_replay.source_url }}">Standard public API rates</a> as of {{ local_replay.pricing_as_of | date: "%b %-d, %Y" }}; unavailable cache-write tokens are excluded. Not an actual bill.
</p>
<p class="github-activity-codex-note">
Published as one rounded total with a dated observation. Source histories stay private; this total is never added to either retained-session series.
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
        <legend>Y-axis scale</legend>
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
          <span class="github-activity-value-group"><span aria-hidden="true">·</span><span class="github-activity-added" id="github-activity-selected-additions"></span></span>
          <span class="github-activity-value-group"><span aria-hidden="true">·</span><span class="github-activity-removed" id="github-activity-selected-deletions"></span></span>
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
        Hover or click to inspect a week. Drag horizontally to select a range. With keyboard focus, use arrow keys to inspect, Shift plus an arrow key to extend a range, Home or End to jump, Page Up or Page Down to move four weeks, and Escape to clear a selection.
      </p>
      <svg id="github-activity-chart" class="github-activity-chart" role="group" aria-labelledby="github-activity-chart-title github-activity-chart-instructions"></svg>
      <p class="github-activity-annotation" id="github-activity-annotation"></p>
    </div>

  </section>

  <section class="github-activity-token-rhythm" data-token-rhythm data-state="loading" aria-labelledby="github-activity-token-rhythm-title">
    <div class="github-activity-module-heading">
      <div>
        <p class="github-activity-module-kicker">DAILY TOKEN RHYTHM</p>
        <h2 id="github-activity-token-rhythm-title">All retained Codex work and this website, day by day</h2>
        <p>One chart compares rounded daily deltas. The cumulative totals stay as endpoint summaries instead of repeating a second figure.</p>
      </div>
      <span class="github-activity-scope-badge">Y-AXIS: DAILY TOKENS · LOG1P</span>
    </div>

    <dl class="github-activity-token-summary" aria-label="Token rhythm cumulative endpoints">
      <div>
        <dt>{{ all_projects_latest.tokens_label | default: site.data.agentic_usage.local_lifetime.tokens_label }}</dt>
        <dd>all retained Codex work since Jun 19, 2026{% if all_projects_latest %}, through <time datetime="{{ all_projects_latest.date }}">{{ all_projects_latest.date | date: "%b %-d, %Y" }}</time>{% endif %}</dd>
      </div>
      <div>
        <dt>{{ token_latest.tokens_label }}</dt>
        <dd>this website since May 22, 2026, through <time datetime="{{ token_latest.date }}">{{ token_latest.date | date: "%b %-d, %Y" }}</time></dd>
      </div>
    </dl>

    <div class="github-activity-token-legend" aria-label="Token rhythm series">
      <span><i class="is-all-projects" aria-hidden="true"></i>All retained Codex work</span>
      <span><i class="is-site" aria-hidden="true"></i>This website</span>
    </div>

    <div class="github-activity-token-chart-shell">
      <h3 class="sr-only" id="github-activity-token-chart-title">Rounded daily estimated token deltas for all retained Codex work and this website</h3>
      <p class="sr-only" id="github-activity-token-chart-instructions">
        Hover to preview a day. Click or tap to pin it. With keyboard focus, use Left and Right arrows, Home, End, and Escape.
      </p>
      <svg
        id="github-activity-token-rhythm-chart"
        class="github-activity-token-rhythm-chart"
        data-token-rhythm-chart
        role="group"
        aria-labelledby="github-activity-token-chart-title github-activity-token-chart-instructions"
      ></svg>
      <p class="github-activity-token-annotation" data-token-rhythm-readout>
        <time datetime="{{ token_latest.date }}">{{ token_latest.date | date: "%b %-d, %Y" }}</time> ·
        all retained Codex work +{{ all_projects_latest_delta | divided_by: 1000000 }}M · this website +{{ token_latest_delta | divided_by: 1000000 }}M estimated tokens.
      </p>
      <span class="sr-only" data-token-rhythm-announcement aria-live="polite"></span>
    </div>

    <details class="github-activity-token-evidence">
      <summary>Daily values for accessible and no-JavaScript reading</summary>
      <div class="github-activity-token-evidence-body">
        <p>These are rounded retained-log estimates. Adjacent differences are rounded deltas, not billing-grade daily usage.</p>
        <p class="github-activity-table-scroll-hint" id="github-activity-token-table-scroll-hint">Scroll horizontally for all five columns.</p>
        <div class="github-activity-table-wrap" role="region" aria-label="Daily all-work and website token estimate table" aria-describedby="github-activity-token-table-scroll-hint" tabindex="0">
          <table class="github-activity-table">
            <caption>Rounded daily retained-token estimates from {{ all_projects_rhythm.since | default: "2026-06-19" }} through {{ all_projects_rhythm.updated_at | default: token_rhythm.updated_at }}</caption>
            <thead>
              <tr><th scope="col">Date</th><th scope="col">All-work delta</th><th scope="col">Website delta</th><th scope="col">All-work cumulative</th><th scope="col">Website cumulative</th></tr>
            </thead>
            <tbody id="github-activity-token-table-body">
              {% assign site_table_previous_count = 0 %}
              {% assign site_table_has_previous = false %}
              {% for site_point in token_rhythm.points %}
                {% if site_point.date < all_projects_rhythm.since %}
                  {% assign site_table_previous_count = site_point.token_count %}
                  {% assign site_table_has_previous = true %}
                {% endif %}
              {% endfor %}
              {% assign all_table_previous_count = 0 %}
              {% for all_point in all_projects_rhythm.points %}
                {% assign site_matches = token_rhythm.points | where: "date", all_point.date %}
                {% assign site_point = site_matches | first %}
                {% unless forloop.first %}{% assign all_delta = all_point.token_count | minus: all_table_previous_count %}{% endunless %}
                {% if site_point and site_table_has_previous %}{% assign site_delta = site_point.token_count | minus: site_table_previous_count %}{% endif %}
                <tr>
                  <th scope="row"><time datetime="{{ all_point.date }}">{{ all_point.date | date: "%b %-d, %Y" }}</time></th>
                  <td>{% if forloop.first %}<span aria-label="No prior all-work point for this date">—</span>{% else %}<data value="{{ all_delta }}">+{{ all_delta }} estimated tokens</data>{% endif %}</td>
                  <td>{% if site_point and site_table_has_previous %}<data value="{{ site_delta }}">+{{ site_delta }} estimated tokens</data>{% else %}<span aria-label="No prior website point for this date">—</span>{% endif %}</td>
                  <td><data value="{{ all_point.token_count }}">{{ all_point.tokens_label }} estimated tokens</data></td>
                  <td>{% if site_point %}<data value="{{ site_point.token_count }}">{{ site_point.tokens_label }} estimated tokens</data>{% else %}<span aria-label="No website point for this date">—</span>{% endif %}</td>
                </tr>
                {% assign all_table_previous_count = all_point.token_count %}
                {% if site_point %}
                  {% assign site_table_previous_count = site_point.token_count %}
                  {% assign site_table_has_previous = true %}
                {% endif %}
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
      <div><h2>Three scopes</h2><p>Lifetime, weekly GitHub, and daily retained-token evidence each carry their own units and dates.</p></div>
      <div><h2>Daily token rhythm</h2><p>Deduplicated retained logs produce rounded cumulative points; the chart plots adjacent daily deltas for all retained Codex work and this repo.</p></div>
      <div><h2>Explicit transforms</h2><p>Daily tokens use log1p. GitHub Readable uses log1p for commits and symmetric log for signed line changes; Literal uses linear axes.</p></div>
      <div><h2>What's counted</h2><p>Owned public and private repositories are rolled up by week on default branches. Merge commits are skipped, and very large repositories may omit line totals.</p></div>
      <div><h2>Privacy boundary</h2><p>Daily endpoints publish only rounded dates and totals. Paths, sessions, turns, models, and source identities stay out of both series.</p></div>
      <div><h2>Price replay</h2><p>The lifetime dollar figure is a mix-matched public-API thought experiment, not a Codex bill or a field in the direct usage tracker.</p></div>
    </div>
    <p class="github-activity-table-scroll-hint" id="github-activity-table-scroll-hint">Scroll horizontally for all columns.</p>
    <div class="github-activity-table-wrap" role="region" aria-label="Weekly GitHub activity table" aria-describedby="github-activity-table-scroll-hint" tabindex="0">
      <table class="github-activity-table">
        <caption id="github-activity-table-caption">Reported weekly activity in the selected time window</caption>
        <thead><tr><th scope="col">Week</th><th scope="col">Commits</th><th scope="col">Added</th><th scope="col">Removed</th><th scope="col">Line changes</th></tr></thead>
        <tbody id="github-activity-table-body"></tbody>
      </table>
    </div>
  </details>

  <p class="github-activity-source">
    Aggregate GitHub snapshot updated <time id="github-activity-updated"></time>. Retained-token series come from the public agentic-usage ledger. Time-window and scale controls draw on
    <a href="https://idl.cs.washington.edu/files/2017-VegaLite-InfoVis.pdf">UW's Vega-Lite interaction research</a>; keyboard and alternative-reading paths draw on
    <a href="https://www.frank.computer/chartability/">CMU's Chartability heuristics</a>.
  </p>

  <script id="github-activity-data" type="application/json">{{ site.data.github_activity | jsonify }}</script>
  <script id="build-rhythm-token-data" type="application/json">{{ token_rhythm | jsonify }}</script>
  <script id="build-rhythm-all-work-token-data" type="application/json">{{ all_projects_rhythm | jsonify }}</script>
</section>
