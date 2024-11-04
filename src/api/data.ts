import {AxiosResponse } from 'axios';

import apiClient from './client';

const prefix = '/data'

interface DataServices {
  getData(datasource: string, postData: any, signal: AbortSignal): Promise<AxiosResponse<any>>
}

const endpoints = {
  getData: (datasource: string) => `${prefix}/${datasource}/query`,
}

export const services: DataServices = {
  getData: async (datasource: string, postData: any, signal: AbortSignal): Promise<AxiosResponse<any>> => {
    return apiClient.post(endpoints.getData(datasource), postData, { signal });
  },
}
