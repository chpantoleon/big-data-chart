export interface QueryDto {
  query: {
    from: number,
    to: number,
    measures: number[],
    viewPort: {
      width: number,
      height: number
    },
    accuracy: number
  },
  schema: string,
  table: string
}

export interface Query {
  query: {
    from: Date,
    to: Date,
    measures: number[],
    viewPort: {
      width: number,
      height: number
    },
    accuracy: number
  },
  schema: string,
  table: string
}

export const queryToQueryDto = (query: Query): QueryDto => {
  return {
    ...query,
    query: {
      ...query.query,
      from: query.query.from.getTime()/1000,
      to: query.query.to.getTime()/1000,
      accuracy: +(query.query.accuracy/1000).toFixed(2)
    }
  }
}
