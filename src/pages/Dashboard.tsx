import {MouseEvent, SyntheticEvent, useEffect, useState, useRef} from 'react';
import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
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
import Switch from '@mui/material/Switch';
import {useDebouncedCallback} from 'use-debounce';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Toolbar from '@mui/material/Toolbar';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import CircularProgress from '@mui/material/CircularProgress';

import {Measure, Metadata, metadataDtoToDomain} from '../interfaces/metadata';
import {ErrorDto, QueryResultsDto} from '../interfaces/data';
import {Query, queryToQueryDto} from '../interfaces/query';
import ResponseTimes from "components/ProgressBar";

const round = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

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

  // multiple results by algorithm
  const [queryResults, setQueryResults] = useState<Record<string, QueryResultsDto | undefined>>({});

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedChart, setSelectedChart] = useState<number | null>(null);

  // multiple response times by algoirthm
  const [responseTimes, setResponseTimes] = useState<Record<string, number>>({});
  // algorithms array
  const [algorithms, setAlgorithms] = useState<string[]>(['MinMaxCache']);

  // a dictionary of AbortControllers keyed by algorithm
  const abortControllersRef = useRef<{ [algo: string]: AbortController | null }>({});

  const margin = {top: 20, right: 0, bottom: 20, left: 40};
  const min = 0;
  const max = 1;
  const step = 0.01;

  const clearMeasures = () => setMeasures([]);

  // returning an array of { dataset, query, response }
  const getResponseTimeSeries = (): any[] => {
    const series = [];
    for (const algo of algorithms) {
      const res = queryResults[algo];
      const time = responseTimes[algo];
      if (res && time) {
        series.push({
          dataset: algo,
          // If queryTime is in seconds, multiply by 1000 to get ms
          query: (res.queryTime || 0) * 1000,
          response: time,
        });
      }
    }
    return series;
  };

  const pixelArrayToCoordinates = (pixelArray: string[][]): { x: number; y: number }[] =>
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
    // if (range < 60000) {
    //   return d3.timeFormat('%H:%M:%S.%L'); // Show date and time
    // } else if (range < 86400000) {
    //   return d3.timeFormat('%H:%M:%S'); // Show time
    // } else {
    //   return d3.timeFormat('%d-%m-%y'); // Show time with milliseconds
    // }
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

  // pass algorithm also
  const fetchData = async (algorithm: string, from: Date, to: Date, metadata: Metadata) => {
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

    if (abortControllersRef.current[algorithm]) {
      abortControllersRef.current[algorithm]!.abort();
    }
    const controller = new AbortController();
    abortControllersRef.current[algorithm] = controller;

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
        measures: measures.map(({id}) => id),
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
        [algorithm]: queryResults,
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
      setLoading(false);
    }
    let endTime = performance.now();
    setResponseTimes((prev) => ({
      ...prev,
      [algorithm]: endTime - startTime,
    }));
  };

  const handleTableChange = (event: MouseEvent<HTMLElement>, table: string) => {
    setTable(table);
    clearMeasures();
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

  const handleAlgorithmChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    // value is string[] of selected algorithms
    const newAlgos = typeof value === 'string' ? value.split(',') : value;

   // 1. Remove any old algorithms from queryResultsByAlgorithm
    setQueryResults((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (!newAlgos.includes(key)) {
          delete updated[key];
        }
      });
      return updated;
    });

    // 2. Remove any old algorithms from responseTimes
    setResponseTimes((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (!newAlgos.includes(key)) {
          delete updated[key];
        }
      });
      return updated;
    });

    // 3. Now set the new 'algorithms' state
    setAlgorithms(newAlgos);
  };

  const debouncedFetchAll = useDebouncedCallback(
    async (algos: string[], from, to, metadata) => {
      // Loop over each algorithm in sequence
      for (const algo of algos) {
        await fetchData(algo, from, to, metadata);
      }
    },
    100
  );

  const addRect = (
    {x, y}: { x: number; y: number },
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
    timeRange: { from: number; to: number }
  ) => {
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

    // Add data points as small rectangles (1x1 pixels) 
    // formattedData.forEach((d: any) => {
    //   chartPlane
    //     .append('rect')
    //     .attr('class', 'point') // Center the rectangle on the x coordinate
    //     .attr('x', Math.floor(x(d[0]))) // Center the rectangle on the x coordinate
    //     .attr('y', Math.floor(y(d[1]))) // Center the rectangle on the y coordinate
    //     .attr('width', 1 / window.devicePixelRatio)
    //     .attr('height', 1 / window.devicePixelRatio)
    //     .style('shape-rendering', 'crispEdges')
    //     .attr('fill', 'purple');
    // });

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
        ({x, y}: { x: number; y: number }, index: number) => {
          addRect({x, y: y}, 'red', height, svg);
        }
      );
    }

    if (isMissingPixelsVisible) {
      pixelArrayToCoordinates(error.missingPixels).map(
        ({x, y}: { x: number; y: number }, index: number) => {
          addRect({x, y: y}, 'orange', height, svg);
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
      .text(`Error: ${round(error.error * 100)}%`)
      .attr('x', width - margin.left - margin.right - 10)
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
    if (!measures.length) return;
    for (const algo of algorithms) {
      const res = queryResults[algo];
      if (!res) continue;
      const series = Object.values(res.data);
      series.forEach((_, index) => {
        const svg = d3.select(`#svg_${algo}_${index}`);
        svg.call(d3.zoom().transform, d3.zoomIdentity);
      });
    }
  }, [queryResults, measures, algorithms]);

  // reset zoom in modal
  useEffect(() => {
    if (selectedChart === null) return;
    for (const algo of algorithms) {
      const svg = d3.select(`#svg_${algo}_${selectedChart}-modal`);
      svg.call(d3.zoom().transform, d3.zoomIdentity);
    }
  }, [selectedChart, algorithms]);

  // render chart
  useEffect(() => {
    if (!measures.length || !queryResults) return;

    for (const algo of algorithms) {
      const res = queryResults[algo];
      if (!res) continue; // skip if not fetched yet

      const series = Object.values(res.data);
      const timeRange = res.timeRange;
      // For each measure index, we have series[index]
      series.forEach((data, index) => {
        renderChart(
          `#svg_${algo}_${index}`,
          data,
          width,
          Math.floor(height / measures.length),
          {from: timeRange.from, to: timeRange.to}
        );
      });
    }
  }, [
    queryResults,
    algorithms,
    metadata,
    height,
    isFalsePixelsVisible,
    isMissingPixelsVisible,
  ]);

  // render chart in modal
  useEffect(() => {
    if (!measures.length || !queryResults || selectedChart === null) return;

    for (const algo of algorithms) {
      const res = queryResults[algo];
      if (!res) continue;
      const series = Object.values(res.data);
      const timeRange = res.timeRange;
      // For each measure index, we have series[index]
      series.forEach((data, index) => {
        renderChart(
          `#svg_${algo}_${selectedChart}-modal`,
          data,
          modalWidth,
          Math.floor(modalHeight / algorithms.length),
          {from: timeRange.from, to: timeRange.to}
        );
      });
    }
  }, [
    queryResults,
    algorithms,
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
    
    for (const algo of algorithms) {
      const res = queryResults[algo];
      if (!res) continue;

      const errors = Object.values(res.error);
      const chartHeight = Math.floor(height / measures.length);
      const containerHeight = chartHeight - margin.bottom - 1;

      errors.forEach((err, index) => {
        renderErrorPixels(`#svg_${algo}_${index} > g`, err, containerHeight);
      });
    }
  }, [queryResults, metadata, height, isFalsePixelsVisible, isMissingPixelsVisible]);

  // render error pixels in modal
  useEffect(() => {
    if (!queryResults || !measures || selectedChart === null) return;

    for (const algo of algorithms) {
      const res = queryResults[algo];
      if (!res) continue;
      const err = res.error[selectedChart];
      const chartHeight = Math.floor(modalHeight / algorithms.length);
      const containerHeight = chartHeight - margin.top;
      renderErrorPixels(
        `#svg_${algo}_${selectedChart}-modal > g`,
        err,
        containerHeight
      );
    }
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
    debouncedFetchAll(algorithms, from, to, metadata);
  }, [
    from,
    to,
    algorithms,
    metadata,
    measures,
    height,
    width,
    schema,
    table,
    accuracy,
    selectedChart,
  ]);


  return (
    <Box sx={{flexGrow: 1}}>
      <AppBar position="relative">
        <Toolbar variant="dense">
          <Typography variant="h6" component="div" sx={{flexGrow: 1}}>
            Big Data Chart
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{pt: 2, px: 1}}>
        <Grid container spacing={2}>
          <Grid size={3}>
            <Card variant="outlined" sx={{p: 1}}>
              <Grid container spacing={1}>
                <Grid size={12}>
                  <Typography variant="overline">Parameters</Typography>
                  <Grid container spacing={2} sx={{pb: 1}} alignItems={'center'}>
                    <Grid size={12}>
                      <DateTimePicker
                        label="From"
                        minDateTime={dayjs(minDate)}
                        maxDateTime={dayjs(to)}
                        disabled={loading}
                        value={dayjs(from)}
                        slotProps={{textField: {size: 'small', fullWidth: true}}}
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
                        slotProps={{textField: {size: 'small', fullWidth: true}}}
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
                            <RemoveIcon fontSize="inherit"/>
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
                            <AddIcon fontSize="inherit"/>
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
                      <ListItemText primary="intel_lab_exp"/>
                    </ListItemButton>
                    <ListItemButton
                      dense
                      disabled={loading}
                      selected={table === 'manufacturing_exp'}
                      onClick={(event) => handleTableChange(event, 'manufacturing_exp')}
                    >
                      <ListItemText primary="manufacturing_exp"/>
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
                          <Chip key={value} label={value} style={{margin: 2}}/>
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
                <Typography variant="overline">Algorithms</Typography>
                <Select
                    multiple
                    fullWidth
                    size="small"
                    value={algorithms}
                    onChange={handleAlgorithmChange}
                    renderValue={(selected) => (
                      <div>
                        {(selected as string[]).map((val) => (
                          <Chip key={val} label={val} style={{ margin: 2 }} />
                        ))}
                      </div>
                    )}
                  >
                    {/* You can list more algorithms here */}
                    <MenuItem value="MinMaxCache">MinMaxCache</MenuItem>
                    <MenuItem value="M4">M4</MenuItem>
                    {/* Add more as needed */}
                  </Select>
                </Grid>
                {!!Object.keys(responseTimes).length && (
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
            {!queryResults}
            {!measures.length ? (
              <Card variant="outlined">
                <CardContent id="chart-content">
                  <Typography sx={{color: 'text.secondary', fontSize: 14, textAlign: 'center'}}>
                    Select at least one measure to display
                  </Typography>
                </CardContent>
              </Card>
            ) : !queryResults ? (
              <Card variant="outlined">
                <CardContent id="chart-content">
                  <Typography sx={{color: 'text.secondary', fontSize: 14, textAlign: 'center'}}>
                    {loading ? (
                      <>
                        <CircularProgress size={'3rem'}/>
                      </>
                    ) : (
                      'No data'
                    )}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              // Render measure-by-measure, and within each measure, render each algorithm’s chart
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

                    {/* For each selected algorithm, display a sub-chart for this measure */}
                    {algorithms.map((algo) => {
                      const algoResult = queryResults[algo];
                      // If there's no data yet for that algorithm, just show a loader or placeholder
                      if (!algoResult) {
                        return (
                          <Box
                            key={`chart_${algo}_${measureIndex}`}
                            height={Math.floor(height / measures.length)}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {loading ? (
                              <CircularProgress size={'3rem'} />
                            ) : (
                              <Typography
                                sx={{
                                  color: 'text.secondary',
                                  fontSize: 14,
                                  textAlign: 'center',
                                }}
                              >
                                No data for {algo}
                              </Typography>
                            )}
                          </Box>
                        );
                      }
                      return (
                        <Box key={`chart_${algo}_${measureIndex}`} position="relative">
                          {/* Algorithm label */}
                          <Typography variant="caption" sx={{ ml: 2 }}>
                            {algo}
                          </Typography>
                          {/* The actual chart */}
                          <svg
                            id={`svg_${algo}_${measureIndex}`}
                            width={width}
                            height={Math.floor(height / measures.length)}
                          />
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
              algorithms.map((algo) => (
                <svg
                  key={`svg_${algo}_${selectedChart}-modal`}
                  id={`svg_${algo}_${selectedChart}-modal`}
                  width={modalWidth}
                  height={modalHeight / algorithms.length}
                />
              ))}
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
