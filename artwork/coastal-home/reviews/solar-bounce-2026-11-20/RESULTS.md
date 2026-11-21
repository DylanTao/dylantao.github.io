# Solar visibility at the release probes

Source `ba2272f7e4397d4dee1cfd504641ee40b88aeccc` and signed field `71a97134a170db1223ca047ce8e67276a6cc9f935ae6d682c8c6778ab821a046`.

123/128 valid probes. 7872/7872 canonical primary distances matched the packed Float32 moments exactly. 58 time samples and 14 normals. CPU replay took 8.5 s after immutable source staging.

The time and orientation identify each cage’s brightest single 16 m sample. The 64 m and baseline values are at that same probe, time and normal. P95 ranges over adequately lit samples in each cage under the bundled visitor weather.

| Transport cage     | Valid | Peak Pacific time / normal | Solar at 16 m | Solar at 64 m | Sky + indirect lamps | P95 ratio 16 / 64 m |
| ------------------ | ----: | -------------------------- | ------------: | ------------: | -------------------: | ------------------: |
| study              |   8/8 | 16:15 / west               |        0.0015 |        0.0015 |               0.0994 |         0.0% / 0.0% |
| sleep              |   8/8 | 16:20 / north              |        0.1130 |             0 |               0.1304 |        16.6% / 0.0% |
| onsen              |   8/8 | 16:15 / north              |        0.1103 |        0.0841 |               0.0500 |      100.2% / 51.5% |
| kitchen            |   6/8 | 15:00 / northeast          |        0.2308 |        0.0105 |               0.0898 |       34.3% / 14.4% |
| dining             |   8/8 | 15:00 / north              |        0.0759 |        0.0354 |               0.0548 |       74.1% / 47.7% |
| living             |   8/8 | 14:45 / north              |        0.2473 |        0.1117 |               0.0845 |      127.6% / 78.8% |
| lounge             |   8/8 | 14:15 / north              |        0.4347 |        0.2731 |               0.1067 |     246.9% / 163.6% |
| nearhouse          |   8/8 | 14:45 / north              |        0.4007 |        0.2667 |               0.2480 |      106.2% / 87.7% |
| gym                |   8/8 | 15:30 / north              |        0.2351 |        0.2351 |               0.0603 |     167.3% / 164.6% |
| library            |   8/8 | 14:45 / north              |        0.0262 |        0.0114 |               0.2084 |         2.2% / 1.8% |
| library-upper      |   8/8 | 16:15 / east               |        0.0910 |        0.0228 |               0.0014 |       35.2% / 24.9% |
| bath-living        |   8/8 | —                          |             0 |             0 |                    — |         0.0% / 0.0% |
| bath-bedroom       |   8/8 | 16:20 / north              |        0.0084 |        0.0056 |               0.0105 |         0.0% / 0.0% |
| outdoor-pavilion   |   8/8 | 14:45 / north              |        0.0310 |        0.0153 |               0.3579 |         3.1% / 2.8% |
| retreat-short-link |   6/8 | 15:00 / north              |        0.0186 |             0 |               0.0184 |        26.7% / 2.6% |
| arrival-hall       |   7/8 | —                          |             0 |             0 |                    — |         0.0% / 0.0% |

## Angular and shadow sensitivity

The table holds the probe, time and normal fixed while increasing the number of primary rays. The two values in each cell show the 16 m and 64 m solar terms. The denominator stays on the signed field.

| Cage   | Probe and Pacific time / normal | Sky + indirect lamps |         64 rays |          144 rays |           256 rays |
| ------ | ------------------------------- | -------------------: | --------------: | ----------------: | -----------------: |
| study  | #7 · 16:15 / west               |               0.0994 | 0.0015 / 0.0015 |             0 / 0 |         0.0020 / 0 |
| sleep  | #11 · 16:20 / north             |               0.1304 |      0.1130 / 0 | 0.1008 / 0.000640 | 0.1001 / 0.0000246 |
| onsen  | #19 · 16:15 / north             |               0.0500 | 0.1103 / 0.0841 |   0.1014 / 0.0870 |    0.0982 / 0.0826 |
| living | #43 · 14:45 / north             |               0.0845 | 0.2473 / 0.1117 |   0.1698 / 0.0548 |    0.1876 / 0.0519 |
| lounge | #51 · 14:15 / north             |               0.1067 | 0.4347 / 0.2731 |   0.2335 / 0.1724 |    0.2720 / 0.1904 |
| gym    | #65 · 15:30 / up                |               0.1219 | 0.1358 / 0.1358 |   0.0764 / 0.0764 |    0.1116 / 0.1116 |

4,235 of 19,458 rays clear at 16 m encountered a blocker by 64 m in the retained geometry (21.8%).

The clear control’s all-day P95 ratios at 64 m were living 83.2%, lounge 164.7%, gym 162.4%, onsen 59.1%.

The lounge, living room, gym and onsen retain a substantial afternoon term with the longer shadow and denser quadrature. The bedroom’s nominal late peak is almost entirely cutoff-sensitive. The study’s small peak is sensitive to angular sampling. See the README for the irradiance units and scope.

Geometry SHA-256 values

- Positions `df256e49eb5015c553b99452e57c7b7b12ba39bdeb5af0c708c58c9111615088`
- Diffuse albedo `5a939b82a1d1dcceb184b3fec1edfa855e8bc7c466da1b39bbe708e7eae0926d`
