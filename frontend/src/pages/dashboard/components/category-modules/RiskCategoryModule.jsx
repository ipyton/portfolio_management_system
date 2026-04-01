import React from "react";
import { MetricCards } from "./CategoryShared";

export default function RiskCategoryModule({ category }) {
  return <MetricCards metrics={category.metrics} accent={category.accent} />;
}
