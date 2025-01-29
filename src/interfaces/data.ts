export interface ResponseDto {
  message: string;
  queryResults: QueryResultsDto;
}

export interface QueryResultsDto {
  data: Record<string, { timestamp: number, value: number; }[]>;
  timeRange: {
    from: number;
    to: number;
    fromDate: string;
    toDate: string;
    intervalString: string;
  };
  ioCount: number;
  queryTime: number;
  metrics: Record<string, string>;
  litPixels: Record<string, string[][]>
};
