"""
Chart-ready JSON for the React front end (rendered with Recharts / SVG).

Two layers:
  * the original single-purpose helpers (histogram_data, bar_chart_data, ...) kept for the
    existing endpoints;
  * custom_chart(): ONE function that builds any chart type from one or many columns, and
    recommended_charts(): the auto-generated gallery shown when the Charts tab opens.

Static image export for the PDF report is handled separately in app/reports (matplotlib).
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from app.statistics.engine import numeric_columns
from app.utils.serialize import safe_json

AGGS = ("sum", "mean", "median", "min", "max", "count", "nunique")
CHART_KINDS = ("histogram", "bar", "line", "area", "scatter", "pie", "box", "heatmap")


def categorical_columns(df: pd.DataFrame) -> list[str]:
    numeric = set(numeric_columns(df))
    return [c for c in df.columns if c not in numeric]


# --------------------------------------------------------------------------
# original helpers (unchanged behaviour)
# --------------------------------------------------------------------------
def histogram_data(df: pd.DataFrame, column: str, bins: int = 20) -> dict:
    s = df[column].dropna()
    if len(s) == 0:
        return {"column": column, "bins": []}
    counts, edges = np.histogram(s, bins=bins)
    data = [
        {"bin": f"{edges[i]:.2f}–{edges[i+1]:.2f}", "count": int(counts[i]), "bin_start": float(edges[i])}
        for i in range(len(counts))
    ]
    return safe_json({"column": column, "bins": data})


def boxplot_data(df: pd.DataFrame, column: str) -> dict:
    s = df[column].dropna()
    if len(s) == 0:
        return {"column": column}
    q1, median, q3 = s.quantile(0.25), s.quantile(0.5), s.quantile(0.75)
    iqr = q3 - q1
    lower_fence, upper_fence = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    whisker_low = s[s >= lower_fence].min()
    whisker_high = s[s <= upper_fence].max()
    outliers = s[(s < lower_fence) | (s > upper_fence)].tolist()
    return safe_json({
        "column": column,
        "min": float(s.min()), "q1": float(q1), "median": float(median),
        "q3": float(q3), "max": float(s.max()),
        "whisker_low": float(whisker_low), "whisker_high": float(whisker_high),
        "outliers": outliers[:50],
    })


def bar_chart_data(df: pd.DataFrame, column: str, top_n: int = 15) -> dict:
    counts = df[column].value_counts(dropna=True).head(top_n)
    data = [{"category": str(idx), "count": int(cnt)} for idx, cnt in counts.items()]
    return safe_json({"column": column, "data": data})


def pie_chart_data(df: pd.DataFrame, column: str, top_n: int = 8) -> dict:
    counts = df[column].value_counts(dropna=True)
    top = counts.head(top_n)
    data = [{"name": str(idx), "value": int(cnt)} for idx, cnt in top.items()]
    if len(counts) > top_n:
        data.append({"name": "Other", "value": int(counts.iloc[top_n:].sum())})
    return safe_json({"column": column, "data": data})


def scatter_data(df: pd.DataFrame, x: str, y: str, max_points: int = 1000) -> dict:
    sub = df[[x, y]].dropna()
    if len(sub) > max_points:
        sub = sub.sample(max_points, random_state=42)
    data = [{"x": float(row[x]), "y": float(row[y])} for _, row in sub.iterrows()]
    return safe_json({"x": x, "y": y, "data": data})


def timeseries_data(df: pd.DataFrame, date_col: str, value_col: str) -> dict:
    sub = df[[date_col, value_col]].dropna().copy()
    sub[date_col] = pd.to_datetime(sub[date_col], errors="coerce")
    sub = sub.dropna(subset=[date_col]).sort_values(date_col)
    span_days = (sub[date_col].max() - sub[date_col].min()).days if len(sub) > 1 else 0
    freq = "M" if span_days > 120 else "D"
    grouped = sub.set_index(date_col)[value_col].resample(freq).mean().dropna()
    data = [{"date": idx.strftime("%Y-%m-%d"), "value": float(val)} for idx, val in grouped.items()]
    return safe_json({"date_column": date_col, "value_column": value_col, "frequency": freq, "data": data})


def auto_chart_suggestions(df: pd.DataFrame) -> dict:
    """Suggests which charts are worth generating given this dataset's shape."""
    num_cols = numeric_columns(df)
    cat_cols = [c for c in categorical_columns(df) if df[c].nunique(dropna=True) <= 30]
    date_cols = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    if not date_cols:
        for c in df.columns:
            if c in num_cols:
                continue
            sample = df[c].dropna().head(30)
            if len(sample) and pd.to_datetime(sample, errors="coerce").notna().mean() > 0.9:
                date_cols.append(c)

    return safe_json({
        "numeric_columns": num_cols,
        "categorical_columns": cat_cols,
        "date_columns": date_cols,
        "suggested": {
            "histograms": num_cols[:6],
            "boxplots": num_cols[:6],
            "bar_charts": cat_cols[:4],
            "pie_charts": [c for c in cat_cols if df[c].nunique(dropna=True) <= 8][:3],
            "scatter_pairs": [[num_cols[i], num_cols[j]] for i in range(len(num_cols)) for j in range(i+1, len(num_cols))][:5],
            "timeseries": [{"date": date_cols[0], "value": num_cols[0]}] if date_cols and num_cols else [],
        },
    })


