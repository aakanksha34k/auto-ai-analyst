from __future__ import annotations

import io
import os
import re

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from app import guards
from app.api.llm_routes import router as llm_router
from app.api.schemas import (
    ApplyCleaningRequest, ChartRequest, CustomChartRequest, MLRequest,
    RecommendationsRequest, ReportRequest,
)
from app.insights.recommendations import generate_recommendations
from app.ml.engine import detect_problem_type, model_catalog, run_auto_ml
from app.preprocessing.cleaner import apply_actions
from app.profiling.profiler import run_full_profile
from app.reports.pdf_report import generate_pdf_report
from app.statistics.engine import correlation_analysis, descriptive_stats
from app.static_site import mount_frontend
from app.store import store
from app.visualization import charts as viz
from app.utils.serialize import safe_json

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "reports_output")
os.makedirs(REPORTS_DIR, exist_ok=True)

app = FastAPI(title="Autonomous Data Analyst API", version="1.1.0")

# Same-origin deployments (single container) need no CORS. For a split deployment
# (e.g. Vercel frontend + separate API host) set CORS_ORIGINS="https://your-app.vercel.app".
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,  # no cookies are used; "*" with credentials is invalid anyway
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def reject_oversized_uploads(request, call_next):
    """Stop huge uploads before they are parsed (when the client declares a size)."""
    if request.method == "POST" and request.url.path == "/api/datasets/upload":
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > guards.max_upload_bytes() + 1_048_576:
            from fastapi.responses import JSONResponse
            mb = guards.max_upload_bytes() // 1_048_576
            return JSONResponse({"detail": f"File is larger than the {mb} MB limit."}, status_code=413)
    return await call_next(request)


