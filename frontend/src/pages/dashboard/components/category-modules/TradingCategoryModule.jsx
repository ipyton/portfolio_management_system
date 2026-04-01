import React from "react";
import { MetricCards } from "./CategoryShared";

export default function TradingCategoryModule({ category }) {
  return <MetricCards metrics={category.metrics} accent={category.accent} />;
}
