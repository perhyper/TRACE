import {
  valuationOutputSchema
} from "../domain/schemas.js";
import type {
  RouteDecision,
  ValuationField,
  ValuationOutput
} from "../domain/schemas.js";
import type { EvidenceLedger } from "../providers/evidence-bundle.js";
import type { ReportRuntimeResult } from "../reports/report.js";
import { reviewRuntimeResult } from "./reviewer.js";
import { selectAnalysisRoute } from "./routing.js";
import { valueFromRecentSecondaryTransaction } from "./valuation.js";

export const defaultTraceRuntimeVersion = "0.1.0";

export function runTraceAnalyzer(ledger: EvidenceLedger): ReportRuntimeResult {
  const routeResult = selectAnalysisRoute(ledger);
  const valuation =
    routeResult.route.status === "selected"
      ? valueFromRecentSecondaryTransaction(ledger)
      : abstainValuationForRouteAbstention(routeResult.route);

  return {
    ledger,
    sufficiency: routeResult.sufficiency,
    route: routeResult.route,
    valuation,
    review: reviewRuntimeResult({
      ledger,
      sufficiency: routeResult.sufficiency,
      route: routeResult.route,
      valuation
    })
  };
}

function abstainValuationForRouteAbstention(
  route: Extract<RouteDecision, { status: "abstained" }>
): ValuationOutput {
  return valuationOutputSchema.parse({
    headlineValuation: routeAbstainedValuation("headline-valuation", route),
    enterpriseValue: routeAbstainedValuation("enterprise-value", route),
    totalEquityValue: routeAbstainedValuation("total-equity-value", route),
    securityLevelFairValue: routeAbstainedValuation("security-level-fair-value", route)
  });
}

function routeAbstainedValuation(
  field: ValuationField,
  route: Extract<RouteDecision, { status: "abstained" }>
) {
  return {
    status: "abstained" as const,
    field,
    abstention: {
      reasonCode: "route-abstained",
      explanation:
        "TRACE abstains from valuation because the sufficiency gate did not support selecting an analysis route.",
      missingInformation: [
        {
          id: `missing-selected-route-for-${field}`,
          topic: "Selected analysis route",
          description: route.abstention.explanation,
          consequence: `TRACE cannot support ${field} while route selection is abstained.`,
          requiredFor: [field]
        }
      ],
      evidenceIds: route.abstention.evidenceIds
    }
  };
}
