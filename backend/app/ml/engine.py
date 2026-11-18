"""
Automatic ML engine with manual controls.

  - No target             -> clustering (K-Means / Agglomerative / Gaussian Mixture)
  - Numeric target        -> regression
  - Categorical target    -> classification
  - `task` can force regression/classification when auto-detection guesses wrong
  - `features` limits which columns are used (None = every usable column)
  - `model`: None/"auto" = the original quick comparison (2 models), "all" = compare
    the whole catalog, or a catalog key to train exactly one model

Scikit-learn only (no XGBoost) to keep the install light.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import (
    GradientBoostingClassifier, GradientBoostingRegressor,
    RandomForestClassifier, RandomForestRegressor,
)
from sklearn.inspection import permutation_importance
from sklearn.linear_model import Lasso, LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, mean_absolute_error,
    mean_squared_error, precision_score, r2_score, recall_score,
    roc_auc_score, silhouette_score,
)
from sklearn.mixture import GaussianMixture
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from app.utils.serialize import safe_json

MAX_CLASSES = 50
HEAVY_SAMPLE = 8000       # SVMs are O(n^2): train them on at most this many rows
AGGLO_SAMPLE = 4000       # hierarchical clustering is O(n^2) in memory


def _scaled(est):
    return make_pipeline(StandardScaler(), est)


# key -> (display name, one-line description, factory(random_state))
REGRESSION_MODELS = {
    "linear_regression": ("Linear Regression", "Straight-line fit. Fast and easy to interpret.",
                          lambda rs: _scaled(LinearRegression())),
    "ridge": ("Ridge Regression", "Linear fit that shrinks coefficients; steadier when columns overlap.",
              lambda rs: _scaled(Ridge(alpha=1.0))),
    "lasso": ("Lasso Regression", "Linear fit that can zero out weak columns.",
              lambda rs: _scaled(Lasso(alpha=0.01, max_iter=10000))),
    "decision_tree": ("Decision Tree", "Learns if/else rules. Easy to explain, can overfit.",
                      lambda rs: DecisionTreeRegressor(max_depth=8, random_state=rs)),
    "random_forest": ("Random Forest Regressor", "Many trees averaged. Robust, handles curves and interactions.",
                      lambda rs: RandomForestRegressor(n_estimators=200, random_state=rs, n_jobs=-1)),
    "gradient_boosting": ("Gradient Boosting", "Trees that fix each other's mistakes. Often the most accurate.",
                          lambda rs: GradientBoostingRegressor(random_state=rs)),
    "knn": ("K-Nearest Neighbors", "Predicts from the 5 most similar rows.",
            lambda rs: _scaled(KNeighborsRegressor(n_neighbors=5))),
    "svr": ("Support Vector Regressor", "Smooth non-linear fit. Slower on big data.",
            lambda rs: _scaled(SVR())),
}

CLASSIFICATION_MODELS = {
    "logistic_regression": ("Logistic Regression", "Linear classifier. Fast, interpretable baseline.",
                            lambda rs: _scaled(LogisticRegression(max_iter=1000))),
    "decision_tree": ("Decision Tree", "Learns if/else rules. Easy to explain, can overfit.",
                      lambda rs: DecisionTreeClassifier(max_depth=8, random_state=rs)),
    "random_forest": ("Random Forest", "Many trees voting. Robust default.",
                      lambda rs: RandomForestClassifier(n_estimators=200, random_state=rs, n_jobs=-1)),
    "gradient_boosting": ("Gradient Boosting", "Trees that fix each other's mistakes. Often very accurate.",
                          lambda rs: GradientBoostingClassifier(random_state=rs)),
    "knn": ("K-Nearest Neighbors", "Votes among the 5 most similar rows.",
            lambda rs: _scaled(KNeighborsClassifier(n_neighbors=5))),
    "naive_bayes": ("Gaussian Naive Bayes", "Very fast probabilistic classifier.",
                    lambda rs: GaussianNB()),
    "svc": ("Support Vector Classifier", "Finds a wide margin between classes. Slower on big data.",
            lambda rs: _scaled(SVC())),
}

CLUSTERING_MODELS = {
    "kmeans": ("K-Means", "Groups rows around k centres. Fast default.", None),
    "agglomerative": ("Agglomerative", "Builds clusters bottom-up. Good for nested groups.", None),
    "gmm": ("Gaussian Mixture", "Soft, elliptical clusters.", None),
}

_CATALOGS = {"regression": REGRESSION_MODELS, "classification": CLASSIFICATION_MODELS,
             "clustering": CLUSTERING_MODELS}
DEFAULTS = {"regression": ["linear_regression", "random_forest"],
            "classification": ["logistic_regression", "random_forest"],
            "clustering": ["kmeans"]}
HEAVY = {"svr", "svc"}


def model_catalog(problem_type: str) -> list[dict]:
    return [{"key": k, "name": v[0], "description": v[1], "in_auto": k in DEFAULTS[problem_type]}
            for k, v in _CATALOGS.get(problem_type, {}).items()]


def _select_keys(problem_type: str, model: str | None) -> list[str]:
    catalog = _CATALOGS[problem_type]
    if model in (None, "", "auto"):
        return list(DEFAULTS[problem_type])
    if model == "all":
        return list(catalog)
    if model not in catalog:
        raise ValueError(f"Unknown model '{model}' for {problem_type}. Choose from: {', '.join(catalog)}.")
    return [model]


# --------------------------------------------------------------------------
# features
# --------------------------------------------------------------------------
def _prepare_features(df: pd.DataFrame, target: str | None,
                      features: list[str] | None = None) -> tuple[pd.DataFrame, list[str], list[str]]:
    """Encode columns, drop unusable ones. Returns (X, used_columns, dropped_columns)."""
    cols = [c for c in df.columns if c != target]
    if features:
        wanted = set(features)
        cols = [c for c in cols if c in wanted]
    X = pd.DataFrame(index=df.index)
    used, dropped = [], []

    for col in cols:
        s = df[col]
        if pd.api.types.is_bool_dtype(s):
            X[col] = s.fillna(False).astype(int)
            used.append(col)
        elif pd.api.types.is_numeric_dtype(s):
            s = s.replace([np.inf, -np.inf], np.nan)
            if s.isna().all():
                dropped.append(col)
                continue
            X[col] = s.fillna(s.median())
            used.append(col)
        elif pd.api.types.is_datetime64_any_dtype(s):
            days = (s - s.min()).dt.days          # dates become "days since the earliest row"
            if days.isna().all():
                dropped.append(col)
                continue
            X[col] = days.fillna(days.median())
            used.append(col)
        else:
            nunique = s.nunique(dropna=True)
            if nunique == 0 or nunique > 50:
                dropped.append(col)               # free text / IDs make poor features
                continue
            X[col] = LabelEncoder().fit_transform(s.fillna("__missing__").astype(str))
            used.append(col)
    return X, used, dropped


def detect_problem_type(df: pd.DataFrame, target: str | None, task: str | None = None) -> str:
    if target is None:
        return "clustering"
    if task in ("regression", "classification"):
        return task
    s = df[target].dropna()
    if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s) and s.nunique() > 15:
        return "regression"
    return "classification"


def _importance(model, used_cols, X_test, y_test, scoring) -> list[dict]:
    """Native importances when the model has them, permutation importance otherwise. Sums to 1."""
    est = model[-1] if hasattr(model, "steps") else model
    vals = None
    if hasattr(est, "feature_importances_"):
        vals = np.asarray(est.feature_importances_, dtype=float)
    elif hasattr(est, "coef_"):
        vals = np.abs(np.atleast_2d(est.coef_)).mean(axis=0)   # inputs are standardised, so comparable
    if vals is None or len(vals) != len(used_cols):
        try:
            sub = X_test.sample(min(len(X_test), 400), random_state=42)
            pi = permutation_importance(model, sub, y_test.loc[sub.index], n_repeats=3,
                                        random_state=42, scoring=scoring)
            vals = np.clip(pi.importances_mean, 0, None)
        except Exception:  # noqa: BLE001 - importance is a nicety, never fatal
            return []
    total = float(np.sum(vals)) or 1.0
    out = [{"feature": f, "importance": round(float(v) / total, 4)} for f, v in zip(used_cols, vals)]
    return sorted(out, key=lambda d: d["importance"], reverse=True)[:15]


def _maybe_sample(key, X_train, y_train, rs, name, notes):
    if key in HEAVY and len(X_train) > HEAVY_SAMPLE:
        idx = X_train.sample(HEAVY_SAMPLE, random_state=rs).index
        notes.append(f"{name} was trained on a random {HEAVY_SAMPLE:,}-row sample to keep it fast.")
        return X_train.loc[idx], y_train.loc[idx]
    return X_train, y_train


def _config(target, used, keys, test_size, extra=None) -> dict:
    cfg = {"target": target, "features": used, "model_keys": keys, "test_size": test_size}
    cfg.update(extra or {})
    return cfg


# --------------------------------------------------------------------------
# regression
# --------------------------------------------------------------------------
def run_regression(df, target, features=None, model=None, test_size=0.2, random_state=42) -> dict:
    y = pd.to_numeric(df[target], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if y.nunique() < 2:
        raise ValueError(f"'{target}' needs at least two different numeric values to be predicted.")
    X_full, used, dropped = _prepare_features(df, target, features)
    if not used:
        raise ValueError("No usable feature columns. Select at least one numeric or low-cardinality column.")
    if len(y) < 20:
        raise ValueError("Need at least 20 rows with a value in the target column.")
    X = X_full.loc[y.index]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)

    keys = _select_keys("regression", model)
    results, fitted, notes, failed = [], {}, [], []
    for key in keys:
        name, _, factory = REGRESSION_MODELS[key]
        Xt, yt = _maybe_sample(key, X_train, y_train, random_state, name, notes)
        try:
            est = factory(random_state)
            est.fit(Xt, yt)
            preds = est.predict(X_test)
        except Exception as e:  # noqa: BLE001
            failed.append({"model": name, "error": str(e)[:200]})
            continue
        r2 = float(r2_score(y_test, preds))
        results.append({"model": name, "r2_score": round(r2, 4),
                        "mae": round(float(mean_absolute_error(y_test, preds)), 4),
                        "rmse": round(float(np.sqrt(mean_squared_error(y_test, preds))), 4)})
        fitted[key] = (name, est, preds, r2)
    if not results:
        raise ValueError("Every selected model failed: " + "; ".join(f"{f['model']}: {f['error']}" for f in failed))

    best_key = max(fitted, key=lambda k: fitted[k][3])
    best_name, best_model, best_preds, best_r2 = fitted[best_key]
    importance = _importance(best_model, used, X_test, y_test, "r2")

    rng = np.random.default_rng(random_state)
    take = rng.choice(len(y_test), size=min(len(y_test), 300), replace=False)
    points = [{"actual": float(y_test.iloc[i]), "predicted": float(best_preds[i])} for i in take]

    quality = "excellent" if best_r2 > 0.8 else "good" if best_r2 > 0.5 else "moderate" if best_r2 > 0.2 else "weak"
    article = "an" if quality == "excellent" else "a"
    return safe_json({
        "problem_type": "regression", "target": target,
        "features_used": used, "features_dropped": dropped,
        "models_compared": results, "best_model": best_name, "best_model_key": best_key,
        "best_r2": round(best_r2, 4),
        "feature_importance": importance, "predictions": points,
        "n_train": len(y_train), "n_test": len(y_test), "notes": notes, "failed_models": failed,
        "config": _config(target, used, keys, test_size),
        "summary": f"The {best_name} model explains {best_r2*100:.1f}% of the variance in {target} "
                   f"(R² = {best_r2:.3f}), {article} {quality} fit.",
    })


# --------------------------------------------------------------------------
# classification
# --------------------------------------------------------------------------
def run_classification(df, target, features=None, model=None, test_size=0.2, random_state=42) -> dict:
    y_raw = df[target].dropna()
    if y_raw.nunique() < 2:
        raise ValueError(f"'{target}' has only one distinct value, so there is nothing to classify.")
    if y_raw.nunique() > MAX_CLASSES:
        raise ValueError(f"'{target}' has {y_raw.nunique()} distinct values - too many classes. "
                         "Pick a column with fewer categories, or switch the task to regression.")
    if len(y_raw) < 20:
        raise ValueError("Need at least 20 rows with a value in the target column.")
    encoder = LabelEncoder()
    y = pd.Series(encoder.fit_transform(y_raw.astype(str)), index=y_raw.index)
    class_names = [str(c) for c in encoder.classes_]

    X_full, used, dropped = _prepare_features(df, target, features)
    if not used:
        raise ValueError("No usable feature columns. Select at least one numeric or low-cardinality column.")
    X = X_full.loc[y.index]
    try:
        stratify = y if y.value_counts().min() >= 2 else None
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size,
                                                            random_state=random_state, stratify=stratify)
    except ValueError:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)

    keys = _select_keys("classification", model)
    avg = "binary" if len(class_names) == 2 else "weighted"
    results, fitted, notes, failed = [], {}, [], []
    for key in keys:
        name, _, factory = CLASSIFICATION_MODELS[key]
        Xt, yt = _maybe_sample(key, X_train, y_train, random_state, name, notes)
        try:
            est = factory(random_state)
            est.fit(Xt, yt)
            preds = est.predict(X_test)
        except Exception as e:  # noqa: BLE001
            failed.append({"model": name, "error": str(e)[:200]})
            continue
        acc = float(accuracy_score(y_test, preds))
        results.append({
            "model": name, "accuracy": round(acc, 4),
            "f1_score": round(float(f1_score(y_test, preds, average=avg, zero_division=0)), 4),
            "precision": round(float(precision_score(y_test, preds, average=avg, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, preds, average=avg, zero_division=0)), 4),
        })
        fitted[key] = (name, est, preds, acc)
    if not results:
        raise ValueError("Every selected model failed: " + "; ".join(f"{f['model']}: {f['error']}" for f in failed))

    best_key = max(fitted, key=lambda k: fitted[k][3])
    best_name, best_model, best_preds, best_acc = fitted[best_key]
    cm = confusion_matrix(y_test, best_preds, labels=list(range(len(class_names)))).tolist()
    importance = _importance(best_model, used, X_test, y_test, "accuracy")

    auc = None
    if len(class_names) == 2 and hasattr(best_model, "predict_proba"):
        try:
            auc = round(float(roc_auc_score(y_test, best_model.predict_proba(X_test)[:, 1])), 4)
        except Exception:  # noqa: BLE001
            auc = None

    quality = "excellent" if best_acc > 0.9 else "good" if best_acc > 0.75 else "moderate" if best_acc > 0.6 else "weak"
    return safe_json({
        "problem_type": "classification", "target": target, "class_names": class_names,
        "features_used": used, "features_dropped": dropped,
        "models_compared": results, "best_model": best_name, "best_model_key": best_key,
        "best_accuracy": round(best_acc, 4), "roc_auc": auc,
        "confusion_matrix": cm, "feature_importance": importance,
        "n_train": len(y_train), "n_test": len(y_test), "notes": notes, "failed_models": failed,
        "config": _config(target, used, keys, test_size),
        "summary": f"The {best_name} model correctly classifies {best_acc*100:.1f}% of cases, a {quality} result.",
    })


# --------------------------------------------------------------------------
# clustering
# --------------------------------------------------------------------------
def _cluster_labels(key, Xs, k, rs):
    if key == "kmeans":
        return KMeans(n_clusters=k, random_state=rs, n_init=10).fit_predict(Xs)
    if key == "agglomerative":
        return AgglomerativeClustering(n_clusters=k).fit_predict(Xs)
    return GaussianMixture(n_components=k, random_state=rs).fit_predict(Xs)


def _silhouette(Xs, labels, rs) -> float:
    if len(set(labels)) < 2:
        return -1.0
    try:
        return float(silhouette_score(Xs, labels, sample_size=min(len(Xs), 5000), random_state=rs))
    except ValueError:
        return -1.0


def run_clustering(df, n_clusters=None, features=None, model=None, random_state=42) -> dict:
    X, used, dropped = _prepare_features(df, None, features)
    if not used:
        raise ValueError("No usable columns to cluster on. Select at least one numeric or low-cardinality column.")
    X = X.dropna()
    if len(X) < 10:
        raise ValueError("Not enough complete rows to cluster (need at least 10).")

    keys = _select_keys("clustering", model)
    notes: list[str] = []
    if "agglomerative" in keys and len(X) > AGGLO_SAMPLE:
        X = X.sample(AGGLO_SAMPLE, random_state=random_state)
        notes.append(f"Clustering used a random {AGGLO_SAMPLE:,}-row sample (hierarchical clustering is memory-hungry).")
    Xs = StandardScaler().fit_transform(X)

    k_search: list[dict] = []
    if n_clusters is None:
        search_key = keys[0] if len(keys) == 1 else "kmeans"
        best_k, best_score = 2, -2.0
        for k in range(2, min(7, len(X))):
            score = _silhouette(Xs, _cluster_labels(search_key, Xs, k, random_state), random_state)
            k_search.append({"k": k, "silhouette_score": round(score, 4)})
            if score > best_score:
                best_k, best_score = k, score
        n_clusters = best_k
    else:
        n_clusters = int(max(2, min(int(n_clusters), 12, len(X) - 1)))

    results, fitted, failed = [], {}, []
    for key in keys:
        name = CLUSTERING_MODELS[key][0]
        try:
            labels = _cluster_labels(key, Xs, n_clusters, random_state)
        except Exception as e:  # noqa: BLE001
            failed.append({"model": name, "error": str(e)[:200]})
            continue
        sil = _silhouette(Xs, labels, random_state)
        results.append({"model": name, "silhouette_score": round(sil, 4), "n_clusters": int(len(set(labels)))})
        fitted[key] = (name, labels, sil)
    if not fitted:
        raise ValueError("Every selected algorithm failed: " + "; ".join(f"{f['model']}: {f['error']}" for f in failed))

    best_key = max(fitted, key=lambda k: fitted[k][2])
    best_name, labels, sil = fitted[best_key]

    cluster_summary = []
    for c in sorted(set(labels)):
        mask = labels == c
        z = Xs[mask].mean(axis=0)                       # cluster mean in standard deviations
        top = np.argsort(-np.abs(z))[:3]
        cluster_summary.append({
            "cluster": int(c), "size": int(mask.sum()),
            "pct_of_data": round(mask.sum() / len(X) * 100, 1),
            "mean_values": {col: round(float(X.iloc[:, i][mask].mean()), 3) for i, col in enumerate(used[:10])},
            "highlights": [{"feature": used[i], "z": round(float(z[i]), 2)} for i in top],
        })

    if Xs.shape[1] >= 2:
        pca = PCA(n_components=2, random_state=random_state)
        coords, explained = pca.fit_transform(Xs), float(pca.explained_variance_ratio_.sum() * 100)
    else:
        coords, explained = np.column_stack([Xs[:, 0], np.zeros(len(Xs))]), 100.0
    pick = np.random.default_rng(random_state).choice(len(Xs), size=min(len(Xs), 600), replace=False)
    pca_points = [{"x": float(coords[i, 0]), "y": float(coords[i, 1]), "cluster": int(labels[i])} for i in pick]

    quality = "well-separated" if sil > 0.5 else "reasonably distinct" if sil > 0.25 else "overlapping"
    return safe_json({
        "problem_type": "clustering", "n_clusters": n_clusters,
        "features_used": used, "features_dropped": dropped,
        "silhouette_score": round(sil, 4), "k_search": k_search,
        "models_compared": results, "best_model": best_name, "best_model_key": best_key,
        "cluster_summary": cluster_summary, "pca_points": pca_points, "pca_explained_pct": round(explained, 1),
        "notes": notes, "failed_models": failed,
        "config": _config(None, used, keys, None, {"n_clusters": n_clusters}),
        "summary": f"Data was grouped into {n_clusters} clusters with {best_name} "
                   f"(silhouette score {sil:.3f}) -- clusters are {quality}.",
    })


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------
def run_auto_ml(df: pd.DataFrame, target: str | None = None, features: list[str] | None = None,
                model: str | None = None, n_clusters: int | None = None, test_size: float = 0.2,
                task: str | None = None, random_state: int = 42) -> dict:
    ptype = None
    try:
        test_size = float(min(max(test_size or 0.2, 0.1), 0.5))
        ptype = detect_problem_type(df, target, task)
        if ptype == "regression":
            return run_regression(df, target, features, model, test_size, random_state)
        if ptype == "classification":
            return run_classification(df, target, features, model, test_size, random_state)
        return run_clustering(df, n_clusters, features, model, random_state)
    except ValueError as e:
        return safe_json({"problem_type": ptype, "error": str(e)})