# --------------------------------------------------------------------------
# custom chart builder
# --------------------------------------------------------------------------
def _need_cols(df: pd.DataFrame, cols: list[str]) -> None:
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"Column(s) not found: {', '.join(missing)}")


def _need_numeric(df: pd.DataFrame, cols: list[str], label: str) -> None:
    bad = [c for c in cols if not pd.api.types.is_numeric_dtype(df[c]) or pd.api.types.is_bool_dtype(df[c])]
    if bad:
        raise ValueError(f"{label} must be numeric: {', '.join(bad)}")


def _looks_datetime(s: pd.Series) -> bool:
    if (pd.api.types.is_numeric_dtype(s) or pd.api.types.is_bool_dtype(s)
            or pd.api.types.is_datetime64_any_dtype(s)):
        return False
    sample = s.dropna().head(40)
    if len(sample) == 0:
        return False
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return bool(pd.to_datetime(sample, errors="coerce").notna().mean() > 0.9)


def _x_keys(df: pd.DataFrame, x: str) -> tuple[pd.Series, str]:
    """Turn the X column into groupable keys. Returns (keys, kind) with kind time|numeric|category."""
    s = df[x]
    if pd.api.types.is_datetime64_any_dtype(s) or _looks_datetime(s):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            dt = pd.to_datetime(s, errors="coerce")
        if dt.notna().any():
            span = (dt.max() - dt.min()).days
            if span <= 120:
                return dt.dt.floor("D"), "time"
            if span <= 900:
                return dt.dt.to_period("W").dt.start_time, "time"
            return dt.dt.to_period("M").dt.start_time, "time"
    if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
        s = s.replace([np.inf, -np.inf], np.nan)
        if s.nunique() > 30:                                  # bin continuous values
            nb = 40
            edges = np.linspace(float(s.min()), float(s.max()), nb + 1)
            mids = (edges[:-1] + edges[1:]) / 2
            idx = np.clip(np.digitize(s.to_numpy(dtype=float, na_value=np.nan), edges[1:-1]), 0, nb - 1)
            return pd.Series(np.where(s.notna(), mids[idx], np.nan), index=s.index), "numeric"
        return s, "numeric"
    return s.astype(object).where(s.notna(), "(missing)").astype(str), "category"


def _label(v, xkind: str) -> str:
    if xkind == "time":
        return pd.Timestamp(v).strftime("%Y-%m-%d")
    if xkind == "numeric":
        return f"{float(v):.6g}"
    return str(v)


def _top_categories(s: pd.Series, n: int) -> pd.Series:
    s = s.astype(object).where(s.notna(), "(missing)").astype(str)
    top = s.value_counts().head(n).index
    return s.where(s.isin(top), "Other")


def _check_agg(df: pd.DataFrame, ys: list[str], agg: str) -> None:
    if agg not in AGGS:
        raise ValueError(f"Unknown aggregation '{agg}'. Use one of: {', '.join(AGGS)}.")
    if ys and agg not in ("count", "nunique"):
        _need_numeric(df, ys, f"Value columns for '{agg}'")


