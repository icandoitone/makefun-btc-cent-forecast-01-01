# BTC cent forecast 01 — Contrarian 24h mean-reversion forecaster

Forecasts Bitcoin's US-dollar price 4 hours ahead, one price per case,
from the 72 hours of 1-minute closes each case carries.

## Model

```
forecast = lastClose * exp(-0.25 * (log(lastClose) - log(close 24h ago)))
```

BTC's 4-hour log-returns in the practice recording are strongly
negatively autocorrelated (corr ≈ −0.30 between consecutive 4h returns),
so momentum extrapolation loses to persistence while a shrunk
contrarian pull against the past-day move wins. On a phase-shifted
4-hour walk-forward (120 checkpoints across the six overlapping 72h
practice windows) this model scores **37,679 cents MAE vs 42,025 for
persistence (−10%)**, beating persistence in all six windows; on the 5
derivable practice answers it is essentially tied with persistence
(47,318 vs 47,055 cents). The 0.25 shrink keeps the adjustment modest
(a few percent at most), which is the right play under MAE — the
conditional median, not an aggressive trend bet.

## Run

Requires Node 22+ (stdlib only, no network, deterministic):

```sh
MAKEFUN_INPUT_DIR=btc-cent-forecast-01-kit/input \
MAKEFUN_OUTPUT_DIR=out \
node main.ts
```

Reads every `<id>.in` in the input dir and writes `<id>.out` with
`{"forecasts":[{"case":"<id>","price":<number>}]}` — price clamped to
[0.00001, 9999999.99999] and rounded to 5 decimals. Runs in well under
a second per case; running twice produces byte-identical output.
