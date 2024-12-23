import {AxiosResponse } from 'axios';

import apiClient from './client';
import {MetadataDto} from "../interfaces/metadata";
import {QueryResultsDto, ResponseDto} from "../interfaces/data";
import {QueryDto} from "../interfaces/query";

const prefix = '/data'

interface DataServices {
  getData(datasource: string, postData: QueryDto, signal: AbortSignal): Promise<QueryResultsDto | null>
  getMetadata(
    datasource: string,
    schema: string,
    table: string,
  ): Promise<AxiosResponse<MetadataDto>>
}

const endpoints = {
  getData: (datasource: string) => `${prefix}/${datasource}/query`,
  getMetadata: (
    datasource: string,
    schema: string,
    table: string
  ) => `${prefix}/${datasource}/dataset/${schema}/${table}`,
}

export const services: DataServices = {
  getData: async (
    datasource: string,
    postData: QueryDto,
    signal: AbortSignal
  ): Promise<QueryResultsDto | null> => {
    const response: AxiosResponse<ResponseDto> = await apiClient.post(endpoints.getData(datasource), postData, { signal });

    if (!response) {
      return null;
    }
    return response.data.queryResults;
  },
  getMetadata: async (
    datasource: string,
    schema: string,
    table: string,
  ): Promise<AxiosResponse<MetadataDto>> => {
    return apiClient.get(endpoints.getMetadata(datasource, schema, table))
  }
}
