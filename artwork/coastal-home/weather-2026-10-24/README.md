# La Jolla weather

The 3D home's weather has two sources. For the next six to seven days it shows the National Weather
Service's hourly forecast for the La Jolla point, refreshed each morning by
`.github/workflows/update-weather.yml`. Outside those forecast hours it draws each day from a calibrated
statistical model of the San Diego airport rain gauge: mostly sun, with rain concentrated between
November and March and often lasting two or three days. The morning marine layer and high cirrus
remain authored art direction. The browser makes no weather request, loads no ML weights and adds no
dependency. The scene is an authored home, not a weather service or a claim about Sirui's current
location.

This directory was created on October 24, 2026. Its station records and model are that day's
retrieval; only the NWS forecast pair under `source/` rolls forward.

## Data custody and scope

- NOAA GHCN-Daily station **USW00023188, San Diego Lindbergh Field** supplies daily precipitation.
  Its 1991–2025 record contains **12,784 accepted days out of 12,784 calendar days**. This is a
  nearby coastal regional proxy, not a measurement at the fictional cliff house.
- The closer **US1CASD0030, La Jolla 2.1 SE** gauge was considered: 5,732 accepted days out of
  5,844 during 2010–2025. Its shorter, incomplete coverage motivated using the long airport record.
  The local record is retained as a coverage comparison, not silently filled or merged.
- A wet day means **at least 0.3 mm**. US gauges report hundredths of an inch, which GHCN stores in
  tenths of a millimetre, so one recorded hundredth appears as 0.3 mm and is the smallest wet amount.
  Missing values and nonblank quality flags are excluded; multiday `MDPR` totals are not treated as
  single-day observations. Trace precipitation stays below the wet threshold.
- The **NWS SGX/53,20 hourly** forecast is for the La Jolla point at 32.8328, −117.2713. Each refresh
  keeps NWS's own `updateTime` (recorded as `issued`) and `generatedAt`, the runner's clock when the
  refresh requested it (`retrieved`), and the response's HTTP `Date` and `Last-Modified` headers, in
  `source/retrieval.json` and the receipt's `forecast` block. Each hourly interval carries its own UTC
  start. Outside an actual interval, `source` immediately becomes `seasonal-simulation`, with null
  forecast timestamps. Old forecast data are never relabeled as current.
- NOAA CPC's **Oceanic Niño Index** table (`source/oni.ascii.txt.gz`, retrieved
  2026-10-24T23:48:29Z, last modified 2026-10-03) feeds only the model comparison below; the
  production model does not use it.
- The GHCN files were retrieved for commit `162685ac8` on October 24; their request time was not
  recorded, and `retrieval.json` says so rather than inventing one. `ghcnd-version.txt` names
  GHCN-Daily 3.35-upd-2026102217.

The compressed files under `source/` retain the original response bytes. The build receipt records
their decoded byte lengths, SHA-256 hashes and URLs, the model and its validation, and the runtime's
hash. This entire artwork directory is Jekyll-excluded. Only the generated `weather-data.mjs`, about
13.7 KB, is loaded at runtime.

