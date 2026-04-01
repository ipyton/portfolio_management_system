import React from "react";
import HoldingsCategoryModule from "./category-modules/HoldingsCategoryModule";
import PerformanceCategoryModule from "./category-modules/PerformanceCategoryModule";
import RealtimeCategoryModule from "./category-modules/RealtimeCategoryModule";
import RiskCategoryModule from "./category-modules/RiskCategoryModule";
import TradingCategoryModule from "./category-modules/TradingCategoryModule";

const CATEGORY_MODULES = {
  realtime: RealtimeCategoryModule,
  performance: PerformanceCategoryModule,
  holdings: HoldingsCategoryModule,
  risk: RiskCategoryModule,
  trading: TradingCategoryModule,
};

export default function CategoryPanel(props) {
  const ModuleComponent = CATEGORY_MODULES[props.category.id] || RiskCategoryModule;
  return <ModuleComponent {...props} />;
}
