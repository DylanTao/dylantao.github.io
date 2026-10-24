# La Jolla weather, October 24

The scene now has a small, precomputed NWS forecast and a data-backed seasonal rain simulation.
The existing solar position, moon, scattering atmosphere, coastal wind field and authored
morning marine-layer schedule remain separate. Browser weather sampling makes no network request,
loads no ML weights and adds no dependency.

Before this change, `weatherFor` drew independent daily marine/cirrus moods from authored monthly
chances and had no rain. Those original marine chances remain an explicit art direction outside
the forecast interval. After this change, real forecast hours can supply cloud conditions and rain;
otherwise a reproducible wet/dry sequence supplies mostly sunny weather with occasional winter rain
and multiday wet spells. The scene is an authored home, not a weather service or a claim about
Sirui's current location.

## Data custody and scope

- NOAA GHCN-Daily station **USW00023188, San Diego Lindbergh Field** supplies daily precipitation.
  Its 1991–2025 record contains **12,784 accepted days out of 12,784 calendar days**. This is a
  nearby coastal regional proxy, not a measurement at the fictional cliff house.
- The closer **US1CASD0030, La Jolla 2.1 SE** gauge was considered: 5,732 accepted days out of
  5,844 during 2010–2025. Its shorter, incomplete coverage motivated using the long airport record.
  The local record is retained as a coverage comparison, not silently filled or merged.
- A wet day means **at least 0.3 mm**. GHCN stores tenths of a millimetre, so it cannot represent
  an exact 0.01-inch threshold. Missing values and nonblank quality flags are excluded; multiday
  `MDPR` totals are not treated as single-day observations. The accepted airport data contain only
  blank/trace measurement flags during the fitting interval. Trace precipitation stays below the
  wet threshold.
- The **NWS SGX/53,20 hourly** forecast is for the La Jolla point at 32.8328, −117.2713. Its issued
  time is **2026-10-24T10:11:18Z**; retained hourly intervals run from
  **2026-10-24T07:00:00−07:00** through **2026-10-30T19:00:00−07:00**. Each interval carries its own
  UTC start. Outside an actual interval, `source` immediately becomes `seasonal-simulation`, with
  null forecast timestamps. Old forecast data are never relabeled as current.

The compressed files under `source/` retain the original response bytes. The build receipt records
their decoded byte lengths, SHA-256 hashes and source URLs. This entire artwork directory is
Jekyll-excluded. Only the generated **13,256-byte** `weather-data.mjs` is loaded at runtime.