Primary sources: [GHCN file layout and flags](https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt),
[airport station record](https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/USW00023188.dly),
[La Jolla station metadata](https://www.ncdc.noaa.gov/cdo-web/datasets/GHCND/stations/GHCND%3AUS1CASD0030/detail),
[NWS point metadata](https://api.weather.gov/points/32.8328,-117.2713),
[hourly forecast](https://api.weather.gov/gridpoints/SGX/53,20/forecast/hourly) and
[CPC ONI table](https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt).

## The daily forecast refresh

`update-weather.yml` runs at 10:25 UTC, five minutes after the code-activity import and before the
11:20 UTC scheduled deploy, in the shared `main-autocommit` concurrency group. It runs
`python bin/build_coastal_weather.py --refresh-forecast`, which:

1. requests the NWS point metadata and hourly forecast with a `User-Agent` naming the site, and
   retries server errors and timeouts twice;
2. **rejects** a response that no longer validates (a moved grid cell, malformed GeoJSON, fewer than
   72 hours, a missing or non-hourly period, an impossible probability, or an issue time in the
   future) with exit 1, which fails the run visibly;
3. **defers** with exit 75 when NWS is unreachable, or serves a forecast issued more than 36 hours
   ago, covering fewer than 72 future hours, starting more than three hours ahead, or older than the
   retained snapshot; the run stays green and records a notice while the published snapshot still
   has 72 hours left, and fails visibly after that, so a person looks before the hours run out;
4. writes nothing when the forecast is unchanged (NWS regenerates `generatedAt` on every request, so
   that field alone is not a change);
5. otherwise rebuilds the runtime and receipt from the retained bytes and replaces each file
   atomically.

On any failure the last valid snapshot stays published and expires to the seasonal model after its
own last hour, so the scene needs no maintenance to stay correct. Before committing, the workflow
reruns the weather tests and Prettier and refuses to commit anything outside the five snapshot paths.
It commits only when the data changed, at most once a day, as `GitHub Actions <actions@github.com>`
with `chore: refresh coastal weather forecast`, mirroring the citation and code-activity bots. If
someone pushes to `main` while it runs, it rebuilds once on the new head and pushes again.

**Why this trigger design.** The push uses the default `GITHUB_TOKEN`, and pushes made with it start
no workflow runs: the October 17 citation commit `30bf85de7` has no push-triggered run. A weather
commit therefore cannot cancel an in-flight visual run of someone's change or start the 41-job
matrix, and the existing scheduled deploy publishes it, as it publishes the other data commits. The
alternatives were worse here. Path filters would mean editing several workflows for pushes that never
trigger them.
`[skip ci]` is redundant with `GITHUB_TOKEN`, and an explicit deploy dispatch would need
`actions: write` and move `gh-pages` twice a day. Fetching at deploy time would publish bytes that are
in no commit, so the receipt, tests and history would stop describing the live site.

**Risks.** In October 2026 GitHub started these crons two to nine hours late, but kept their
order. If the weather run ever lands after the deploy starts, the new snapshot waits for the next
deploy (a human push or the next day), and visitors see a forecast up to a day older that still
covers about five days. A third `main-autocommit` run queued while this one is pending would cancel the
pending run. Scene specs pin past instants, which a refresh never reaches; `test/coastal-weather.test.mjs`
fails if a 3D-home spec pins an instant inside the rolling window or one the seasonal model makes
rainy. A few specs that only check controls, avatars or physics run on the live clock and therefore
see that day's forecast; none of them asserts lighting or rain.

Locally, `python bin/build_coastal_weather.py --refresh-forecast --dry-run` fetches and validates
without writing, and `--check` confirms that the committed runtime and receipt rebuild byte for byte
from the retained sources. The workflow's script was exercised against a throwaway bare origin for a
dry run, an outage, a malformed response, a real update, an unchanged rerun and a concurrent push.

## The seasonal model

Each simulated day's wet/dry draw comes from a ridge-penalized logistic regression, the
generalized-linear-model form of a stochastic weather generator (Furrer and Katz, "Generalized linear
modeling approach to stochastic weather generators", _Climate Research_ 34, 2007). Its 14 terms are
three annual harmonics of the day of year; whether yesterday and the day before were wet, with
yesterday's effect varying through the year; the logarithm of yesterday's total on a wet day; and the
logarithm of the days since the last wet day. In the 1991–2025 production fit, a wet yesterday adds
0.92 to the log-odds on average through the year and its total adds 0.54 per unit of ln(1 + mm);
two wet days in a row lower the next day's log-odds by 0.52 against one, and a long dry spell lowers
it by 0.25 per unit of ln(days).

The model was selected inside the training years, before its held-out comparison with the previous
model. Ten pre-registered candidates were scored by five-fold blocked cross-validation over
1991–2015, with five-year folds and each ridge strength chosen from 0, 1, 3, 10 and 30. The rule was
the lowest CV Brier score; among candidates within one paired block-bootstrap standard error of it,
the fewest terms; then the lower CV Brier. It selected the dry-spell model.
`python bin/build_coastal_weather.py --evaluate` reruns the comparison into `model-evaluation.json`.

| Predictor                               | Terms | CV Brier, 1991–2015 | Held-out Brier, 2016–2025 | Held-out log loss |
| --------------------------------------- | ----: | ------------------: | ------------------------: | ----------------: |
| Previous monthly Markov chain (Oct 24)  |    24 |             0.08240 |                   0.08416 |            0.2901 |
| Harmonic climatology                    |     7 |             0.09162 |                   0.09408 |            0.3187 |
| First-order GLM                         |    10 |             0.08222 |                   0.08238 |            0.2835 |
| Second-order GLM                        |    12 |             0.08184 |                   0.08211 |            0.2831 |
| + yesterday's amount                    |    13 |             0.08024 |                   0.08077 |            0.2804 |
| **+ days since rain (production)**      |    14 |         **0.08012** |               **0.08089** |        **0.2809** |
| + wet days in the last 30               |    14 |             0.08017 |                   0.08056 |            0.2798 |
| + rain total in the last 30 days        |    14 |             0.08016 |                   0.08071 |            0.2802 |
| Third-order GLM with amount             |    14 |             0.08028 |                   0.08069 |            0.2802 |
| Second-order GLM with amount + ENSO     |    16 |             0.08035 |                   0.08074 |            0.2804 |
| Production + ENSO                       |    17 |             0.08021 |                   0.08087 |            0.2809 |
| Monthly climatology                     |    12 |                     |                   0.09512 |            0.3234 |
| Yesterday's wet/dry state (persistence) |       |                     |                   0.12237 |                   |
| Always dry                              |       |                     |                   0.11361 |                   |

The five memory variants at the top are statistically indistinguishable: their CV scores lie within
two paired standard errors of each other, each about 0.0001. The rule's choice among them is
therefore close to arbitrary, and every one improves the previous model by about 4%. Choosing by the held-out column would have
picked the 30-day wet count; that is exactly why the held-out years do not choose.

On the held-out decade, with the model fitted only on 1991–2015:

- The Brier score is **0.08089 against 0.08416** for the previous model, 3.9% better, and the skill
  against monthly climatology rises from 11.5% to **15.0%**. A 30-day moving-block bootstrap puts the
  mean daily difference at −0.00327, with a 95% interval of −0.00486 to −0.00164. The new model is
  better in 9 of the 10 years; 2017 is the exception.
- The log loss is 0.2809 against 0.2901.
- Calibration improved. Murphy's reliability term fell from 0.00106 to 0.00022 while resolution rose
  from 0.0180 to 0.0197 (uncertainty 0.1007). Days the previous model put at 20–30% rained 44% of the
  time; at the same forecast level the new model's days rained 30% of the time. The receipt keeps both
  reliability tables.

The precomputed 2000–2099 scene sequence behaves like the gauge. It is one 100-year draw, not a
forecast of those years:

| Sequence              | Wet days per year | Year-to-year SD | Mean wet spell | Spells of 3+ days |
| --------------------- | ----------------: | --------------: | -------------: | ----------------: |
| Observed 1991–2025    |              40.5 |            10.1 |      1.79 days |             18.4% |
| Production, 2000–2099 |              39.6 |             9.3 |      1.76 days |             18.4% |
| Previous, from Oct 24 |              38.8 |             7.7 |      1.73 days |             17.3% |

Each wet day draws one of its month's 20 midpoint-quantile totals, up from five, and that draw feeds
the next day's amount term. On the 415 held-out wet days, the CRPS of this amount distribution falls
from 3.95 mm to 3.85 mm. The rain's display intensity and duration remain authored mappings of the
amount. The browser's `modelChance` recomputes each day's probability from the published
coefficients, and the unit test re-derives all 36,525 precomputed days in JavaScript without a single
disagreement with Python. Dates outside 2000–2099 fall back to monthly climatology with a date hash,
which keeps the seasonal frequency but loses spells.

## What did not help, and what "state of the art" means here

- **ENSO.** The ONI already published when each month began made cross-validation slightly worse in
  both forms tried (+0.00011 and +0.00009 Brier) and improved the held-out Brier by only 0.00002.
  ENSO matters at the seasonal scale: November–March wet days correlate with that autumn's ONI at
  r = 0.36 over 34 seasons. Tomorrow's chance, though, is dominated by the last few days, so the
  production model leaves ENSO out. It therefore does not encode the strong El Niño now under way
  (the retained table's July–September 2026 ONI is +2.16); the simulated winter is an ordinary one.
  The NWS forecast carries whatever the coming week actually holds.
- **Longer memory.** Thirty-day counts or totals and a third lag changed the CV Brier by less than its
  standard error.
- **A flexible ML model.** An exploratory scikit-learn 1.6.1 gradient-boosting classifier on the same
  history features plus ONI, tuned on the same folds, scored a CV Brier of 0.0806 and a held-out Brier
  of 0.0819 (log loss 0.2843): no better than the GLM. It is outside the standard-library builder, so
  `--evaluate` does not reproduce it.

For days one to seven, the NWS forecast, prepared by forecasters from numerical weather prediction, is
the best signal available, and the scene shows it as published; no outcomes were used to score these
particular snapshots. Beyond a week, daily skill can come only from the season, the last few days and,
weakly, slow climate states such as ENSO. The held-out score above measures one-day-ahead
probabilities given the observed yesterday. It validates the generator's day-to-day behaviour, not a
multiweek forecast. Within that frame this is a careful, calibrated statistical model, in the
established family of GLM weather generators; it is not modern global weather forecasting. ECMWF's
operational **AIFS** produces deterministic and ensemble forecasts from a global atmospheric analysis.
Its data would be the sensible source if real forecast fidelity became a product goal, but downloading
model weights or repeatedly transferring global fields is disproportionate to the visitor benefit
here. See ECMWF's [AIFS data description](https://www.ecmwf.int/en/forecasts/datasets/aifs-machine-learning-data)
and [May 2026 operational update](https://www.ecmwf.int/en/about/media-centre/news/2026/ifs-cycle-50r1-aifsv2-live).

## Authored interpretation and integration

`weatherAt(dateKey, minute, { utcMilliseconds })` returns the original `marine`, `eveningMarine`,
`cirrus` and `seed`, plus `cloudCover`, `rain`, `rainChance`, `rainAmountMm`, `rainWindows`, `source`
and forecast timestamps. Pass the atmosphere's existing UTC value to distinguish the repeated Pacific
hour at the autumn DST transition; date/minute-only authoring previews deterministically select the
first occurrence. On a simulated day `rainChance` is the model's probability given the simulated days
before it; on a forecast hour it is the NWS probability of precipitation.

`rainAt(weather, minute)` returns a bounded 0–1 display amplitude. Production weather stays at or
below 0.65; an explicit `rainOverride` permits QA. Rain windows ease in and out over 15 minutes.
A simulated wet day's start, 2–8 hour duration and amplitude are authored from its drawn total. NWS
rain text plus a 30% probability threshold enables an authored light-rain amplitude, with a separate
amplitude for explicitly heavy rain. Probability does not become a purported physical rain rate;
NOAA's [probability glossary](https://www.noaa.gov/jetstream/appendix/weather-glossary-p) explains
that precipitation probability does not measure intensity.

NWS text maps to a generic cloud fraction; it does not identify the marine inversion's height.
Forecast mode therefore leaves the invented low marine bank off. Outside forecast hours, the retained
seasonal morning/evening marine art direction remains available, and generic rain cloud cover eases
with the rain. The seasonal marine shape is consistent with the
[NWS San Diego boating guide](https://www.weather.gov/media/sgx/marine/BoatersWeatherBooklet.pdf),
but its exact probabilities and burnoff times are not station-fitted predictions. It does not
guarantee that every real La Jolla afternoon clears.

These pure functions contain no timers, active clock, random state or browser networking. The
renderer owns Pause, hidden and reduced-motion behaviour by sampling the existing scene clock and
holding precipitation geometry still. `weatherFor` remains re-exported by `atmosphere-model.mjs`; the
atmospheric optics and `marineLayerAt` equations are unchanged.

## Rain in the rendered scene

Each light step, `atmosphere.mjs` samples `weatherAt` for the scene's Pacific date and minute. The
rain amplitude then drives three things: the overcast sky and haze, a veil over the sun's light, and
`coastal-rain.mjs`, one depth-tested `LineSegments` draw with no extra pass and no shadow casters.
`?weather=clear|marine|cirrus|rain` pins an authoring override; `rain` forces the 0.65 maximum. On
`[data-home-desk-scene]`, `getSceneEvidence()` reports `ecology.atmosphere.weather` (source, rain,
cloud cover, chance, forecast timestamps) and `simulation.rain` (intensity, drops, landed,
near-camera and field extent).

The first captures showed that rain rendered but did not read as rain. At the forced maximum, 333
streaks were spread through a 64 m world square from 31 m down, and only a few fell inside the view.
A 1100 × 650 crop of the 4K full-screen view held three hairlines, and the 545 × 462 embedded canvas
showed only a few faint specks. The field had a second fault: it was placed relative to the camera snapped to a 4 m
grid, so the whole shower jumped 4 m when the camera crossed a grid line. The field is now a
world-stable box 30 m wide, centred 12 m ahead of the camera, from 20 m below it to 8 m above. Drops
fall at a light-rain drop's 4 m/s and drift with the coastal wind from their entry at the box's top.
Up to 1,024 drops (256 on touch devices) scale with the amplitude, and any drop within 3.5 m of the
lens is held degenerate rather than slashing across the view. Under the same fixed Date, camera and
forced maximum, the full-screen and embedded views now show a legible shower. The natural NWS hour
used below (2026-10-30 09:30, 31% chance, amplitude 0.28) shows sparse drizzle over a grey morning.

Stills, retained locally under `.jekyll-cache/visual-qa/weather-2026-10-24/`:
`before-forced-rain`, `before-forced-clear`, `after-forced-rain` and `after-nws-rain`, each
`outside-day-embed.png` and `outside-day-fullscreen.png` where captured. From inside the kitchen
(`after-forced-rain-kitchen`), 600 of the 666 forced drops land on the covered volumes and no streak
falls indoors.

Cost: the field is still one line draw of at most 1,024 segments, and its CPU update measured 0.16 ms
per frame for 287 drops and 0.19–0.40 ms for 666 drops in Node on this host. The browser probe
(`bin/measure_coastal_views.cjs`, outside view at the 545 × 461 embed, the same natural rain hour,
fresh browser per run in ABBA order) compared the previous field, the new field and `?weather=clear`.
The host was heavily shared and ran at 6–10 frames per second. Medians for the same variant differed
by 33–66 ms between runs, more than the variants' means differed (133, 142 and 167 ms), and draw
counts matched. That probe therefore cannot resolve the field's cost on this machine; a quiet-host
and real-phone measurement remains open.

Limits: WebGL draws lines one pixel wide, so 4K streaks stay fine hairlines; there are no splashes,
ripples or wet surfaces. Under forecast overcast the sun's light is veiled to about 40% but its shadow
edges stay crisp, which reads more like a dim day than rain. That lighting belongs to `atmosphere.mjs`
and `controller.mjs`, not this module. Scene specs pin past instants, which a forecast refresh never
reaches, and `test/coastal-weather.test.mjs` fails if a 3D-home spec pins an instant inside the
rolling forecast window or one the seasonal model makes rainy.

## Reproduce and refresh

From the repository root:

```powershell
python bin/build_coastal_weather.py            # offline rebuild from the retained bytes
python bin/build_coastal_weather.py --check    # fail if the committed outputs differ from that rebuild
python bin/build_coastal_weather.py --refresh-forecast --dry-run
python bin/build_coastal_weather.py --evaluate # the candidate comparison, a few minutes
node --test test/coastal-weather.test.mjs test/atmosphere.test.mjs
python -m unittest discover -s test -p test_coastal_weather.py
```

The default build is entirely offline, needs only the Python standard library and writes
Prettier-formatted JSON. `--refresh` deliberately refreshes every source, including the station
records and ONI; review the changed provenance, coverage and validation before committing it.
