from __future__ import annotations

from pydantic import BaseModel, Field


class CleaningAction(BaseModel):
    action: str
    column: str | None = None


class ApplyCleaningRequest(BaseModel):
    actions: list[CleaningAction]


class ChartRequest(BaseModel):
    column: str | None = None
    x: str | None = None
    y: str | None = None
    date_column: str | None = None
    value_column: str | None = None
    bins: int | None = 20


class CustomChartRequest(BaseModel):
    """One request shape for every user-built chart (any type, one or many columns)."""
    kind: str                                   # histogram | bar | line | area | scatter | pie | box | heatmap
    x: str | None = None                        # category / date / numeric axis
    y: list[str] = Field(default_factory=list)  # one or many value columns
    color: str | None = None                    # optional category to split the series by
    agg: str = "sum"                            # sum | mean | median | min | max | count | nunique
    bins: int = 20
    top_n: int = 12
    normalize: bool = False


class MLRequest(BaseModel):
    target: str | None = None          # None -> clustering
    task: str | None = None            # None/"auto" | "regression" | "classification"
    features: list[str] | None = None  # None -> every usable column
    model: str | None = None           # None/"auto" | "all" | a key from /ml/models
    n_clusters: int | None = None      # clustering only; None -> pick automatically
    test_size: float = 0.2

    def to_kwargs(self) -> dict:
        return self.model_dump()


class ReportRequest(BaseModel):
    include_ml: bool = True
    ml: MLRequest | None = None        # re-uses the configuration of the last run in the ML tab


class RecommendationsRequest(BaseModel):
    ml_result: dict | None = None
