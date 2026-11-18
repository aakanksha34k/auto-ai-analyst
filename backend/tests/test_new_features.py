"""Tests for the custom chart builder, dataset viewer, manual ML controls and report config."""
import numpy as np, pandas as pd, pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def df():
    rng = np.random.default_rng(7)
    dates = pd.date_range("2024-01-01", "2024-09-27", freq="D")
    rows = []
    for d in dates:
        for region in ["North","South","East","West"]:
            ad = rng.uniform(100,1000); rev = 500+2*ad+rng.normal(0,60)
            rows.append({"Date": d, "Region": region, "Channel": rng.choice(["Web","Store"]), "AdSpend": round(ad,2), "Revenue": round(rev,2)})
    return pd.DataFrame(rows)

@pytest.fixture()
def api(df):
    from app.main import app
    from app.store import store
    s = store.create("sales.csv", df)
    yield TestClient(app), s
    store.delete(s.id)

def custom(c, s, **spec):
    return c.post(f"/api/datasets/{s.id}/charts/custom", json=spec)

def test_every_chart_kind(api):
    c, s = api
    specs = [
        dict(kind="histogram", y=["Revenue","AdSpend"], normalize=True),
        dict(kind="bar", x="Region"),
        dict(kind="bar", x="Region", y=["Revenue","AdSpend"], agg="mean"),
        dict(kind="bar", x="Region", y=["Revenue"], color="Channel", agg="sum"),
        dict(kind="line", x="Date", y=["Revenue"], agg="sum"),
        dict(kind="area", x="Date", y=["Revenue","AdSpend"], agg="mean"),
        dict(kind="line", x="AdSpend", y=["Revenue"], agg="mean"),
        dict(kind="pie", x="Region", y=["Revenue"], agg="sum"),
        dict(kind="scatter", x="AdSpend", y=["Revenue"]),
        dict(kind="scatter", x="AdSpend", y=["Revenue"], color="Region"),
        dict(kind="box", y=["Revenue","AdSpend"]),
        dict(kind="box", y=["Revenue"], color="Region"),
        dict(kind="heatmap", y=["Revenue","AdSpend"]),
    ]
    for sp in specs:
        r = custom(c, s, **sp)
        assert r.status_code == 200, (sp, r.text)
        body = r.json(); assert body["kind"] == sp["kind"] and body["title"]
    # checks
    b = custom(c, s, kind="bar", x="Region", y=["Revenue"], agg="sum").json()
    assert sum(d["Revenue"] for d in b["data"]) == pytest.approx(api[1].df.Revenue.sum(), rel=1e-3)
    t = custom(c, s, kind="line", x="Date", y=["Revenue"]).json()
    assert t["xkind"] == "time" and t["data"][0]["_x"].startswith("2024-")
    sc = custom(c, s, kind="scatter", x="AdSpend", y=["Revenue"]).json()
    assert sc["series"][0]["r"] > 0.9

def test_chart_errors_are_400(api):
    c, s = api
    assert custom(c, s, kind="bar", x="Nope").status_code == 400
    assert custom(c, s, kind="histogram", y=["Region"]).status_code == 400
    assert custom(c, s, kind="donut", x="Region").status_code == 400
    assert custom(c, s, kind="bar", y=["Revenue"]).status_code == 400
    assert custom(c, s, kind="heatmap", y=["Revenue"]).status_code == 400

def test_recommended_gallery(api):
    c, s = api
    body = c.get(f"/api/datasets/{s.id}/charts/recommended").json()
    kinds = {x["payload"]["kind"] for x in body["charts"]}
    assert {"line","histogram","box","bar","scatter"} <= kinds
    assert all(x["spec"] and x["group"] for x in body["charts"])

