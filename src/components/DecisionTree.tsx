/**
 * DecisionTree — interactive "which marketplace" flow.
 * Guides shoppers through a series of choices to a marketplace recommendation.
 */

import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import type { DecisionNode } from "../data/comparisons";

interface DecisionTreeProps {
  nodes: DecisionNode[];
  startId?: string;
  title?: string;
}

export function DecisionTree({ nodes, startId = "start", title = "Which Marketplace Is Right for You?" }: DecisionTreeProps) {
  const [currentId, setCurrentId] = useState<string | null>(startId);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  const node = nodes.find(n => n.id === currentId);

  const handleChoice = (rec: string, next?: string) => {
    if (next) {
      setCurrentId(next);
    } else {
      setRecommendation(rec);
      setCurrentId(null);
    }
  };

  const reset = () => {
    setCurrentId(startId);
    setRecommendation(null);
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-900 dark:to-purple-950/20 border border-gray-100 dark:border-gray-800 p-6 sm:p-8">
      <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>

      {recommendation ? (
        <div>
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800/60">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Recommendation</p>
            <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{recommendation}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> Start over
          </button>
        </div>
      ) : node ? (
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-medium">{node.question}</p>
          <div className="space-y-2.5">
            {node.choices.map(choice => (
              <button
                key={choice.label}
                type="button"
                onClick={() => handleChoice(choice.recommendation, choice.next)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
              >
                {choice.label}
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No decision flow configured.</p>
      )}
    </div>
  );
}