Primary sources: [GHCN file layout and flags](https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt),
[airport station record](https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/USW00023188.dly),
[La Jolla station metadata](https://www.ncdc.noaa.gov/cdo-web/datasets/GHCND/stations/GHCND%3AUS1CASD0030/detail),
[NWS point metadata](https://api.weather.gov/points/32.8328,-117.2713) and
[hourly forecast](https://api.weather.gov/gridpoints/SGX/53,20/forecast/hourly).

## Validation and the model choice

A monthly first-order wet/dry Markov model conditions tomorrow's probability on the previous wet/dry
state. Each monthly transition uses a fixed 12-day Beta prior centered on that month's wet-day
frequency. This small prior was specified before holdout scoring. Training uses 1991–2015;
**2016–2025 is a chronological, 3,653-day holdout**. The candidate's one-day conditional probabilities
are evaluated with the observed previous day's state; missing pairs would be excluded.

| Predictor                 | Held-out Brier score, lower is better |
| ------------------------- | ------------------------------------: |
| Seasonal Markov           |                            0.08416261 |
| Monthly climatology       |                            0.09512018 |
| Yesterday's wet/dry state |                            0.12236518 |
| Always dry                |                            0.11360526 |

This is **11.52% Brier skill relative to monthly climatology**, with improvement in all ten held-out
years. It establishes a useful one-day statistical baseline. It does **not** validate the subsequent
synthetic sequence as a real multiweek forecast, demonstrate NWS accuracy, or establish a SOTA result.
No future outcome observations were used to score this particular NWS snapshot.

The production model is then explicitly refitted on 1991–2025. Its precomputed 2000–2099 sequence
contains 3,880 wet days in 36,525 days: about 38.8 wet days per year. This is predominantly dry
weather; wet days cluster in the cool season and spells persist rather than flickering between
independent daily draws. Dates outside that precomputed range use monthly climatology with a
deterministic hash, retaining the seasonal frequency but losing spell persistence.

Current modern forecasting was considered. ECMWF's operational **AIFS v2** includes deterministic
and ensemble forecasts initialized from a global operational atmospheric analysis, rather than one
local rain gauge. Its operational data product is a sensible future source if real forecast fidelity
becomes a product goal. Downloading model weights, building global initial conditions or repeatedly
transferring global fields is disproportionate for the visitor benefit here. The lighter NWS point
snapshot supplies an actual local forecast without representing this small statistical model as
modern global ML forecasting. See [ECMWF's current AIFS data description](https://www.ecmwf.int/en/forecasts/datasets/aifs-machine-learning-data)
and [May 2026 operational update](https://www.ecmwf.int/en/about/media-centre/news/2026/ifs-cycle-50r1-aifsv2-live).

## Authored interpretation and integration

`weatherAt(dateKey, minute, { utcMilliseconds })` returns the original
`marine`, `eveningMarine`, `cirrus`, `seed`, plus `cloudCover`, `rain`, `rainChance`,
`rainAmountMm`, `rainWindows`, `source` and forecast timestamps. Pass the atmosphere's existing UTC
value to distinguish the repeated Pacific hour at the autumn DST transition. Date/minute-only
authoring previews deterministically select the first occurrence.

`rainAt(weather, minute)` returns a bounded 0–1 display amplitude. Production weather stays at or
below 0.65; an explicit `rainOverride` permits QA. Rain windows ease in and out over 15 minutes.
Daily gauge amounts select a fitted monthly amount quantile; their within-day start, 2–8 hour
duration and amplitude are authored. NWS rain text plus a 30% probability threshold enables an
authored light-rain amplitude, with a separate amplitude for explicitly heavy rain. Probability
does not become a purported physical rain rate. NOAA's [probability glossary](https://www.noaa.gov/jetstream/appendix/weather-glossary-p)
explains that precipitation probability does not measure intensity.

NWS text maps to a generic cloud fraction; it does not identify the marine inversion's height.
Forecast mode therefore leaves the invented low marine bank off. Outside forecast hours, the
retained seasonal morning/evening marine art direction remains available, and generic rain cloud
cover eases with the rain. The seasonal marine shape is consistent with the
[NWS San Diego boating guide](https://www.weather.gov/media/sgx/marine/BoatersWeatherBooklet.pdf),
but its exact probabilities and burnoff times are not station-fitted predictions. It does not
guarantee that every real La Jolla afternoon clears.

These pure functions contain no timers, active clock, random state or browser networking.
The renderer owns Pause/hidden/reduced-motion behavior by sampling the existing scene clock and
holding precipitation geometry still. New geometry/materials must participate in the existing
program warmup. Root integration owns actual rain/cloud rendering and its desktop/mobile evidence;
these source tests alone do not prove rendered rainfall, frame rate or shelter occlusion.

## Reproduce and refresh

From the repository root:

```powershell
python bin/build_coastal_weather.py
npx.cmd prettier --write artwork/coastal-home/weather-2026-10-24/build-receipt.json
node --test test/coastal-weather.test.mjs test/atmosphere.test.mjs
python -m unittest discover -s test -p test_coastal_weather.py
```

The default build is entirely offline and reproduces the retained snapshot. To deliberately refresh
source data and the small forecast artifact, run `python bin/build_coastal_weather.py --refresh`,
review the changed provenance/date coverage and rerun the focused checks. No scheduled workflow,
background visitor fetch or credential was added. Expiry is safe without maintenance; refreshing
weekly would be an explicit maintenance choice, not a requirement for a functioning scene.

`weatherFor` remains re-exported by `atmosphere-model.mjs`; the atmospheric optics and
`marineLayerAt` equations are unchanged. The next meaningful weather improvement, if needed, is a
rendered comparison of forecast cloud versus seasonal marine/rain at the same camera and minute,
then a bounded shelter/phone-performance check. Further model complexity needs a visitor-facing
benefit and a forecast validation target before adding infrastructure.