def _histogram(df, ys, bins, normalize) -> dict:
    if not ys:
        raise ValueError("Pick at least one numeric column.")
    _need_numeric(df, ys, "Histogram columns")
    vals = {c: pd.to_numeric(df[c], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna() for c in ys}
    allv = pd.concat(list(vals.values()))
    if allv.empty:
        raise ValueError("No numeric values to plot.")
    bins = max(5, min(int(bins or 20), 80))
    lo, hi = float(allv.min()), float(allv.max())
    if lo == hi:
        hi = lo + 1
    edges = np.linspace(lo, hi, bins + 1)                      # shared edges so columns are comparable
    data = [{"_x": f"{edges[i]:.4g}–{edges[i+1]:.4g}", "_start": float(edges[i])} for i in range(bins)]
    stats = []
    for c, v in vals.items():
        counts, _ = np.histogram(v, bins=edges)
        for i in range(bins):
            data[i][c] = round(float(counts[i] / len(v) * 100), 2) if normalize and len(v) else int(counts[i])
        stats.append({"name": c, "n": int(len(v)), "mean": float(v.mean()), "median": float(v.median()),
                      "std": float(v.std()) if len(v) > 1 else 0.0,
                      "skew": float(v.skew()) if len(v) > 2 else 0.0})
    return {"series": ys, "data": data, "normalize": bool(normalize), "stats": stats,
            "y_label": "% of rows" if normalize else "Rows"}


def _grouped(df, kind, x, ys, color, agg, top_n) -> dict:
    """bar / line / area: group by X (optionally split by `color`), aggregate one or many value columns."""
    _check_agg(df, ys, agg)
    if color:
        ys = ys[:1]                                            # splitting by a category supports one value column
    key, xkind = _x_keys(df, x)
    work = pd.DataFrame({"_x": key})
    ycols = [f"_y{i}" for i in range(len(ys))]
    for yc, y in zip(ycols, ys):
        work[yc] = df[y]
    if color:
        work["_c"] = _top_categories(df[color], 6)
    work = work.dropna(subset=["_x"])
    if work.empty:
        raise ValueError("No rows to plot after removing missing values in the X column.")

    if not ys:
        if color:
            g = work.groupby(["_x", "_c"]).size().unstack("_c").fillna(0)
        else:
            g = work.groupby("_x").size().to_frame("Count of rows")
        value_label = "Rows"
    elif color:
        g = work.groupby(["_x", "_c"])[ycols[0]].agg(agg).unstack("_c")
        value_label = f"{agg} of {ys[0]}"
    else:
        g = work.groupby("_x")[ycols].agg(agg)
        g.columns = ys
        value_label = f"{agg} of {ys[0]}" if len(ys) == 1 else agg
    g.columns = [str(c) for c in g.columns]

    n_total, truncated = len(g), False
    if xkind == "category":
        order = g.fillna(0).abs().sum(axis=1).sort_values(ascending=False).index
        g = g.loc[order[:top_n]]
        truncated = n_total > top_n
    else:
        g = g.sort_index()
        if len(g) > 150:
            g, truncated = g.tail(150), True

    data = []
    for idx, row in g.iterrows():
        rec = {"_x": _label(idx, xkind)}
        for c in g.columns:
            rec[c] = None if pd.isna(row[c]) else round(float(row[c]), 4)
        data.append(rec)
    return {"x_label": x, "series": list(g.columns), "data": data, "agg": agg if ys else "count",
            "xkind": xkind, "truncated": truncated, "n_x_values": n_total, "y_label": value_label}


def _pie(df, x, ys, agg, top_n) -> dict:
    y = ys[:1]
    _check_agg(df, y, agg)
    key, xkind = _x_keys(df, x)
    work = pd.DataFrame({"_x": key})
    if y:
        work["_y"] = df[y[0]]
    work = work.dropna(subset=["_x"])
    s = work.groupby("_x")["_y"].agg(agg) if y else work.groupby("_x").size()
    s = s.dropna()
    if s.empty:
        raise ValueError("Nothing to plot.")
    if (s < 0).any():
        raise ValueError("Pie charts need non-negative values - use a bar chart for this column.")
    s = s.sort_values(ascending=False)
    data = [{"name": _label(i, xkind), "value": round(float(v), 4)} for i, v in s.head(top_n).items()]
    rest = s.iloc[top_n:]
    if len(rest) and (not y or agg in ("sum", "count")):
        data.append({"name": "Other", "value": round(float(rest.sum()), 4)})
    return {"x_label": x, "data": data, "total": round(float(s.sum()), 4), "agg": agg if y else "count"}


def _scatter(df, x, ys, color, max_points=800) -> dict:
    if not x or not ys:
        raise ValueError("Scatter plots need an X column and at least one Y column.")
    _need_numeric(df, [x, *ys], "Scatter columns")
    if color:
        ys = ys[:1]

    def make(sub: pd.DataFrame, ycol: str, name: str) -> dict | None:
        sub = sub[[x] if ycol == x else [x, ycol]].replace([np.inf, -np.inf], np.nan).dropna()
        if sub.empty:
            return None
        xs, yv = sub[x], (sub[x] if ycol == x else sub[ycol])
        r = None
        if len(sub) >= 3 and xs.nunique() > 1 and yv.nunique() > 1:
            r = float(np.corrcoef(xs, yv)[0, 1])
        pick = np.random.default_rng(42).choice(len(sub), size=max_points, replace=False) if len(sub) > max_points else np.arange(len(sub))
        return {"name": name, "n": int(len(sub)), "r": r,
                "points": [{"x": float(xs.iloc[i]), "y": float(yv.iloc[i])} for i in pick]}

    series = []
    if color:
        sub = df[[x, ys[0]]].copy()
        sub["_c"] = _top_categories(df[color], 6)
        for name, grp in sub.groupby("_c"):
            item = make(grp, ys[0], str(name))
            if item:
                series.append(item)
    else:
        for y in ys:
            item = make(df, y, y)
            if item:
                series.append(item)
    if not series:
        raise ValueError("No rows with values in both columns.")
    return {"x_label": x, "y_label": ", ".join(ys), "series": series}


def _box_stats(s: pd.Series, name: str) -> dict | None:
    s = pd.to_numeric(s, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if s.empty:
        return None
    q1, med, q3 = s.quantile([0.25, 0.5, 0.75]).tolist()
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    out = s[(s < lo) | (s > hi)]
    return {"name": str(name), "n": int(len(s)), "min": float(s.min()), "q1": q1, "median": med, "q3": q3,
            "max": float(s.max()), "mean": float(s.mean()),
            "whisker_low": float(s[s >= lo].min()), "whisker_high": float(s[s <= hi].max()),
            "n_outliers": int(len(out)), "outliers": out.head(30).tolist()}


def _box(df, ys, color) -> dict:
    if not ys:
        raise ValueError("Pick at least one numeric column.")
    _need_numeric(df, ys, "Box plot columns")
    groups = []
    if color:
        sub = df[[ys[0]]].copy()
        sub["_c"] = _top_categories(df[color], 8)
        for name, grp in sub.groupby("_c"):
            g = _box_stats(grp[ys[0]], name)
            if g:
                groups.append(g)
    else:
        for y in ys:
            g = _box_stats(df[y], y)
            if g:
                groups.append(g)
    if not groups:
        raise ValueError("No numeric values to plot.")
    return {"groups": groups, "y_label": ys[0] if color else ", ".join(ys)}


def _heatmap(df, ys) -> dict:
    if len(ys) < 2:
        raise ValueError("Pick at least two numeric columns for a correlation heatmap.")
    _need_numeric(df, ys, "Heatmap columns")
    ys = ys[:25]
    corr = df[ys].corr()
    matrix = [[None if pd.isna(corr.loc[a, b]) else round(float(corr.loc[a, b]), 3) for b in ys] for a in ys]
    return {"columns": ys, "matrix": matrix}


def _title(kind, x, ys, color, agg) -> str:
    ylist = ", ".join(ys)
    if kind == "histogram":
        return f"Distribution of {ylist}"
    if kind == "box":
        return f"Spread of {ylist}" + (f" by {color}" if color else "")
    if kind == "heatmap":
        return "Correlation heatmap"
    if kind == "scatter":
        return f"{ylist} vs {x}"
    if not ys:
        what = "Count of rows"
    elif agg == "count":
        what = f"Count of {ylist}"
    else:
        what = f"{agg.capitalize()} of {ylist}"
    return f"{what} by {x}" + (f", split by {color}" if color and kind != "pie" else "")


def custom_chart(df: pd.DataFrame, kind: str, x: str | None = None, y: list[str] | None = None,
                 color: str | None = None, agg: str = "sum", bins: int = 20, top_n: int = 12,
                 normalize: bool = False) -> dict:
    """Build any supported chart. Raises ValueError with a plain-English message on bad input."""
    kind = (kind or "").lower()
    if kind not in CHART_KINDS:
        raise ValueError(f"Unknown chart type '{kind}'. Use one of: {', '.join(CHART_KINDS)}.")
    ys = list(dict.fromkeys(y or []))
    x, color = (x or None), (color or None)
    _need_cols(df, ys + ([x] if x else []) + ([color] if color else []))
    top_n = max(3, min(int(top_n or 12), 50))
    agg = agg or "sum"

    if kind == "histogram":
        payload = _histogram(df, ys, bins, normalize)
    elif kind in ("bar", "line", "area"):
        if not x:
            raise ValueError("Pick an X column.")
        payload = _grouped(df, kind, x, ys, color, agg, top_n)
    elif kind == "pie":
        if not x:
            raise ValueError("Pick the column whose categories become slices.")
        payload = _pie(df, x, ys, agg, top_n)
    elif kind == "scatter":
        payload = _scatter(df, x, ys, color)
    elif kind == "box":
        payload = _box(df, ys, color)
    else:
        payload = _heatmap(df, ys)

    payload["kind"] = kind
    payload["title"] = _title(kind, x, ys, color, payload.get("agg", agg))
    return safe_json(payload)


def recommended_charts(df: pd.DataFrame) -> dict:
    """The auto-built gallery: distributions, categories, strongest relationships, a trend, correlations."""
    sug = auto_chart_suggestions(df)
    nums = sug["numeric_columns"]
    items: list[dict] = []

    def add(group: str, cid: str, spec: dict, note: str) -> None:
        try:
            payload = custom_chart(df, **spec)
        except Exception:  # noqa: BLE001 - one bad column must not hide the rest
            return
        items.append({"id": cid, "group": group, "spec": spec, "title": payload["title"],
                      "note": note, "payload": payload})

    s = sug["suggested"]
    for ts in s["timeseries"]:
        add("Trends", f"ts:{ts['date']}:{ts['value']}",
            {"kind": "line", "x": ts["date"], "y": [ts["value"]], "agg": "mean"}, "Average over time")
    for c in s["histograms"]:
        add("Distributions", f"hist:{c}", {"kind": "histogram", "y": [c]}, "How values are spread")
    for c in s["boxplots"][:4]:
        add("Distributions", f"box:{c}", {"kind": "box", "y": [c]}, "Median, quartiles, outliers")
    for c in s["bar_charts"]:
        add("Categories", f"bar:{c}", {"kind": "bar", "x": c}, "Rows per category")
    for c in s["pie_charts"][:2]:
        add("Categories", f"pie:{c}", {"kind": "pie", "x": c}, "Share of rows")

    pairs: list[tuple[str, str]] = []
    if len(nums) >= 2:                                        # strongest relationships first
        corr = df[nums[:15]].corr().abs()
        cols = list(corr.columns)
        scored = [(corr.loc[a, b], a, b) for i, a in enumerate(cols) for b in cols[i + 1:] if pd.notna(corr.loc[a, b])]
        pairs = [(a, b) for _, a, b in sorted(scored, reverse=True)[:4]]
    for a, b in pairs:
        add("Relationships", f"sc:{a}:{b}", {"kind": "scatter", "x": a, "y": [b]}, "Each dot is one row")
    if len(nums) >= 3:
        add("Relationships", "heatmap", {"kind": "heatmap", "y": nums[:10]}, "Which columns move together")
    return {"charts": items}
