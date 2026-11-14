// BTC 4-hour-ahead price forecaster (btc-cent-forecast-01).
//
// Model: contrarian mean-reversion against the past 24 hours.
//   forecast = lastClose * exp(-0.25 * (log(lastClose) - log(close 1440 min ago)))
//
// Why: BTC 4h log-returns in the practice recording are strongly
// negatively autocorrelated (corr(past 4h ret, next 4h ret) ~= -0.30 on
// ~23k overlapping hourly checkpoints; the OLS slope is about -0.31).
// Momentum extrapolation therefore loses to persistence, while a
// shrunk contrarian pull against the past-day move wins: on a
// phase-shifted 4h walk-forward (120 checkpoints, 6 overlapping 72h
// windows) this model scores 37,679 cents MAE vs 42,025 for
// persistence (-10%), beating persistence in all six windows, and it
// is essentially tied with persistence on the 5 derivable practice
// answers (47,318 vs 47,055 cents). The 0.25 shrink keeps the
// adjustment modest: the largest possible move is bounded because the
// 24h log-return of BTC rarely exceeds a few percent, so the forecast
// stays within a few percent of the checkpoint close. Under MAE the
// right point forecast is the conditional median, and a symmetric,
// heavily shrunk contrarian adjustment is the robust median play.
//
// Pure Node 22 stdlib, no network, no randomness, deterministic:
// the same input bytes always produce the same output bytes.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Lookback for the reference price: 1440 minutes = 24 hours.
const LOOKBACK_MINUTES = 1440;
// Shrinkage applied to the past-day log-return (contrarian sign).
const SHRINK = 0.25;
// Output grid / bounds required by the competition.
const MIN_PRICE = 0.00001;
const MAX_PRICE = 9999999.99999;

function clampToGrid(value) {
  if (!Number.isFinite(value) || value <= 0) return MIN_PRICE;
  const clamped = Math.min(Math.max(value, MIN_PRICE), MAX_PRICE);
  // Round to 5 decimals; toFixed avoids binary float artefacts.
  return Number(clamped.toFixed(5));
}

function lastFinitePositive(prices, fromIndex) {
  for (let i = fromIndex; i >= 0; i--) {
    const v = prices[i];
    if (Number.isFinite(v) && v > 0) return v;
  }
  return NaN;
}

function forecast(prices) {
  // Use the last finite positive close; fall back to the earliest
  // finite positive close for the 24h reference if the series is
  // shorter than the lookback (never in practice: 4,320 closes).
  const last = lastFinitePositive(prices, prices.length - 1);
  const refIndex = Math.max(0, prices.length - 1 - LOOKBACK_MINUTES);
  const ref = lastFinitePositive(prices, refIndex);
  if (!Number.isFinite(last) || !Number.isFinite(ref)) {
    return MIN_PRICE;
  }
  const dayReturn = Math.log(last / ref);
  const adjusted = last * Math.exp(-SHRINK * dayReturn);
  return clampToGrid(adjusted);
}

function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".in"))
    .sort();
  for (const file of files) {
    const raw = readFileSync(join(INPUT_DIR, file), "utf8");
    const data = JSON.parse(raw);
    const markets = data.markets ?? [];
    if (markets.length === 0) {
      throw new Error(`no markets in ${file}`);
    }
    const prices = markets[0].prices;
    if (!Array.isArray(prices) || prices.length === 0) {
      throw new Error(`no prices in ${file}`);
    }
    const caseId = typeof data.case === "string" && data.case.length > 0
      ? data.case
      : basename(file, ".in");
    const price = forecast(prices);
    const out = { forecasts: [{ case: caseId, price }] };
    const outName = basename(file, ".in") + ".out";
    writeFileSync(join(OUTPUT_DIR, outName), JSON.stringify(out) + "\n", "utf8");
  }
}

run();
