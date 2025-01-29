import { MouseEvent, SyntheticEvent, useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Select, { SelectChangeEvent } from '@mui/material/Select';
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
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import CardContent from '@mui/material/CardContent';
import Switch from '@mui/material/Switch';
import { useDebouncedCallback } from 'use-debounce';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Toolbar from '@mui/material/Toolbar';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import CircularProgress from '@mui/material/CircularProgress';

import { Measure, Metadata, metadataDtoToDomain } from '../interfaces/metadata';
import { ErrorDto, QueryResultsDto } from '../interfaces/data';
import { Query, queryToQueryDto } from '../interfaces/query';
import ResponseTimes from 'components/ProgressBar';
import { Point } from 'interfaces/point';
import { calculateJaccardSimilarity } from 'utils/jaccard';
import { calculateSSIM } from 'utils/ssim';

const round = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

const generateLine = (start: { x: number; y: number }, length: number, angle: number) =>
  Array.from({ length }, (_, i) => ({
    x: Math.round(start.x + i * Math.cos((angle * Math.PI) / 180)),
    y: Math.round(start.y + i * Math.sin((angle * Math.PI) / 180)),
  }));

const generateSineWave = (
  start: { x: number; y: number },
  length: number,
  amplitude: number,
  frequency: number,
  phaseShift: number = 0,
  verticalShift: number = 0
): Point[] =>
  Array.from({ length }, (_, i) => ({
    x: start.x + i,
    y: Math.round(
      start.y + amplitude * Math.sin(frequency * (start.x + i) + phaseShift) + verticalShift
    ),
  }));

const Dashboard = () => {
  const [loading, setLoading] = useState<boolean>(false);

  const [from, setFrom] = useState<Date>(dayjs(1330144930991).toDate());
  const [to, setTo] = useState<Date>(dayjs(1330244930991).toDate());
  const [height, setHeight] = useState<number>(300);
  const [width, setWidth] = useState<number>(0);
  const [modalHeight, setModalHeight] = useState<number>(400);
  const [modalWidth, setModalWidth] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0.95);

  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);

  const [isFalsePixelsVisible, setIsFalsePixelsVisible] = useState<boolean>(true);
  const [isMissingPixelsVisible, setIsMissingPixelsVisible] = useState<boolean>(true);

  const [measures, setMeasures] = useState<Measure[]>([]);

  const [datasource, setDatasource] = useState<string>('influx');
  const [schema, setSchema] = useState<string>('more');
  const [table, setTable] = useState<string>('manufacturing_exp');

  const [metadata, setMetadata] = useState<Metadata>();
  const [queryResults, setQueryResults] = useState<QueryResultsDto>();
  const [queryResultsRaw, setQueryResultsRaw] = useState<QueryResultsDto>();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedChart, setSelectedChart] = useState<number | null>(null);

  const [isCompareVisible, setIsCompareVisible] = useState<boolean>(false);

  const [responseTime, setResponseTime] = useState<number>(0);
  const [responseTimeRaw, setResponseTimeRaw] = useState<number>(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const abortControllerRawRef = useRef<AbortController | null>(null);

  const margin = { top: 20, right: 0, bottom: 20, left: 40 };
  const min = 0;
  const max = 1;
  const step = 0.01;

  const clearMeasures = () => setMeasures([]);

  const deduplicatePixels = (pixelArray: Point[]): Point[] => {
    const seen = new Set<string>();

    return pixelArray.filter((pixel) => {
      const key = `${pixel.x},${pixel.y}`;
      if (seen.has(key)) {
        return false; // Skip duplicate
      }
      seen.add(key); // Mark as seen
      return true;
    });
  };

  const calculateTrueError = (pixelArray1: Point[], pixelArray2: Point[]): number => {
    let differences = 0;

    for (let column = 1 + margin.left; column < width; column++) {
      let item1 = pixelArray1.filter((i) => i.x === column);
      let item2 = pixelArray2.filter((i) => i.x === column);

      item1.forEach((i1) =>
        item2.forEach((i2) => {
          if (i2.y && i1.y !== i2.y) {
            console.log(i1.x, i1.y, i2.x, i2.y);
            differences++;
            return;
          }
        })
      );
    }

    return (differences / width) * 100;
  };

  const getResponseTimeSeries = (): any[] => {
    let series = [];

    if (queryResults && responseTime) {
      series.push({
        dataset: 'Cached',
        query: queryResults.queryTime * 1000,
        response: responseTime,
      });
    }

    if (queryResultsRaw && responseTimeRaw) {
      series.push({
        dataset: 'Raw',
        query: queryResultsRaw.queryTime * 1000,
        response: responseTimeRaw,
      });
    }

    return series;
  };

  const pixelArrayToCoordinates = (pixelArray: string[][]): Point[] =>
    pixelArray
      .map((range, index) => {
        if (!range.length) return null;

        return {
          column: index,
        };
      })
      .filter((range) => range)
      .flatMap((range) =>
        pixelArray[range!.column].flatMap(parseRange).map((y) => ({
          x: range!.column,
          y,
        }))
      );

  const parseRange = (range: string): number[] => {
    if (['[]', '()'].includes(range)) {
      return [-1];
    }

    const match = range.match(/^([\[\(])(\-?\d+)\.\.(\-?\d+)([\]\)])$/);

    if (!match) {
      throw new Error(
        `Invalid range format. Example valid format: '[154..155]' or '(154..155]', ${range} given.`
      );
    }

    const [, startBracket, start, end, endBracket] = match;

    let startNum = parseInt(start, 10);
    let endNum = parseInt(end, 10);

    if (startBracket === '(') {
      startNum += 1;
    }
    if (endBracket === ')') {
      endNum -= 1;
    }

    if (startNum === endNum) {
      return [startNum];
    }

    const list = [];
    for (var i = startNum; i <= endNum; i++) {
      list.push(i);
    }
    return list;
  };

  const getTickFormat = () => {
    const range = to.getTime() - from.getTime();
    if (range < 60000) {
      return d3.timeFormat('%H:%M:%S.%L'); // Show date and time
    } else if (range < 86400000) {
      return d3.timeFormat('%H:%M:%S'); // Show time
    } else {
      return d3.timeFormat('%d-%m-%y'); // Show time with milliseconds
    }
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

  const fetchData = async (from: Date, to: Date, metadata: Metadata) => {
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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort the previous request
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    let chartWidth;
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

    const request: Query = {
      query: {
        from: dayjs(fromQuery).toDate(),
        to: dayjs(toQuery).toDate(),
        measures: measures.map(({ id }) => id),
        viewPort: {
          width: chartWidth - margin.left - margin.right,
          height: Math.floor(chartHeight / measures.length - margin.bottom - margin.top),
        },
        accuracy: accuracy,
      },
      schema: schema,
      table: table,
    };

    let startTime = performance.now();
    try {
      const queryResultsCached = await apiService.getData(
        datasource,
        queryToQueryDto(request),
        controller.signal
      );

      if (!queryResultsCached) {
        return;
      }
      setQueryResults(queryResultsCached);
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

    let endTime = performance.now();
    setResponseTime(endTime - startTime);
  };

  const fetchRawData = async (from: Date, to: Date, metadata: Metadata) => {
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

    if (abortControllerRawRef.current) {
      abortControllerRawRef.current.abort(); // Abort the previous request
    }

    const controller = new AbortController();
    abortControllerRawRef.current = controller;

    setLoading(true);

    let chartWidth = Math.floor(d3.select('#chart-content').node().getBoundingClientRect().width);
    setWidth(chartWidth);

    const requestRaw: Query = {
      query: {
        from: dayjs(fromQuery).toDate(),
        to: dayjs(toQuery).toDate(),
        measures: measures.map(({ id }) => id),
        viewPort: {
          width: chartWidth - margin.left - margin.right,
          height: Math.floor(height / measures.length - margin.bottom - margin.top),
        },
        accuracy: 1,
      },
      schema: schema,
      table: table,
    };

    const startTime = performance.now();
    try {
      const queryResultsRaw = await apiService.getData(
        datasource,
        queryToQueryDto(requestRaw),
        controller.signal
      );

      if (!queryResultsRaw) {
        return;
      }
      setQueryResultsRaw(queryResultsRaw);
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
    const endTime = performance.now();
    setResponseTimeRaw(endTime - startTime);
  };

  const handleTableChange = (event: MouseEvent<HTMLElement>, table: string) => {
    setTable(table);
    clearMeasures();
  };

  const handleSelectMeasures = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;

    const selectedMeasures = typeof value === 'string' ? value.split(',') : value;

    const selectedObjects = metadata?.measures.filter((measure) =>
      selectedMeasures.includes(measure.name)
    );

    setMeasures(selectedObjects ?? []);
  };

  const decreaseAccuracy = () =>
    setAccuracy((prev) => {
      if (prev <= min) {
        return min;
      }
      return Math.max(min, +(prev - step).toFixed(2));
    });

  const increaseAccuracy = () =>
    setAccuracy((prev) => {
      if (prev >= max) {
        return max;
      }
      return Math.min(max, +(prev + step).toFixed(2));
    });

  const handleAccuracyChange = (event: SyntheticEvent | Event, value: number | number[]) => {
    if (typeof value === 'number') {
      setAccuracy(value);
    }
  };

  const debouncedFetchData = useDebouncedCallback(
    (from, to, metadata) => fetchData(from, to, metadata!),
    100
  );

  const debouncedFetchRawData = useDebouncedCallback(
    (from, to, metadata) => fetchRawData(from, to, metadata!),
    100
  );

  const addRect = (
    { x, y }: { x: number; y: number },
    color: string,
    containerHeight: number,
    svg: any
  ) => {
    const cx = Math.floor(x + margin.left + 1 / window.devicePixelRatio);
    const cy = Math.floor(containerHeight - y);

    const rect = svg
      .append('rect')
      .attr('class', 'error-pixel')
      .attr('x', cx)
      .attr('y', cy)
      .attr('width', 1 / window.devicePixelRatio)
      .attr('height', 1 / window.devicePixelRatio)
      .style('fill', `${color}`);

    rect
      .on('mouseover', (elem: SVGRectElement) => {
        const tooltipGroup = svg.append('g').attr('class', 'tooltip-group');
        const horizontalOffset = cx > 900 ? -50 : 0;
        const verticalOffset = cy < 25 ? 50 : -15;
        const text = tooltipGroup
          .append('text')
          .attr('class', 'tooltip')
          .style('text-anchor', 'middle')
          .text(`x: ${x}, y: ${y}\ncx: ${cx}, cy: ${cy}`)
          .attr('fill', 'white')
          .attr('x', cx + horizontalOffset)
          .attr('y', cy + verticalOffset);

        const bbox = text.node().getBBox();

        tooltipGroup
          .insert('rect', 'text')
          .attr('x', bbox.x - 10)
          .attr('y', bbox.y - 5)
          .attr('width', bbox.width + 20)
          .attr('height', bbox.height + 10)
          .attr('rx', 5)
          .attr('ry', 5)
          .style('fill', 'grey')
          .style('stroke', 'black')
          .style('stroke-width', '1px');
      })
      .on('mouseout', () => {
        d3.selectAll('.tooltip-group').remove();
      });
  };

  const renderChart = (
    selector: string,
    data: { timestamp: number; value: number }[],
    width: number,
    height: number,
    measure?: number
  ) => {
    const containerWidth = width - margin.left - margin.right;

    const svg = d3.select(selector);
    svg.selectAll('*').remove(); // Clear previous render

    const chartPlane = svg.append('g');

    // Convert x to Date from timestamp
    const formattedData = data.map((d: any) => [new Date(d.timestamp), d.value] as [Date, number]);

    // Set up scales
    let minTs = new Date(
      Math.max(d3.min(formattedData, (d: any) => d[0].getTime()) as number, from.getTime())
    );
    let maxTs = new Date(
      Math.min(d3.max(formattedData, (d: any) => d[0].getTime()) as number, to.getTime())
    );

    if (queryResults!.timeRange) {
      minTs = new Date(queryResults!.timeRange.from);
      maxTs = new Date(queryResults!.timeRange.to);
    }

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

    // Add data points as small rectangles (1x1 pixels)
    const datapoints = formattedData.map((d: any) => ({
      x: Math.floor(x(d[0])),
      y: Math.floor(y(d[1])),
    }));

    deduplicatePixels(datapoints).forEach((datapoint: any) => {
      chartPlane
        .append('rect')
        .attr('class', 'point') // Center the rectangle on the x coordinate
        .attr('x', datapoint.x) // Center the rectangle on the x coordinate
        .attr('y', datapoint.y) // Center the rectangle on the y coordinate
        .attr('width', 1 / window.devicePixelRatio)
        .attr('height', 1 / window.devicePixelRatio)
        .style('shape-rendering', 'crispEdges')
        .attr('fill', 'purple');
    });

    if (measure) {
      const pixels = pixelArrayToCoordinates(queryResults!.litPixels[measure]);
      const str8Line45 = generateLine({ x: 0, y: 150 }, pixels.length, 0);
      const str8LineM45 = generateLine({ x: 0, y: 100 }, pixels.length, 0);
      const sineWave1 = generateSineWave({ x: 0, y: 150 }, pixels.length, 10, 0.1, 0, 0);
      const sineWave2 = generateSineWave({ x: 0, y: 150 }, pixels.length, 10, 0.1, Math.PI, 0);

      const ssim = calculateSSIM(str8Line45, str8LineM45);

      str8Line45.forEach((datapoint: any) => {
        chartPlane
          .append('rect')
          .attr('class', 'point') // Center the rectangle on the x coordinate
          .attr('x', datapoint.x + margin.left + 1) // Center the rectangle on the x coordinate
          .attr('y', height - (datapoint.y + margin.bottom) - 2) // Center the rectangle on the y coordinate
          .attr('width', 5 / window.devicePixelRatio)
          .attr('height', 5 / window.devicePixelRatio)
          .style('shape-rendering', 'crispEdges')
          .attr('fill', 'blue');
      });

      str8LineM45.forEach((datapoint: any) => {
        chartPlane
          .append('rect')
          .attr('class', 'point') // Center the rectangle on the x coordinate
          .attr('x', datapoint.x + margin.left + 1) // Center the rectangle on the x coordinate
          .attr('y', height - (datapoint.y + margin.bottom) - 2) // Center the rectangle on the y coordinate
          .attr('width', 5 / window.devicePixelRatio)
          .attr('height', 5 / window.devicePixelRatio)
          .style('shape-rendering', 'crispEdges')
          .attr('fill', 'red');
      });

      const text = svg
        .append('text')
        .attr('class', 'info')
        .style('text-anchor', 'left')
        .style('stroke-width', '1px')
        .attr('font-size', 'smaller')
        .text(`SSIM: ${ssim}`)
        .attr('x', 0 + margin.left + 5)
        .attr('y', margin.top + margin.bottom);
    }
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
  };

  const renderErrorPixels = (selector: string, error: ErrorDto, height: number) => {
    const svg = d3.select(selector);

    if (isFalsePixelsVisible) {
      pixelArrayToCoordinates(error.falsePixels).map(
        ({ x, y }: { x: number; y: number }, index: number) => {
          addRect({ x, y: y }, 'red', height, svg);
        }
      );
    }

    if (isMissingPixelsVisible) {
      pixelArrayToCoordinates(error.missingPixels).map(
        ({ x, y }: { x: number; y: number }, index: number) => {
          addRect({ x, y: y }, 'orange', height, svg);
        }
      );
    }

    const tooltipGroup = svg.append('g').attr('class', 'info-group');
    const text = tooltipGroup
      .append('text')
      .attr('class', 'info')
      .style('text-anchor', 'middle')
      .style('stroke-width', '1px')
      .attr('font-size', 'smaller')
      .text(`Max Error: ${round(error.error * 100)}%`)
      .attr('x', width - margin.left - margin.right - 25)
      .attr('y', margin.top + margin.bottom);

    const bbox = text.node()?.getBBox();

    if (!bbox) return;

    tooltipGroup
      .insert('rect', 'text')
      .attr('x', bbox.x - 10)
      .attr('y', bbox.y - 5)
      .attr('width', bbox.width + 20)
      .attr('height', bbox.height + 10)
      .style('fill', 'lightgrey')
      .style('stroke', 'black')
      .style('stroke-width', '1px');
  };

  // reset zoom
  useEffect(() => {
    if (!queryResults || (!queryResultsRaw && isCompareVisible) || selectedChart !== null) return;

    const series = Object.values(queryResults!.data);
    series.map((_, index) => {
      const svg = d3.select(`#svg${index}`);
      svg.call(d3.zoom().transform, d3.zoomIdentity);
    });
  }, [queryResults, queryResultsRaw]);

  // reset zoom in modal
  useEffect(() => {
    if (!queryResults || (!queryResultsRaw && isCompareVisible) || selectedChart === null) return;

    const svg = d3.select(`#svg${selectedChart}-modal`);
    svg.call(d3.zoom().transform, d3.zoomIdentity);
  }, [queryResults, queryResultsRaw]);

  // render chart
  useEffect(() => {
    if (!queryResults || (!queryResultsRaw && isCompareVisible) || selectedChart !== null) return;

    const series = Object.values(queryResults.data);
    const measure = Object.keys(queryResults.data);

    series.map((data, index) => {
      renderChart(
        `#svg${index}`,
        data,
        width,
        Math.floor(height / measures.length),
        parseInt(measure[index])
      );
      if (isCompareVisible) {
        renderChart(
          `#svg${index}_raw`,
          Object.values(queryResultsRaw!.data)[index],
          width,
          Math.floor(height / measures.length),
          parseInt(measure[index])
        );
      }
    });
  }, [
    queryResults,
    queryResultsRaw,
    metadata,
    height,
    isFalsePixelsVisible,
    isMissingPixelsVisible,
  ]);

  // render chart in modal
  useEffect(() => {
    if (!queryResults || (!queryResultsRaw && isCompareVisible) || selectedChart === null) return;

    renderChart(
      `#svg${selectedChart}-modal`,
      queryResults.data[selectedChart],
      modalWidth,
      modalHeight
    );
  }, [
    queryResults,
    metadata,
    modalHeight,
    isFalsePixelsVisible,
    isMissingPixelsVisible,
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

  // render error pixels
  useEffect(() => {
    if (!queryResults || !measures || selectedChart !== null) return;

    const errors = Object.values(queryResults.error);

    let chartHeight = Math.floor(height / measures.length);

    const containerHeight = chartHeight - margin.bottom - 1;

    errors.map((error: ErrorDto, index: number) => {
      renderErrorPixels(`#svg${index} > g`, error, containerHeight);
    });
  }, [queryResults, metadata, height, isFalsePixelsVisible, isMissingPixelsVisible]);

  // render error pixels in modal
  useEffect(() => {
    if (!queryResults || !measures || selectedChart === null) return;

    const error = queryResults.error[selectedChart];

    const containerHeight = modalHeight - margin.top;
    renderErrorPixels(`#svg${selectedChart}-modal > g`, error, containerHeight);
  }, [queryResults, metadata, height, isFalsePixelsVisible, isMissingPixelsVisible]);

  // fetch metadata
  useEffect(() => {
    fetchMetadata();
  }, [table, datasource, schema]);

  // fetch data
  useEffect(() => {
    if (!metadata || !from || !to || !measures.length) {
      return;
    }

    debouncedFetchData(from, to, metadata!);

    if (isCompareVisible) {
      debouncedFetchRawData(from, to, metadata);
    }
  }, [
    from,
    to,
    metadata,
    measures,
    height,
    width,
    schema,
    table,
    accuracy,
    selectedChart,
    isCompareVisible,
  ]);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="relative">
        <Toolbar variant="dense">
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Big Data Chart
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ pt: 2, px: 1 }}>
        <Grid container spacing={2}>
          <Grid size={3}>
            <Card variant="outlined" sx={{ p: 1 }}>
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
                    <Grid size={12}>
                      <Box
                        display={'flex'}
                        flexDirection={'column'}
                        justifyContent={'space-between'}
                        flexGrow={2}
                      >
                        <Typography variant="body1" gutterBottom>
                          Accuracy: {accuracy}
                        </Typography>
                        <Box
                          display={'flex'}
                          flexDirection={'row'}
                          alignItems={'center'}
                          justifyContent={'space-between'}
                          gap={1}
                        >
                          <IconButton
                            aria-label="decrease accuracy"
                            size="small"
                            color={'primary'}
                            onClick={decreaseAccuracy}
                            disabled={accuracy <= min || loading}
                          >
                            <RemoveIcon fontSize="inherit" />
                          </IconButton>
                          <Slider
                            onChange={handleAccuracyChange}
                            value={accuracy}
                            disabled={loading}
                            min={min}
                            max={max}
                            step={step}
                            shiftStep={step}
                            size="small"
                            aria-label="Accuracy"
                            valueLabelDisplay="auto"
                          />
                          <IconButton
                            aria-label="increase accuracy"
                            size="small"
                            color={'primary'}
                            onClick={increaseAccuracy}
                            disabled={accuracy >= max || loading}
                          >
                            <AddIcon fontSize="inherit" />
                          </IconButton>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Grid>
                <Grid size={12}>
                  <Typography variant="overline">Table</Typography>
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
                  <Typography variant="overline">Error pixels</Typography>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Switch
                          value={isFalsePixelsVisible}
                          defaultChecked
                          color="error"
                          size="small"
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            setIsFalsePixelsVisible(event.target.checked)
                          }
                        />
                      }
                      label="False pixels"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          value={isMissingPixelsVisible}
                          defaultChecked
                          color="warning"
                          size="small"
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            setIsMissingPixelsVisible(event.target.checked)
                          }
                        />
                      }
                      label="Missing pixels"
                    />
                  </FormGroup>
                </Grid>
                <Grid size={12}>
                  <Typography variant="overline">Compare with raw data</Typography>
                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          value={isCompareVisible}
                          color="primary"
                          size="small"
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            setIsCompareVisible(event.target.checked)
                          }
                        />
                      }
                      label="Show raw data"
                    />
                  </FormGroup>
                </Grid>
                {!!responseTime && (
                  <Grid size={12}>
                    <Typography variant="overline">Response time</Typography>
                    <Box>
                      <ResponseTimes series={getResponseTimeSeries()} />
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Card>
          </Grid>
          <Grid size={9}>
            {!queryResults || (!queryResultsRaw && isCompareVisible)}
            {!measures.length ? (
              <Card variant="outlined">
                <CardContent id="chart-content">
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                    Select at least one measure to display
                  </Typography>
                </CardContent>
              </Card>
            ) : !queryResults || (!queryResultsRaw && isCompareVisible) ? (
              <Card variant="outlined">
                <CardContent id="chart-content">
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                    <CircularProgress size={'3rem'} />
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <>
                {Object.values(queryResults!.data).map((_, index) => (
                  <Card variant="outlined" key={`svg${index}`}>
                    <CardContent>
                      <Box sx={{ transform: 'translate(0, 0)' }} id="chart-content">
                        <Box
                          display="flex"
                          flexDirection={'row'}
                          flexWrap={'nowrap'}
                          alignContent={'center'}
                          alignItems={'center'}
                          justifyContent={'space-between'}
                        >
                          <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary', fontSize: 14 }}
                          >
                            {measures[index]?.name}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedChart(measures[index]?.id);
                              setIsModalOpen(true);
                            }}
                          >
                            <OpenInFullIcon fontSize={'small'} />
                          </IconButton>
                        </Box>
                        <Box>
                          {loading && (
                            <Box
                              sx={{
                                width: '100%',
                                height: '100%',
                                position: 'absolute',
                              }}
                            >
                              <CircularProgress
                                size={'3rem'}
                                sx={{
                                  position: 'fixed',
                                  top: '50%',
                                  left: '50%',
                                  marginTop: '-12px',
                                  marginLeft: '-12px',
                                  transform: 'translate(50%,-50%)',
                                }}
                              />
                            </Box>
                          )}
                          <svg
                            id={`svg${index}`}
                            width={width}
                            height={Math.floor(height / measures.length)}
                          />
                        </Box>
                        {isCompareVisible && (
                          <>
                            <Box
                              display="flex"
                              flexDirection={'row'}
                              flexWrap={'nowrap'}
                              alignContent={'center'}
                              alignItems={'center'}
                              justifyContent={'space-between'}
                            >
                              <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary', fontSize: 14 }}
                              >
                                {measures[index]?.name} raw data
                              </Typography>
                            </Box>
                            <svg
                              id={`svg${index}_raw`}
                              width={width}
                              height={Math.floor(height / measures.length)}
                            />
                          </>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </>
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
            <svg id={`svg${selectedChart}-modal`} width={modalWidth} height={modalHeight} />
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
