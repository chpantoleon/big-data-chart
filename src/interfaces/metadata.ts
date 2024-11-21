export interface MetadataDto {
  id: string,
  header: string[],
  schema: string,
  tableName: string,
  timeFormat: string,
  timeRange: {
    from: number,
    to: number,
    fromDate: string,
    toDate: string,
    intervalString: string
  },
  samplingInterval: number,
  measures: number[]
}

export interface Metadata {
  id: string,
  header: string[],
  schema: string,
  tableName: string,
  timeFormat: string,
  timeRange: {
    from: number,
    to: number,
    fromDate: Date,
    toDate: Date,
    intervalString: string
  },
  samplingInterval: number,
  measures: number[]
}

export const metadataDtoToDomain = (metadataDto: MetadataDto): Metadata => {
  return {
    ...metadataDto,
    timeRange:{
      ...metadataDto.timeRange,
      fromDate: new Date(metadataDto.timeRange.fromDate),
      toDate: new Date(metadataDto.timeRange.toDate),
    }
  }
}
