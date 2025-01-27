export interface QueryDto {
  query: {
    algorithm: {
      name: string,
      params: any,
    },
    from: number,
    to: number,
    measures: number[],
    width: number,
    height: number  
    schema: string,
    table: string,
    params: any,
  },
}

export interface Query {
  query: {
    algorithm: {
      name: string,
      params: any,
    },
    from: Date,
    to: Date,
    measures: number[],
    width: number,
    height: number,
    schema: string,
    table: string,
    params: any,
  },
}

export const queryToQueryDto = (query: Query): QueryDto => {
  return {
    ...query,
    query: {
      ...query.query,
      from: query.query.from.getTime(),
      to: query.query.to.getTime(),
    }
  }
}
