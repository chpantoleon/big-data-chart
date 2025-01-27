// Define types for algorithm configurations
export interface AlgorithmParameter {
  label: string;
  type: "number" | "boolean";
  default: number | boolean;
  min?: number; // Only for type "number"
  max?: number; // Only for type "number"
  step?: number; // Only for type "number"
}

interface AlgorithmConfig {
    initParams: Record<string, AlgorithmParameter>; // Initialization parameters
    queryParams: Record<string, AlgorithmParameter>; // Query parameters
  }
  

// Define algorithm configurations
export const algorithmConfigurations: Record<string, AlgorithmConfig> = {
  MinMaxCache: {
    initParams:{
      dataReductionRatio: {
          label: "Data Reduction Ratio (Integer)",
          type: "number",
          default: 6,
          min: 0,
          max: 12,
          step: 1,
        },
      prefetchingFactor: {
        label: "Prefetching Factor (Float)",
        type: "number",
        default: 0,
        min: 0,
        max: 1,
        step: 0.1,
      },
      aggFactor: {
        label: "Aggregation Factor (Integer)",
        type: "number",
        default: 4,
        min: 2,
        max: 16,
        step: 2,
      },
    },
    queryParams: {
      accuracy: {
        label: "Accuracy (Float)",
        type: "number",
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.95,
      },
    },
  },
  M4: {
    initParams: {
    },
    queryParams: {
    },
  },
};
