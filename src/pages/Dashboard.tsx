import {MouseEvent, useEffect, useState, useRef} from 'react';
import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import apiService from 'api/apiService';
import axios from 'axios';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import AppBar from '@mui/material/AppBar';
import {DateTimePicker} from '@mui/x-date-pickers/DateTimePicker';
import dayjs, {Dayjs} from 'dayjs';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import CardContent from '@mui/material/CardContent';
import {useDebouncedCallback} from 'use-debounce';
import Toolbar from '@mui/material/Toolbar';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import {Measure, Metadata, metadataDtoToDomain} from '../interfaces/metadata';
import {QueryResultsDto} from '../interfaces/data';
import {Query, queryToQueryDto} from '../interfaces/query';
import ResponseTimes from "components/ResponseTimes";
import { methodConfigurations} from 'components/MethodSettings';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ErrorMetrics from 'components/ErrorMetrics';

const Dashboard = () => {
  const REFERENCE_METHOD = 'M4';
  
  // Add state for reference data
  const [referenceResults, setReferenceResults] = useState<Record<number, QueryResultsDto>>({});
  const [isReferenceFetching, setIsReferenceFetching] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);

  const [from, setFrom] = useState<Date>(dayjs(1330144930991).toDate());
  const [to, setTo] = useState<Date>(dayjs(1330244930991).toDate());
  const [height, setHeight] = useState<number>(300);
  const [width, setWidth] = useState<number>(0);
  const [modalHeight, setModalHeight] = useState<number>(400);
  const [modalWidth, setModalWidth] = useState<number>(0);

  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);

  const [measures, setMeasures] = useState<Measure[]>([]);

  const [datasource, setDatasource] = useState<string>('influx');
  const [schema, setSchema] = useState<string>('more');
  const [table, setTable] = useState<string>('manufacturing_exp');

  const [metadata, setMetadata] = useState<Metadata>();

  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [initParams, setInitParams] = useState<Record<string, any>>({});

  const [methodInstances, setMethodInstances] = useState<
    Record<string, { id: string; method: string, initParams: Record<string, any> }[]>
  >({});

  const [isAddingMethod, setIsAddingMethod] = useState<boolean>(false);

  const [queryParams, setQueryParams] = useState<Record<string, Record<string, Record<string, any>>>>({});

  // multiple results by method
  const [queryResults, setQueryResults] = useState<Record<string, QueryResultsDto | undefined>>({});

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedChart, setSelectedChart] = useState<number | null>(null);

  // multiple response times by algoirthm
  const [responseTimes, setResponseTimes] = useState<Record<string, { total: number; rendering: number }>>({});

  // a dictionary of AbortControllers keyed by method
  const abortControllersRef = useRef<{ [algo: string]: AbortController | null }>({});

  // Add reference abort controller
  const referenceAbortController = useRef<AbortController | null>(null);

  const [errorMetrics, setErrorMetrics] = useState<any[]>([]);
  const [isErrorMetricsLoading, setIsErrorMetricsLoading] = useState<boolean>(false);
  const [isErrorMetricsOutdated, setIsErrorMetricsOutdated] = useState<boolean>(false);
  const [selectedErrorMetric, setSelectedErrorMetric] = useState<{label: string, id: string}>({id: "ssim", label:'SSIM'});

  const [isErrorCalculationInProgress, setIsErrorCalculationInProgress] = useState<boolean>(false);

  const margin = {top: 20, right: 0, bottom: 20, left: 40};

  const clearMeasures = () => {
    setMeasures([]);
    setQueryResults({});
    setResponseTimes({});
  };

  // returning an array of { dataset, query, response }
  const getResponseTimeSeries = (): any[] => {
    const series = [];
    for (const algo of selectedMethodInstances) {
      const res = queryResults[algo];
      const time = responseTimes[algo];
      if (res && time) {
        const queryTime = (res.queryTime || 0) * 1000;
        const renderingTime =  time.rendering;
        const networkingTime = time.total - renderingTime - queryTime;
        series.push({
          dataset: formatInstanceId(algo),
          query: queryTime,
          rendering: renderingTime,
          networking: networkingTime,
        });
      }
    }
    return series;
  };

  const existingInitializationParameters = (method: string): boolean => {
    return Boolean(
      methodInstances[selectedMethod].find(
        (inst) => JSON.stringify(inst.initParams) === JSON.stringify(initParams)
      )
    );
  }

  const existingQueryParams = (): boolean => {
    return selectedMethodInstances.some((instanceId) => {
      const [method] = instanceId.split('-');
      return hasQueryParameters(method);
    });
  };


  const hasConfigParameters = (method: string): boolean => {  
    return methodConfigurations[method]?.initParams && Object.keys(methodConfigurations[method]?.initParams).length > 0;
  }
  
  const hasQueryParameters = (method: string): boolean => {  
    return methodConfigurations[method]?.queryParams && Object.keys(methodConfigurations[method]?.queryParams).length > 0;
  }
  
  const getTickFormat = () => {
    return d3.timeFormat('%Y-%m-%d %H:%M:%S');
  };

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const response = await apiService.getMetadata(datasource, schema, table);

      const metadata = metadataDtoToDomain(response.data);
      setMetadata(metadata);
      setMinDate(dayjs(metadata.timeRange.from).toDate());
      setMaxDate(dayjs(metadata.timeRange.to).toDate());
      setFrom(dayjs(metadata.timeRange.from).toDate());
      setTo(dayjs(metadata.timeRange.from).add(1, 'm').toDate());
    } catch (error) {
      console.error(error);
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
        return null;
      } else {
        throw error; // Re-throw other errors
      }
    } finally {
      setLoading(false);
    }
  };

  // pass method also
  const fetchData = async (instanceId: string, from: Date, to: Date, metadata: Metadata) => {
    const [method] = instanceId.split('-');
    let fromQuery = from.getTime();
    if (fromQuery < metadata.timeRange.from) {
      fromQuery = metadata.timeRange.from;
      setFrom(dayjs(metadata.timeRange.from).toDate());
    }

    let toQuery = to.getTime();
    if (toQuery > metadata.timeRange.to) {
      toQuery = metadata.timeRange.to;
      setTo(dayjs(metadata.timeRange.to).toDate());
    }

    if (abortControllersRef.current[instanceId]) {
      abortControllersRef.current[instanceId]!.abort();
    }
    const controller = new AbortController();
    abortControllersRef.current[instanceId] = controller;

    setLoading(true);
    setLoadingCharts((prev) => ({ ...prev, [instanceId]: true }));

    let chartWidth = width;
    let chartHeight = height;

    if (isModalOpen) {
      chartWidth = Math.floor(
        d3.select('#chart-content-modal').node().getBoundingClientRect().width
      );
      chartHeight = Math.floor(
        d3.select('#chart-content-modal').node().getBoundingClientRect().height
      );
      setModalWidth(chartWidth);
      setModalHeight(chartHeight);
    } else {
      chartWidth = Math.floor(d3.select('#chart-content').node().getBoundingClientRect().width);
      setWidth(chartWidth);
    }

    const instance = Object.values(methodInstances).flat().find((inst) => inst.id === instanceId);
    const initParams = instance?.initParams || {};

    const request: Query = {
      query: {
        methodConfig: {
          key: instanceId,
          params: initParams,
        },
        from: dayjs(fromQuery).toDate(),
        to: dayjs(toQuery).toDate(),
        measures: measures.map(({id}) => id),
        width: chartWidth - margin.left - margin.right,
        height: Math.floor(chartHeight / measures.length - margin.bottom - margin.top),
        schema: schema,
        table: table,
        params: queryParams[instanceId] || {},
      },
    };

    let startTime = performance.now();
    try {
      const queryResults = await apiService.getData(
        datasource,
        queryToQueryDto(request),
        controller.signal
      );

      if (!queryResults) {
        return;
      }
      setQueryResults((prev) => ({
        ...prev,
        [instanceId]: queryResults,
      }));

      let renderStartTime = performance.now();
      const series = Object.values(queryResults.data);
      const timeRange = queryResults.timeRange;
      series.forEach((data, index) => {
        renderChart(
          `#svg_${instanceId}_${index}`,
          data,
          chartWidth,
          Math.floor(chartHeight / measures.length),
          {from: timeRange.from, to: timeRange.to}
        );
      });
      let renderEndTime = performance.now();

      setResponseTimes((prev) => ({
        ...prev,
        [instanceId]: {
          total: renderEndTime - startTime,
          rendering: renderEndTime - renderStartTime,
        },
      }));
    } catch (error) {
      console.error(error);
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
        return null;
      } else {
        throw error; // Re-throw other errors
      }
    } finally {
      setLoadingCharts((prev) => ({ ...prev, [instanceId]: false }));
      setLoading(false);
    }
  };


  const handleSelectMeasures = (event: SelectChangeEvent<string[]>) => {
    const {
      target: {value},
    } = event;

    const selectedMeasures = typeof value === 'string' ? value.split(',') : value;

    const selectedObjects = metadata?.measures.filter((measure) =>
      selectedMeasures.includes(measure.name)
    );

    setMeasures(selectedObjects ?? []);
  };

  const handleTableChange = (event: MouseEvent<HTMLElement>, table: string) => {
    setTable(table);
    clearMeasures();
  };

  const handleMethodSelect = (event: SelectChangeEvent<string>) => {
    const method = event.target.value;
    setSelectedMethod(method);
    // Initialize parameters with default values
    const defaultParams = methodConfigurations[method]?.initParams || {};
    const initializedParams = Object.keys(defaultParams).reduce((acc, key) => {
      acc[key] = defaultParams[key].default;
      return acc;
    }, {} as Record<string, any>);
    setInitParams(initializedParams);
  };

  const handleParamChange = (paramKey: string, value: any) => {
    const paramConfig = methodConfigurations[selectedMethod]?.initParams[paramKey];
    if (paramConfig?.type === "number") {
      const parsedValue = parseFloat(value);
      if (!isNaN(parsedValue) && parsedValue >= (paramConfig.min ?? -Infinity) && parsedValue <= (paramConfig.max ?? Infinity)) {
        setInitParams((prevParams) => ({
          ...prevParams,
          [paramKey]: parsedValue,
        }));
      }
    } else {
      setInitParams((prevParams) => ({
        ...prevParams,
        [paramKey]: value,
      }));
    }
  };

  const handleCancelAddMethod = () => {
    setSelectedMethod('');
    setInitParams({});
    setIsAddingMethod(false);
  };

  const handleAddInstance = () => {
    if (!selectedMethod) return;

    const id = `${selectedMethod}-${Date.now()}`;
    const newInstance = { id, method: selectedMethod, initParams };

    const alreadyExists = methodInstances[selectedMethod] && existingInitializationParameters(selectedMethod);

    if (alreadyExists) {
      alert('Instance already exists');
      return;
    }
    setMethodInstances((prevInstances) => ({
      ...prevInstances,
      [selectedMethod]: [
        ...(prevInstances[selectedMethod] || []),
        newInstance,
      ],
    }));

    // Initialize query parameters with default values
    const defaultQueryParams = methodConfigurations[selectedMethod]?.queryParams || {};
    const initializedQueryParams = Object.keys(defaultQueryParams).reduce((acc, key) => {
      acc[key] = defaultQueryParams[key].default;
      return acc;
    }, {} as Record<string, any>);
    setQueryParams((prevParams) => ({
      ...prevParams,
      [id]: initializedQueryParams,
    }));

    // Add the new instance to the selected method instances
    setSelectedMethodInstances((prevSelected) => [...prevSelected, id]);

    // Reset form
    setSelectedMethod('');
    setInitParams({});
    setIsAddingMethod(false);
  };

  const handleQueryParamChange = (instanceId: string, paramKey: string, value: any) => {
    setQueryParams((prevParams) => ({
      ...prevParams,
      [instanceId]: {
        ...prevParams[instanceId],
        [paramKey]: value,
      },
    }));
  };

  const debouncedFetchAll = useDebouncedCallback(
    async (algos: string[], from, to, metadata) => {
      // Loop over each method in sequence
      for (const algo of algos) {
        await fetchData(algo, from, to, metadata);
      }
    },
    300
  );

  const renderChart = (
    selector: string,
    data: { timestamp: number; value: number }[],
    width: number,
    height: number,
    timeRange: { from: number; to: number }
  ): number => {
    const renderStartTime = performance.now();
  
    const containerWidth = width - margin.left - margin.right;

    const svg = d3.select(selector);
    svg.selectAll('*').remove(); // Clear previous render

    const chartPlane = svg.append('g');

    // Convert x to Date from timestamp
    const formattedData = data.map((d: any) => [new Date(d.timestamp), d.value] as [Date, number]);

    // Set up scales
    const minTs = new Date(timeRange.from);
    const maxTs = new Date(timeRange.to);

    // Start from a pixel right of the axis
    // End at the right edge
    const x = d3
      .scaleTime()
      .domain([minTs, maxTs])
      .range([margin.left + 1, Math.floor(width - margin.right)]); // Floor the width to avoid blurry lines

    // Start from a pixel right of the axis
    // End at the right edge
    const minValue = d3.min(formattedData, (d: any) => d[1]);
    const maxValue = d3.max(formattedData, (d: any) => d[1]);

    // Start a pixel above the bottom axis
    // End at the top edge
    const y = d3
      .scaleLinear()
      .domain([minValue, maxValue])
      .range([Math.floor(height - margin.bottom) - 1, margin.top]); // Floor the height to avoid blurry lines

    // Function to add X gridlines
    const makeXGridlines = () => d3.axisBottom(x);

    // Function to add Y gridlines
    const makeYGridlines = () =>
      d3
        .axisLeft(y)
        .ticks(7)
        .tickValues([...y.ticks(7), y.domain()[1]]);

    // Add X gridlines
    chartPlane
      .append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(
        makeXGridlines()
          .tickSize(-height + margin.top + margin.bottom) // Extend lines down to the bottom
          .tickFormat(() => '') // No tick labels
      );

    // Add Y gridlines
    chartPlane
      .append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(
        makeYGridlines()
          .tickSize(-containerWidth) // Extend lines across the width
          .tickFormat(() => '') // No tick labels
      );

    // Apply basic styles for the gridlines
    svg
      .selectAll('.grid line')
      .style('stroke', '#e0e0e0')
      .style('stroke-opacity', 0.7)
      .style('shape-rendering', 'crispEdges');

    svg.selectAll('.grid path').style('stroke-width', 0);

    // X Axis
    const xAxis = chartPlane
      .append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat(getTickFormat())));

    // Y Axis
    chartPlane
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(7));

    // Add path
    const line = d3
      .line()
      .x((d: any) => Math.floor(x(d[0])) + 1 / window.devicePixelRatio)
      .y((d: any) => Math.floor(y(d[1])) + 1 / window.devicePixelRatio)
      .curve(d3.curveLinear);

    const path = chartPlane
      .append('path')
      .attr('class', 'path')
      .datum(formattedData)
      .attr('fill', 'none')
      .attr('stroke', 'blue')
      .attr('stroke-width', 1 / window.devicePixelRatio)
      .style('shape-rendering', 'crispEdges')
      .attr('d', line);


    const zoom = d3
      .zoom()
      .on('zoom', (event: any) => {
        const newX = event.transform.rescaleX(x);
        path.attr(
          'd',
          d3
            .line()
            .x((d: any) => Math.floor(newX(d[0])))
            .y((d: any) => Math.floor(y(d[1])))
            .curve(d3.curveLinear)
        );

        svg.selectAll('.point').remove();

        svg.selectAll('.error-pixel').remove();
      })
      .on('end', (event: any) => {
        const newX = event.transform.rescaleX(x);
        let [start, end] = newX.domain().map((d: any) => dayjs(d.getTime()).toDate());

        setFrom(start);
        setTo(end);
      });

    svg.call(zoom);

    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime;
    return renderTime;
  };

  const fetchReferenceData = async () => {
    if (!metadata || !from || !to || !measures.length) return null;
    
    if (referenceAbortController.current) {
      referenceAbortController.current.abort();
    }
    const controller = new AbortController();
    referenceAbortController.current = controller;
    
    setIsReferenceFetching(true);
    try {
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = Math.floor(height / measures.length - margin.bottom - margin.top);

      // Use the M4 instance ID for reference data
      const m4InstanceId = `${REFERENCE_METHOD}-reference`;

      const request: Query = {
        query: {
          methodConfig: {
            key: m4InstanceId,
            params: {},
          },
          from: from,
          to: to,
          measures: measures.map(m => m.id),
          width: chartWidth,
          height: chartHeight,
          schema: schema,
          table: table,
          params: {},
        },
      };

      const response = await apiService.getData(
        datasource,
        queryToQueryDto(request),
        controller.signal
      );

      if (response) {
        const newReferenceResults = measures.reduce((acc, measure) => {
          acc[measure.id] = response;
          return acc;
        }, {} as Record<number, QueryResultsDto>);
        
        setReferenceResults(newReferenceResults);
      }

    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Reference data fetch cancelled');
      } else {
        console.error('Error fetching reference data:', error);
      }
    } finally {
      setIsReferenceFetching(false);
    }
  };

  const [selectedMethodInstances, setSelectedMethodInstances] = useState<string[]>([]);
  const [loadingCharts, setLoadingCharts] = useState<Record<string, boolean>>({});

  const formatInstanceId = (instanceId: string) => {
    const [method, timestamp] = instanceId.split('-');
  
    if (!hasConfigParameters(method)) {
      return method;
    }
  
    const instances = methodInstances[method] || [];
    if (instances.length === 1) {
      return method;
    }
  
    const instanceNumber = instances.findIndex(inst => inst.id === instanceId) + 1;
    return `${method}-${instanceNumber}`;
  };

  const handleMethodInstanceChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    const newSelected = typeof value === 'string' ? value.split(',') : value;
    setSelectedMethodInstances(newSelected);
    
    // Clear results for deselected instances
    setQueryResults(prev => {
      const newResults = {...prev};
      Object.keys(newResults).forEach(key => {
        if (!newSelected.includes(key)) {
          delete newResults[key];
        }
      });
      return newResults;
    });
    
    setResponseTimes(prev => {
      const newTimes = {...prev};
      Object.keys(newTimes).forEach(key => {
        if (!newSelected.includes(key)) {
          delete newTimes[key];
        }
      });
      return newTimes;
    });
  };

  // reset zoom
  useEffect(() => {
    if (!measures.length) return;
    for (const algo of selectedMethodInstances) {
      const res = queryResults[algo];
      if (!res) continue;
      const series = Object.values(res.data);
      series.forEach((_, index) => {
        const svg = d3.select(`#svg_${algo}_${index}`);
        svg.call(d3.zoom().transform, d3.zoomIdentity);
      });
    }
  }, [queryResults, measures, selectedMethodInstances]);

  // reset zoom in modal
  useEffect(() => {
    if (selectedChart === null) return;
    for (const algo of selectedMethodInstances) {
      const svg = d3.select(`#svg_${algo}_${selectedChart}-modal`);
      svg.call(d3.zoom().transform, d3.zoomIdentity);
    }
  }, [selectedChart, selectedMethodInstances]);


  // render chart
  useEffect(() => {
    if (!measures.length || !queryResults) return;

    const newResponseTimes = { ...responseTimes };

    for (const algo of selectedMethodInstances) {
      const res = queryResults[algo];
      if (!res) continue; // skip if not fetched yet

      const series = Object.values(res.data);
      const timeRange = res.timeRange;
      let totalRenderTime = 0;

      // For each measure index, we have series[index]
      series.forEach((data, index) => {
        const renderTime = renderChart(
          `#svg_${algo}_${index}`,
          data,
          width,
          Math.floor(height / measures.length),
          {from: timeRange.from, to: timeRange.to}
        );
        totalRenderTime += renderTime;
      });

      newResponseTimes[algo] = {
        ...newResponseTimes[algo],
        rendering: totalRenderTime,
      };
    }
    setResponseTimes(newResponseTimes);
  }, [
    queryResults,
    selectedMethodInstances,
    metadata,
    height,
  ]);

  // render chart in modal
  useEffect(() => {
    if (!measures.length || !queryResults || selectedChart === null) return;

    const newResponseTimes = { ...responseTimes };

    for (const algo of selectedMethodInstances) {
      const res = queryResults[algo];
      if (!res) continue;
      const series = Object.values(res.data);
      const timeRange = res.timeRange;
      let totalRenderTime = 0;

      // For each measure index, we have series[index]
      series.forEach((data, index) => {
        const renderTime = renderChart(
          `#svg_${algo}_${selectedChart}-modal`,
          data,
          modalWidth,
          Math.floor(modalHeight / selectedMethodInstances.length),
          {from: timeRange.from, to: timeRange.to}
        );
        totalRenderTime += renderTime;
      });

      newResponseTimes[algo] = {
        ...newResponseTimes[algo],
        rendering: totalRenderTime,
      };
    }

    setResponseTimes(newResponseTimes);
  }, [
    queryResults,
    selectedMethodInstances,
    metadata,
    modalHeight,
    selectedChart,
 ]);

  // add resize handler for charts
  useEffect(() => {
    d3.select(window).on('resize', function () {
      if (d3.select('#chart-content').node()) {
        setWidth(Math.floor(d3.select('#chart-content').node().getBoundingClientRect().width));
      }
    
      if (d3.select('#chart-content-modal').node()) {
        setModalWidth(
          Math.floor(d3.select('#chart-content-modal').node().getBoundingClientRect().width)
        );
        setModalHeight(
          Math.floor(d3.select('#chart-content-modal').node().getBoundingClientRect().height)
        );
      }
    });
  }, []);

  // fetch metadata
  useEffect(() => {
    fetchMetadata();
  }, [table, datasource, schema]);

  // fetch data
  useEffect(() => {
    if (!metadata || !from || !to || !measures.length) {
      return;
    }
    debouncedFetchAll(selectedMethodInstances, from, to, metadata);
  }, [
    from,
    to,
    selectedMethodInstances,
    metadata,
    measures,
    height,
    width,
    schema,
    table,
    selectedChart,
  ]);

  // Update outdated state when relevant changes occur
  useEffect(() => {
    if (errorMetrics.length > 0) {
      setIsErrorMetricsOutdated(true);
    }
  }, [selectedMethodInstances, measures, queryResults, from, to]);

  const handleCalculateErrorMetrics = async () => {
    setIsErrorMetricsLoading(true);
    setIsErrorCalculationInProgress(true);
    
    try {
      // First ensure we have reference data
      await fetchReferenceData();
      
      // Wait a brief moment to ensure reference data is properly set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Generate metrics by comparing each method's visualization with reference
      const metricsData = measures.map((m) => {
        const measureData: any = { measure: m.name };
        
        selectedMethodInstances.forEach((instanceId) => {
          const methodResult = queryResults[instanceId];
          const referenceResult = referenceResults[m.id];
          
          if (methodResult && referenceResult) {
            measureData[`${instanceId}_ssim`] = calculateSSIM(
              methodResult.data[m.id],
              referenceResult.data[m.id],
              width,
              height / measures.length
            );
          }
        });
        
        return measureData;
      });
      
      setErrorMetrics(metricsData);
      setIsErrorMetricsOutdated(false);
    } finally {
      setIsErrorMetricsLoading(false);
      setIsErrorCalculationInProgress(false);
    }
  };

  const calculateSSIM = (methodData: any[], referenceData: any[], width: number, height: number) => {
    // This is where you would implement the SSIM calculation
    // You'll need to:
    // 1. Convert the time series data to images
    // 2. Calculate SSIM between the images
    // For now, return a placeholder value
    return 0.95 + (Math.random() * 0.01);
  };

  // Reset reference results when measures change
  useEffect(() => {
    setReferenceResults({});
  }, [measures]);

  // Add cleanup for reference abort controller
  useEffect(() => {
    return () => {
      if (referenceAbortController.current) {
        referenceAbortController.current.abort();
      }
    };
  }, []);

  // Initialize M4 method instance on component mount
  useEffect(() => {
    const m4Instance = {
      id: `${REFERENCE_METHOD}-reference`,
      method: REFERENCE_METHOD,
      initParams: {}
    };

    setMethodInstances(prev => ({
      ...prev,
      [REFERENCE_METHOD]: [m4Instance]
    }));

    // Add M4 to selected instances by default
    setSelectedMethodInstances([m4Instance.id]);
  }, []);

  const [controlPanelExpanded, setControlPanelExpanded] = useState(true);
  const [metricsPanelExpanded, setMetricsPanelExpanded] = useState(true);

  useEffect(() => {
    if (isErrorCalculationInProgress && !isReferenceFetching && Object.keys(referenceResults).length > 0) {
      handleCalculateErrorMetrics();
    }
  }, [isReferenceFetching, referenceResults, isErrorCalculationInProgress]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="relative">
        <Toolbar variant="dense">
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            TimeVizLens
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ pt: 2, px: 1 }}>
        <Grid container spacing={2}>
          <Grid size={4}>
            <Grid container spacing={2}>
              <Grid size={12}>
                <Card variant="outlined">
                  <Box 
                    sx={{ 
                      p: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                      bgcolor: 'rgba(0, 0, 0, 0.03)'
                    }}
                    onClick={() => setControlPanelExpanded(!controlPanelExpanded)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Typography variant="subtitle1" fontWeight="medium">Control Panel</Typography>
                    <IconButton size="small">
                      {controlPanelExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={controlPanelExpanded}>
                    <Box sx={{ p: 1 }}>
                      {/* Control Panel Content */}
                      <Grid container spacing={1}>
                        <Grid size={12}>
                          <Typography variant="overline">Parameters</Typography>
                          <Grid container spacing={2} sx={{ pb: 1 }} alignItems={'center'}>
                            <Grid size={12}>
                              <DateTimePicker
                                label="From"
                                minDateTime={dayjs(minDate)}
                                maxDateTime={dayjs(to)}
                                disabled={loading}
                                value={dayjs(from)}
                                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                onAccept={(newValue: Dayjs | null) => {
                                  if (newValue) {
                                    setFrom(newValue.toDate());
                                  }
                                }}
                              />
                            </Grid>
                            <Grid size={12}>
                              <DateTimePicker
                                label="To"
                                minDateTime={dayjs(from)}
                                maxDateTime={dayjs(maxDate)}
                                disabled={loading}
                                value={dayjs(to)}
                                slotProps={{ textField: { size: 'small', fullWidth: true } }}
                                onAccept={(newValue: Dayjs | null) => {
                                  if (newValue) {
                                    setTo(newValue.toDate());
                                  }
                                }}
                              />
                            </Grid>
                          </Grid>
                        </Grid>
                        <Grid size={12}>
                          <Typography variant="overline">Dataset</Typography>
                          <List component="nav" aria-label="table">
                            <ListItemButton
                              dense
                              disabled={loading}
                              selected={table === 'intel_lab_exp'}
                              onClick={(event) => handleTableChange(event, 'intel_lab_exp')}
                            >
                              <ListItemText primary="intel_lab_exp" />
                            </ListItemButton>
                            <ListItemButton
                              dense
                              disabled={loading}
                              selected={table === 'manufacturing_exp'}
                              onClick={(event) => handleTableChange(event, 'manufacturing_exp')}
                            >
                              <ListItemText primary="manufacturing_exp" />
                            </ListItemButton>
                          </List>
                        </Grid>
                        <Grid size={12}>
                          <Typography variant="overline">Method Instances</Typography>
                          <Box display="flex" alignItems="center">
                            <Select
                              multiple
                              fullWidth
                              size="small"
                              value={selectedMethodInstances}
                              onChange={handleMethodInstanceChange}
                              renderValue={(selected) => (
                                <Box display="flex" flexWrap="wrap" gap={1}>
                                  {(selected as string[]).map((value) => {
                                    return (
                                      <Chip
                                        key={value}
                                        label={formatInstanceId(value)}
                                        style={{ margin: 2 }}
                                      />
                                    );
                                  })}
                                </Box>
                              )}
                              disabled={Object.values(methodInstances).flat().length === 0} // Disable if no instances are added
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    maxHeight: 48 * 4.5 + 8,
                                    width: 250,
                                  },
                                },
                              }}
                            >
                              {Object.values(methodInstances).flat().map((instance) => (
                                <MenuItem key={instance.id} value={instance.id}>
                                  <Box display="flex" flexDirection="column">
                                    <Typography variant="body2">{formatInstanceId(instance.id)}</Typography>
                                    <Typography variant="caption" color="textSecondary">
                                      {Object.entries(instance.initParams).map(([key, value]) => (
                                        <span key={key}>{`${key}: ${value},`}</span>
                                      ))}
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => setIsAddingMethod(!isAddingMethod)}
                            >
                              {isAddingMethod ? <RemoveIcon /> : <AddIcon />}
                            </IconButton>
                          </Box>
                          {isAddingMethod && (
                            <Box mt={2}>
                              <Typography variant="subtitle2">Method</Typography>
                              <Select
                                fullWidth
                                size="small"
                                value={selectedMethod}
                                onChange={handleMethodSelect}
                                displayEmpty
                              >
                                <MenuItem value="" disabled>
                                  Select Method
                                </MenuItem>
                                {Object.keys(methodConfigurations).map((method) => (
                                  <MenuItem key={method} value={method}>
                                    {method}
                                  </MenuItem>
                                ))}
                              </Select>
                              {selectedMethod && (
                                <Box mt={2}>
                                  {hasConfigParameters(selectedMethod) && <Typography variant="subtitle2">Initialization Parameters</Typography>}
                                  {Object.keys(initParams).map((paramKey) => {
                                    const paramConfig = methodConfigurations[selectedMethod]?.initParams[paramKey];
                                    return (
                                      <TextField
                                        key={paramKey}
                                        label={paramConfig?.label}
                                        value={initParams[paramKey]}
                                        onChange={(e) => handleParamChange(paramKey, e.target.value)}
                                        fullWidth
                                        size="small"
                                        type={paramConfig?.type === "number" ? "number" : "text"}
                                        inputProps={{
                                          step: paramConfig?.step,
                                          min: paramConfig?.min,
                                          max: paramConfig?.max,
                                        }}
                                        sx={{ mb: 1, mt: 1 }}
                                      />
                                    );
                                  })}
                                  <Box display="flex" justifyContent="space-between">
                                    <Button
                                      variant="contained"
                                      color="primary"
                                      size="small"
                                      onClick={handleAddInstance}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outlined"
                                      color="secondary"
                                      size="small"
                                      onClick={handleCancelAddMethod}
                                    >
                                      Cancel
                                    </Button>
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Grid>
                        <Grid size={12}>
                          <Typography variant="overline">Measures</Typography>
                          <Select
                            multiple
                            fullWidth
                            size="small"
                            value={measures.map((measure) => measure.name)}
                            onChange={handleSelectMeasures}
                            renderValue={(selected) => (
                              <div>
                                {(selected as string[]).map((value) => (
                                  <Chip key={value} label={value} style={{ margin: 2 }} />
                                ))}
                              </div>
                            )}
                          >
                            {metadata?.measures.map((measure: Measure) => (
                              <MenuItem key={measure.id} value={measure.name}>
                                {measure.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </Grid>
                        <Grid size={12}>
                          {existingQueryParams() && <Typography variant="overline">Query Parameters</Typography>}
                          {selectedMethodInstances.map((instanceId) => {
                            const [method] = instanceId.split('-');
                            const params = methodConfigurations[method]?.queryParams || {};
                            if (Object.keys(params).length === 0) return null; // Skip if no query params
                            return (
                              <Box key={instanceId}>
                                <Typography variant="subtitle2">{formatInstanceId(instanceId)}</Typography>
                                {Object.keys(params).map((paramKey) => {
                                  const paramConfig = params[paramKey];
                                  return (
                                    <TextField
                                      key={paramKey}
                                      label={paramConfig.label}
                                      value={queryParams[instanceId]?.[paramKey] || paramConfig.default}
                                      onChange={(e) => handleQueryParamChange(instanceId, paramKey, e.target.value)}
                                      fullWidth
                                      size="small"
                                      type={paramConfig.type === "number" ? "number" : "text"}
                                      inputProps={{
                                        step: paramConfig.step,
                                        min: paramConfig.min,
                                        max: paramConfig.max,
                                      }}
                                      sx={{ mb: 1, mt: 1 }}
                                    />
                                  );
                                })}
                              </Box>
                            );
                          })}
                        </Grid>
                      </Grid>
                    </Box>
                  </Collapse>
                </Card>
              </Grid>
              <Grid size={12}>
                <Card variant="outlined">
                  <Box 
                    sx={{ 
                      p: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                      bgcolor: 'rgba(0, 0, 0, 0.03)'
                    }}
                    onClick={() => setMetricsPanelExpanded(!metricsPanelExpanded)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Typography variant="subtitle1" fontWeight="medium">Evaluation Metrics</Typography>
                    <IconButton size="small">
                      {metricsPanelExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Collapse in={metricsPanelExpanded}>
                    <Box sx={{ p: 1 }}>
                    {!queryResults}
                    {selectedMethodInstances.length === 0 ? (
                          <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                            Select or create an instance of an method to display charts
                          </Typography>
                      ) : !measures.length ? (
                            <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                              Select at least one measure to display
                            </Typography>          
                      ) :
                       (
                        <Grid container spacing={1}>
                          <Grid size={12}>
                            <Typography variant="overline">Time Breakdown</Typography>
                            <Box>
                              <ResponseTimes series={getResponseTimeSeries()} />
                            </Box>
                            {!!Object.keys(responseTimes).length && (
                              <Grid size={12}>
                              <Box sx={{ mt: 2 }}>
                                <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Typography variant="overline">Visualization Quality</Typography>
                                    {isErrorMetricsOutdated && errorMetrics.length > 0 && (
                                      <Typography 
                                        variant="caption" 
                                        sx={{ 
                                          color: 'warning.main',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 0.5
                                        }}
                                      >
                                        (outdated)
                                      </Typography>
                                    )}
                                  </Box>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    onClick={handleCalculateErrorMetrics}
                                    disabled={isErrorMetricsLoading}
                                    startIcon={isErrorMetricsLoading ? <CircularProgress size={16} /> : null}
                                    color={isErrorMetricsOutdated ? "warning" : "primary"}
                                    sx={{ minWidth: 120 }}
                                  >
                                    {isErrorMetricsLoading ? 'Calculating...' : isErrorMetricsOutdated ? 'Recalculate' : 'Calculate'}
                                  </Button>
                                </Box>
                            
                                {errorMetrics.length > 0 && (
                                  <Box sx={{ mt: 2 }}>
                                    <ErrorMetrics 
                                      series={errorMetrics} 
                                      selectedMetric={selectedErrorMetric} 
                                      selectedMethodInstances={selectedMethodInstances}
                                      formatInstanceId={formatInstanceId} 
                                    />
                                  </Box>
                                )}
                              </Box>
                            </Grid>                            
                            )}
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  </Collapse>
                </Card>
              </Grid>
            </Grid>
          </Grid>
          <Grid size={8}>
            {!queryResults}
            {selectedMethodInstances.length === 0 ? (
              <Card variant="outlined">
                <CardContent id="chart-content">
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                    Select or create an instance of an method to display charts
                  </Typography>
                </CardContent>
              </Card>
            ) : !measures.length ? (
              <Card variant="outlined">
                <CardContent id="chart-content">
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                    Select at least one measure to display
                  </Typography>
                </CardContent>
              </Card>
            ) : !queryResults ? (
              <Card variant="outlined">
                <CardContent id="chart-content">
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                    {loading ? (
                      <>
                        <CircularProgress size={'3rem'} />
                      </>
                    ) : (
                      'No data'
                    )}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              // Render measure-by-measure, and within each measure, render each method’s chart
              measures.map((measure, measureIndex) => (
                <Card variant="outlined" key={`measure_${measureIndex}`} sx={{ mb: 2 }}>
                  <CardContent id="chart-content">
                    <Box
                      display="flex"
                      flexDirection={'row'}
                      flexWrap={'nowrap'}
                      alignItems={'center'}
                      justifyContent={'space-between'}
                    >
                      <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: 14 }}>
                        {measure.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedChart(measure.id);
                          setIsModalOpen(true);
                        }}
                      >
                        <OpenInFullIcon fontSize={'small'} />
                      </IconButton>
                    </Box>

                    {/* For each selected method instance, display a sub-chart for this measure */}
                    {selectedMethodInstances.map((instanceId) => {
                      const algoResult = queryResults[instanceId];
                      // If there's no data yet for that method, just show a loader or placeholder
                      if (!algoResult) {
                        return (
                          <Box
                            key={`chart_${instanceId}_${measureIndex}`}
                            height={Math.floor(height / measures.length)}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            position="relative"
                          >
                            {loadingCharts[instanceId] ? (
                              <CircularProgress size={'3rem'} />
                            ) : (
                              <Typography
                                sx={{
                                  color: 'text.secondary',
                                  fontSize: 14,
                                  textAlign: 'center',
                                }}
                              >
                                No data for {formatInstanceId(instanceId)}
                              </Typography>
                            )}
                          </Box>
                        );
                      }
                      return (
                        <Box key={`chart_${instanceId}_${measureIndex}`} position="relative">
                          {/* Method label */}
                          <Typography variant="caption" sx={{ ml: 2 }}>
                            {formatInstanceId(instanceId)}
                          </Typography>
                          {/* The actual chart */}
                          <svg
                            id={`svg_${instanceId}_${measureIndex}`}
                            width={width}
                            height={Math.floor(height / measures.length)}
                          />
                          {loadingCharts[instanceId] && (
                            <Box
                              position="absolute"
                              top={0}
                              left={0}
                              width="100%"
                              height="100%"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              bgcolor="rgba(255, 255, 255, 0.7)"
                              zIndex={1}
                            >
                              <CircularProgress size={'3rem'} />
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </CardContent>
                </Card>
              ))
            )}
          </Grid>
        </Grid>
      </Box>

      <Dialog
        open={isModalOpen}
        fullWidth
        maxWidth="xl" // Adjust as needed
        PaperProps={{
          style: { height: '90vh', overflow: 'hidden' },
        }}
      >
        <Box sx={{ width: '100%', height: '100%', p: 2 }}>
          <Box display={'flex'} alignItems={'flex-end'}>
            {selectedChart !== null && (
              <Typography
                style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                variant="body1"
              >
                {measures[selectedChart]?.name}
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={() => {
                setSelectedChart(null);
                setIsModalOpen(false);
              }}
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
            >
              <CloseIcon fontSize={'small'} />
            </IconButton>
          </Box>

          <Box
            sx={{ width: '100%', height: '100%', transform: 'translate(0, 0)' }}
            id="chart-content-modal"
          >
            {selectedChart !== null &&
              selectedMethodInstances.map((instanceId) => (
                <Box key={`svg_${instanceId}_${selectedChart}-modal`} position="relative">
                  <svg
                    id={`svg_${instanceId}_${selectedChart}-modal`}
                    width={modalWidth}
                    height={modalHeight / selectedMethodInstances.length}
                  />
                  {loadingCharts[instanceId] && (
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      width="100%"
                      height="100%"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bgcolor="rgba(255, 255, 255, 0.7)"
                      zIndex={1}
                    >
                      <CircularProgress size={'3rem'} />
                    </Box>
                  )}
                </Box>
              ))}
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