def _clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Repair column names damaged by a byte-order-mark (e.g. 'ï»¿Year' or 'Ã¯Â»Â¿Year' -> 'Year')."""
    def fix(c):
        if not isinstance(c, str):
            return c
        for _ in range(3):  # undo up to three rounds of UTF-8 text mis-read as latin-1
            try:
                fixed = c.encode("latin-1").decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                break
            if fixed == c:
                break
            c = fixed
        return c.replace("\ufeff", "").strip()
    df.columns = [fix(c) for c in df.columns]
    return df


def _read_upload(filename: str, content: bytes) -> pd.DataFrame:
    return _clean_columns(_read_upload_raw(filename, content))


def _read_upload_raw(filename: str, content: bytes) -> pd.DataFrame:
    lower = filename.lower()
    buf = io.BytesIO(content)
    try:
        if lower.endswith(".csv"):
            return pd.read_csv(buf)
        if lower.endswith((".xlsx", ".xls")):
            return pd.read_excel(buf)
        if lower.endswith(".json"):
            return pd.read_json(buf)
        if lower.endswith(".tsv"):
            return pd.read_csv(buf, sep="\t")
        # fallback: try CSV
        return pd.read_csv(buf)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")


app.include_router(llm_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    limit = guards.max_upload_bytes()
    content = await file.read(limit + 1)  # never load more than limit+1 bytes into memory
    if len(content) > limit:
        raise HTTPException(status_code=413, detail=f"File is larger than the {limit // 1_048_576} MB limit.")
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    df = _read_upload(file.filename, content)
    if df.empty or df.shape[1] == 0:
        raise HTTPException(status_code=400, detail="Dataset has no readable rows/columns.")

    session = store.create(file.filename, df)
    profile = run_full_profile(session.df)

    return {
        "dataset_id": session.id,
        "filename": session.filename,
        "preview": safe_json(session.df.head(10).to_dict(orient="records")),
        "profile": profile,
    }


def _get_session(dataset_id: str):
    session = store.get(dataset_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Dataset not found. Upload it again.")
    return session


@app.get("/api/datasets/{dataset_id}/profile")
def get_profile(dataset_id: str):
    session = _get_session(dataset_id)
    return run_full_profile(session.df)


@app.get("/api/datasets/{dataset_id}/preview")
def get_preview(dataset_id: str, rows: int = 25):
    session = _get_session(dataset_id)
    return {
        "columns": list(session.df.columns),
        "rows": safe_json(session.df.head(rows).to_dict(orient="records")),
        "total_rows": len(session.df),
    }


# ---------------------------------------------------------------- full dataset viewer
@app.get("/api/datasets/{dataset_id}/data")
def get_data(dataset_id: str, offset: int = 0, limit: int = 50, search: str | None = None,
             sort_by: str | None = None, descending: bool = False):
    """Paged, searchable, sortable view of the CURRENT (possibly cleaned) dataset."""
    df = _get_session(dataset_id).df
    if sort_by and sort_by not in df.columns:
        raise HTTPException(400, f"Cannot sort by '{sort_by}': column not found.")
    limit = max(1, min(limit, 500))
    offset = max(0, offset)

    pos = np.arange(len(df))
    term = (search or "").strip()
    if term:
        hit = np.zeros(len(df), dtype=bool)
        for col in df.columns:
            hit |= df[col].astype(str).str.contains(term, case=False, na=False, regex=False).to_numpy()
        pos = pos[hit]
    sub = df.iloc[pos].copy()
    sub["__row__"] = pos + 1                                  # position in the full dataset (1-based)
    if sort_by:
        sub = sub.sort_values(sort_by, ascending=not descending, na_position="last", kind="mergesort")
    page = sub.iloc[offset: offset + limit]
    rows = page.drop(columns="__row__")
    return {
        "columns": list(df.columns),
        "rows": safe_json(rows.to_dict(orient="records")),
        "row_numbers": [int(n) for n in page["__row__"]],
        "total_rows": len(df),
        "filtered_rows": len(sub),
        "offset": offset,
        "limit": limit,
    }


@app.get("/api/datasets/{dataset_id}/data/download")
def download_data(dataset_id: str):
    session = _get_session(dataset_id)
    stem = re.sub(r"[^\w\-]+", "_", session.filename.rsplit(".", 1)[0]) or "dataset"
    return Response(
        content=session.df.to_csv(index=False),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{stem}_current.csv"'},
    )


@app.post("/api/datasets/{dataset_id}/clean")
def apply_cleaning(dataset_id: str, req: ApplyCleaningRequest):
    session = _get_session(dataset_id)
    new_df, log = apply_actions(session.df, [a.model_dump() for a in req.actions])
    session.df = new_df
    session.cleaning_log.extend(log)
    return {
        "log": log,
        "profile": run_full_profile(session.df),
        "row_count": len(session.df),
    }


@app.post("/api/datasets/{dataset_id}/reset")
def reset_cleaning(dataset_id: str):
    session = _get_session(dataset_id)
    session.df = session.raw_df.copy()
    session.cleaning_log = []
    return {"status": "reset", "profile": run_full_profile(session.df)}


@app.get("/api/datasets/{dataset_id}/stats")
def get_stats(dataset_id: str):
    session = _get_session(dataset_id)
    return {"descriptive": descriptive_stats(session.df)}


@app.get("/api/datasets/{dataset_id}/correlation")
def get_correlation(dataset_id: str):
    session = _get_session(dataset_id)
    return correlation_analysis(session.df)


# ---------------------------------------------------------------- charts
@app.get("/api/datasets/{dataset_id}/chart-suggestions")
def get_chart_suggestions(dataset_id: str):
    session = _get_session(dataset_id)
    return viz.auto_chart_suggestions(session.df)


@app.get("/api/datasets/{dataset_id}/charts/recommended")
def chart_recommended(dataset_id: str):
    """Every recommended chart, fully computed, in one round trip."""
    session = _get_session(dataset_id)
    return viz.recommended_charts(session.df)


@app.post("/api/datasets/{dataset_id}/charts/custom")
def chart_custom(dataset_id: str, req: CustomChartRequest):
    session = _get_session(dataset_id)
    try:
        return viz.custom_chart(session.df, **req.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/datasets/{dataset_id}/charts/histogram")
def chart_histogram(dataset_id: str, req: ChartRequest):
    session = _get_session(dataset_id)
    if not req.column:
        raise HTTPException(400, "column is required")
    return viz.histogram_data(session.df, req.column, bins=req.bins or 20)


@app.post("/api/datasets/{dataset_id}/charts/boxplot")
def chart_boxplot(dataset_id: str, req: ChartRequest):
    session = _get_session(dataset_id)
    if not req.column:
        raise HTTPException(400, "column is required")
    return viz.boxplot_data(session.df, req.column)


@app.post("/api/datasets/{dataset_id}/charts/bar")
def chart_bar(dataset_id: str, req: ChartRequest):
    session = _get_session(dataset_id)
    if not req.column:
        raise HTTPException(400, "column is required")
    return viz.bar_chart_data(session.df, req.column)


@app.post("/api/datasets/{dataset_id}/charts/pie")
def chart_pie(dataset_id: str, req: ChartRequest):
    session = _get_session(dataset_id)
    if not req.column:
        raise HTTPException(400, "column is required")
    return viz.pie_chart_data(session.df, req.column)


@app.post("/api/datasets/{dataset_id}/charts/scatter")
def chart_scatter(dataset_id: str, req: ChartRequest):
    session = _get_session(dataset_id)
    if not req.x or not req.y:
        raise HTTPException(400, "x and y are required")
    return viz.scatter_data(session.df, req.x, req.y)


@app.post("/api/datasets/{dataset_id}/charts/timeseries")
def chart_timeseries(dataset_id: str, req: ChartRequest):
    session = _get_session(dataset_id)
    if not req.date_column or not req.value_column:
        raise HTTPException(400, "date_column and value_column are required")
    return viz.timeseries_data(session.df, req.date_column, req.value_column)


# ---------------------------------------------------------------- machine learning
@app.get("/api/datasets/{dataset_id}/ml/models")
def ml_models(dataset_id: str, target: str | None = None, task: str | None = None):
    """Which task a target implies, and which models can be trained for it."""
    df = _get_session(dataset_id).df
    if target and target not in df.columns:
        raise HTTPException(400, f"Target column '{target}' not found.")
    ptype = detect_problem_type(df, target or None, task)
    return {"problem_type": ptype, "models": model_catalog(ptype)}


@app.post("/api/datasets/{dataset_id}/ml/run")
def run_ml(dataset_id: str, req: MLRequest):
    session = _get_session(dataset_id)
    cols = set(session.df.columns)
    if req.target and req.target not in cols:
        raise HTTPException(400, f"Target column '{req.target}' not found.")
    unknown = [c for c in (req.features or []) if c not in cols]
    if unknown:
        raise HTTPException(400, f"Feature column(s) not found: {', '.join(unknown)}")
    kwargs = req.to_kwargs()
    kwargs["target"] = req.target or None
    return run_auto_ml(session.df, **kwargs)


def _recs(session, ml_result):
    try:
        return generate_recommendations(session.df, ml_result)
    except Exception:  # a malformed client-supplied result must not break the page
        return generate_recommendations(session.df, None)


@app.get("/api/datasets/{dataset_id}/recommendations")
def get_recommendations(dataset_id: str, target: str | None = None):
    session = _get_session(dataset_id)
    ml_result = None
    if target and target in session.df.columns:
        try:
            ml_result = run_auto_ml(session.df, target)
        except Exception:
            ml_result = None
    return {"recommendations": _recs(session, ml_result)}


@app.post("/api/datasets/{dataset_id}/recommendations")
def post_recommendations(dataset_id: str, req: RecommendationsRequest):
    """Recommendations built from the model run the user already did (no retraining)."""
    session = _get_session(dataset_id)
    return {"recommendations": _recs(session, req.ml_result)}


@app.post("/api/datasets/{dataset_id}/report")
def create_report(dataset_id: str, req: ReportRequest):
    session = _get_session(dataset_id)

    ml_result = None
    if req.include_ml:
        cfg = (req.ml or MLRequest()).to_kwargs()
        try:
            ml_result = run_auto_ml(session.df, **cfg)
        except Exception:
            ml_result = None

    recommendations = _recs(session, ml_result)

    out_path = os.path.join(REPORTS_DIR, f"report_{dataset_id}.pdf")
    generate_pdf_report(
        df=session.df,
        filename=session.filename,
        output_path=out_path,
        ml_result=ml_result,
        recommendations=recommendations,
    )
    return {"report_path": f"/api/datasets/{dataset_id}/report/download"}


@app.get("/api/datasets/{dataset_id}/report/download")
def download_report(dataset_id: str):
    out_path = os.path.join(REPORTS_DIR, f"report_{dataset_id}.pdf")
    if not os.path.exists(out_path):
        raise HTTPException(404, "Report not generated yet. POST to /report first.")
    session = store.get(dataset_id)
    name = f"{(session.filename if session else 'dataset').rsplit('.', 1)[0]}_report.pdf"
    return FileResponse(out_path, media_type="application/pdf", filename=name)


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: str):
    store.delete(dataset_id)
    return {"status": "deleted"}


# Serve the built frontend (single-container deployments). Must stay LAST: it registers a catch-all.
if os.getenv("STATIC_DIR"):
    mount_frontend(app, os.environ["STATIC_DIR"])
