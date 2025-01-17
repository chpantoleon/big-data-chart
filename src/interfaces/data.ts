export interface ResponseDto {
  message: string;
  queryResults: QueryResultsDto;
}

export interface QueryResultsDto {
  data: Record<string, { timestamp: number, value: number; }[]>;
  measureStats: Record<string, unknown>;
  timeRange: {
    from: number;
    to: number;
    fromDate: string;
    toDate: string;
    intervalString: string;
  };
  groupByResults: null | Record<string, unknown>;
  error: Record<string, ErrorDto>;
  ioCount: number;
  queryTime: number;
  progressiveQueryTime: number;
  aggFactors: Record<string, number>;
  flag: boolean;
  litPixels: Record<string, string[][]>;
};

export interface ErrorDto {
  error: number;
  falsePixels: string[][];
  missingPixels: string[][];
}