def test_data_viewer(api):
    c, s = api
    r = c.get(f"/api/datasets/{s.id}/data", params={"limit": 5}).json()
    assert len(r["rows"]) == 5 and r["row_numbers"] == [1,2,3,4,5] and r["total_rows"] == len(s.df)
    r = c.get(f"/api/datasets/{s.id}/data", params={"search": "south", "limit": 3}).json()
    assert r["filtered_rows"] == (s.df.Region == "South").sum() and all(x["Region"] == "South" for x in r["rows"])
    r = c.get(f"/api/datasets/{s.id}/data", params={"sort_by": "Revenue", "descending": True, "limit": 2}).json()
    assert r["rows"][0]["Revenue"] == s.df.Revenue.max()
    assert c.get(f"/api/datasets/{s.id}/data", params={"sort_by": "zz"}).status_code == 400
    d = c.get(f"/api/datasets/{s.id}/data/download")
    assert d.headers["content-type"].startswith("text/csv") and d.text.splitlines()[0].startswith("Date,Region")

def test_ml_models_endpoint(api):
    c, s = api
    r = c.get(f"/api/datasets/{s.id}/ml/models", params={"target": "Revenue"}).json()
    assert r["problem_type"] == "regression" and "gradient_boosting" in {m["key"] for m in r["models"]}
    assert c.get(f"/api/datasets/{s.id}/ml/models", params={"target": "Region"}).json()["problem_type"] == "classification"
    assert c.get(f"/api/datasets/{s.id}/ml/models").json()["problem_type"] == "clustering"
    assert c.get(f"/api/datasets/{s.id}/ml/models", params={"target": "Revenue", "task": "classification"}).json()["problem_type"] == "classification"

def run(c, s, **cfg): return c.post(f"/api/datasets/{s.id}/ml/run", json=cfg).json()

def test_ml_manual_model_and_columns(api):
    c, s = api
    r = run(c, s, target="Revenue", model="ridge", features=["AdSpend","Region"])
    assert r["best_model"] == "Ridge Regression" and r["features_used"] == ["Region","AdSpend"] or set(r["features_used"]) == {"AdSpend","Region"}
    assert len(r["models_compared"]) == 1 and r["feature_importance"][0]["feature"] == "AdSpend" and len(r["predictions"]) > 10
    auto = run(c, s, target="Revenue")
    assert len(auto["models_compared"]) == 2 and auto["best_r2"] > 0.8
    assert "Date" in auto["features_used"] or "Date" in auto["features_dropped"]
    allm = run(c, s, target="Revenue", model="all", features=["AdSpend"])
    assert len(allm["models_compared"]) == 8 and not allm["failed_models"]

def test_ml_classification_and_clustering(api):
    c, s = api
    r = run(c, s, target="Channel", model="all", features=["AdSpend","Revenue","Region"])
    assert r["problem_type"] == "classification" and len(r["models_compared"]) == 7 and len(r["confusion_matrix"]) == 2 and r["roc_auc"] is not None
    k = run(c, s, features=["AdSpend","Revenue"], model="all", n_clusters=3)
    assert k["n_clusters"] == 3 and len(k["models_compared"]) == 3 and k["pca_points"] and k["cluster_summary"][0]["highlights"]
    k2 = run(c, s, features=["AdSpend","Revenue"])
    assert k2["k_search"]

def test_ml_errors_are_readable(api):
    c, s = api
    assert "Unknown model" in run(c, s, target="Revenue", model="xgboost")["error"]
    assert "No usable" in run(c, s, target="Revenue", features=["Date"] if False else ["Revenue"])["error"]
    assert "too many classes" in run(c, s, target="AdSpend", task="classification")["error"]
    assert c.post(f"/api/datasets/{s.id}/ml/run", json={"target": "Nope"}).status_code == 400
    assert c.post(f"/api/datasets/{s.id}/ml/run", json={"features": ["Nope"]}).status_code == 400

def test_recs_and_report(api):
    c, s = api
    res = run(c, s, target="Revenue", model="random_forest")
    recs = c.post(f"/api/datasets/{s.id}/recommendations", json={"ml_result": res}).json()
    assert isinstance(recs["recommendations"], list) and recs["recommendations"]
    assert c.post(f"/api/datasets/{s.id}/recommendations", json={}).status_code == 200
    r = c.post(f"/api/datasets/{s.id}/report", json={"include_ml": True, "ml": {"target": "Revenue", "model": "ridge"}})
    assert r.status_code == 200 and c.get(f"/api/datasets/{s.id}/report/download").content.startswith(b"%PDF")
    assert c.post(f"/api/datasets/{s.id}/report", json={"include_ml": False}).status_code == 200
