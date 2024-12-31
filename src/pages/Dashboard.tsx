import { MouseEvent, SyntheticEvent, useEffect, useState, useRef, Fragment } from 'react';
import * as d3 from 'd3';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import apiService from 'api/apiService';
import { useDebouncedCallback } from 'use-debounce';
import axios from 'axios';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import AppBar from '@mui/material/AppBar';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import CardContent from '@mui/material/CardContent';

import { Measure, Metadata, metadataDtoToDomain } from '../interfaces/metadata';
import { ErrorDto, QueryResultsDto } from '../interfaces/data';
import { Query, queryToQueryDto } from '../interfaces/query';
import { Toolbar } from '@mui/material';

const Dashboard = () => {
  const [loading, setLoading] = useState<boolean>(false);

  const [from, setFrom] = useState<Date>(dayjs(1330144930991).toDate());
  const [to, setTo] = useState<Date>(dayjs(1330244930991).toDate());
  const [height, setHeight] = useState<number>(400);
  const [width, setWidth] = useState<number>(1000);
  const [accuracy, setAccuracy] = useState<number>(0.95);

  const [measures, setMeasures] = useState<Measure[]>([]);

  const [datasource, setDatasource] = useState<string>('influx');
  const [schema, setSchema] = useState<string>('more');
  const [table, setTable] = useState<string>('intel_lab_exp');

  const [metadata, setMetadata] = useState<Metadata>();
  const [queryResults, setQueryResults] = useState<QueryResultsDto>();

  const abortControllerRef = useRef<AbortController | null>(null);

  const margin = { top: 20, right: 0, bottom: 20, left: 40 };
  const min = 0;
  const max = 1;
  const step = 0.05;

  const pixelArrayToCooordinates = (pixelArray: string[][]): { x: number; y: number }[] =>
    pixelArray
      .map((range, index) => {
        if (!range.length) return null;

        return {
          column: index,
        };
      })
      .filter((range) => range)
      .flatMap((range) =>
        pixelArray[range!.column]
        .flatMap(parseRange)
        .map((y) => ({
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

  const getTickFormat = (scale: number) => {
    if (scale < 2500) {
      return d3.timeFormat('%d-%m-%Y %H:%M'); // Show date and time
    } else if (scale < 81000000) {
      return d3.timeFormat('%H:%M:%S'); // Show time
    } else {
      return d3.timeFormat('%H:%M:%S.%L'); // Show time with milliseconds
    }
  };

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const response = await apiService.getMetadata(datasource, schema, table);

      setMetadata(metadataDtoToDomain(response.data));
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
    if (!height || !width) {
      return;
    }

    if (from.getTime() < metadata.timeRange.from || to.getTime() > metadata.timeRange.to) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort the previous request
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    const request: Query = {
      query: {
        from: from,
        to: to,
        measures: measures.map(({ id }) => id),
        viewPort: {
          width: width - margin.left - margin.right,
          height: height / measures.length - margin.bottom - margin.top,
        },
        accuracy: accuracy,
      },
      schema: schema,
      table: table,
    };

    try {
      const queryResults = await apiService.getData(
        datasource,
        queryToQueryDto(request),
        controller.signal
      );

      if (!queryResults) {
        return;
      }

      setQueryResults(queryResults);
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

  const handleDatasourceChange = (event: MouseEvent<HTMLElement>, datasource: string) => {
    setDatasource(datasource);
  };

  const handleSchemaChange = (event: MouseEvent<HTMLElement>, schema: string) => {
    setSchema(schema);
  };

  const handleTableChange = (event: MouseEvent<HTMLElement>, table: string) => {
    setTable(table);
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

  const addCircle = (
    { x, y }: { x: number; y: number },
    color: string,
    containerHeight: number,
    svg: any
  ) => {
    const cx = x + margin.left + margin.right;
    const cy = containerHeight - y;
    const circle = svg
      .append('circle')
      .attr('cx', x + margin.left + margin.right)
      .attr('cy', containerHeight - y)
      .attr('r', '1px')
      .style('fill', `${color}`);

    circle
      .on('mouseover', (elem: SVGCircleElement) => {
        const tooltipGroup = svg.append('g').attr('class', 'tooltip-group');
        const horizontalOffset = cx > 900 ? -50 : 0;
        const verticalOffset = cy < 25 ? 50 : -15;
        const text = tooltipGroup
          .append('text')
          .attr('class', 'tooltip')
          .style('text-anchor', 'middle')
          .text(`x: ${x}, y: ${y}`)
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

  // reset zoom
  useEffect(() => {
    if (!queryResults) return;

    const series = Object.values(queryResults!.data);
    series.map((_, index) => {
      const svg = d3.select(`#svg${index}`);
      svg.call(d3.zoom().transform, d3.zoomIdentity);
    });
  }, [queryResults]);

  // render chart
  useEffect(() => {
    if (!queryResults) return;

    const series = Object.values(queryResults.data);

    let chartHeight = height / measures.length;

    const containerWidth = width - margin.left - margin.right;
    const containerHeight = chartHeight - margin.top - margin.bottom;

    series.map((data, index) => {
      const svg = d3.select(`#svg${index}`);
      svg.selectAll('*').remove(); // Clear previous render

      const chartPlane = svg.append('g');
      // Convert x to Date from timestamp
      const formattedData = data.map((d) => [new Date(d.timestamp), d.value] as [Date, number]);

      // Set up scales
      const minTs = d3.min(formattedData, (d: any) => d[0]) as Date;
      const maxTs = d3.max(formattedData, (d: any) => d[0]) as Date;
      const x = d3
        .scaleTime()
        .domain([minTs, maxTs])
        .range([margin.left, width - margin.right]);

      const minValue = d3.min(formattedData, (d: any) => d[1]);
      const maxValue = d3.max(formattedData, (d: any) => d[1]);
      const y = d3
        .scaleLinear()
        .domain([minValue, maxValue])
        .range([chartHeight - margin.bottom, margin.top]);

      // Function to add X gridlines
      const makeXGridlines = () => d3.axisBottom(x);

      // Function to add Y gridlines
      const makeYGridlines = () => d3.axisLeft(y).ticks(7).tickValues([...y.ticks(7), y.domain()[1]]);

      // Add X gridlines
      chartPlane
        .append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0, ${chartHeight})`)
        .call(
          makeXGridlines()
            .tickSize(-height / measures.length + margin.top) // Extend lines down to the bottom
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
        .attr('transform', `translate(0, ${chartHeight - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat('%d-%m-%Y %H:%M')));

      // Y Axis
      chartPlane
        .append('g')
        .attr('transform', `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y).ticks(7));

      chartPlane
        .append('g')
        .selectAll('rect')
        .data(formattedData)
        .enter()
        .append('rect')
        .attr('class', 'point')
        .attr('x', (d: any) => x(d[0]))
        .attr('y', (d: any) => y(d[1]))
        .attr('width', 1)
        .attr('height', 1)
        .attr('fill', 'steelblue');

      // Add path
      const line = d3
        .line()
        .x((d: any) => x(d[0]))
        .y((d: any) => y(d[1]))
        .curve(d3.curveMonotoneX);

      const path = chartPlane
        .append('path')
        .attr('class', 'path')
        .datum(formattedData)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1)
        .attr('d', line);

      const zoom = d3
        .zoom()
        .on('zoom', (event: any) => {
          const newX = event.transform.rescaleX(x);
          xAxis.call(d3.axisBottom(newX).ticks(7).tickFormat(getTickFormat(event.transform.k)));

          path.attr(
            'd',
            d3
              .line()
              .x((d: any) => newX(d[0]))
              .y((d: any) => y(d[1]))
              .curve(d3.curveMonotoneX)
          );

          chartPlane
            .selectAll('.point')
            .attr('x', (d: any) => newX(d[0]))
            .attr('y', (d: any) => y(d[1]));

          svg.selectAll('circle').remove();
        })
        .on('end', (event: any) => {
          const newX = event.transform.rescaleX(x);
          const [start, end] = newX.domain().map((d: any) => dayjs(d.getTime()).toDate());
          setFrom(start);
          setTo(end);
          fetchData(start, end, metadata!);
        });

      svg.call(zoom);
    });
  }, [queryResults, metadata, height]);

  // render error pixels
  useEffect(() => {
    if (!queryResults) return;

    const errors = Object.values(queryResults.error);

    let chartHeight = height / measures.length;

    const containerHeight = chartHeight - margin.top;
    errors.map((error: ErrorDto, index: number) => {
      const svg = d3.select(`#svg${index} > g`);

      pixelArrayToCooordinates(error.falsePixels).map(
        ({ x, y }: { x: number; y: number }, index: number) => {
          addCircle({ x, y }, 'red', containerHeight, svg);
        }
      );

      pixelArrayToCooordinates(error.missingPixels).map(
        ({ x, y }: { x: number; y: number }, index: number) => {
          addCircle({ x, y }, 'orange', containerHeight, svg);
        }
      );

      const tooltipGroup = svg.append('g').attr('class', 'info-group');
      const text = tooltipGroup
        .append('text')
        .attr('class', 'info')
        .style('text-anchor', 'middle')
        .style('stroke-width', '1px')
        .attr('font-size', 'smaller')
        .text(`Error: ${error.error}`)
        .attr('x', width - margin.left - margin.right - 67)
        .attr('y', margin.top + margin.bottom);

      const bbox = text.node().getBBox();

      tooltipGroup
        .insert('rect', 'text')
        .attr('x', bbox.x - 10)
        .attr('y', bbox.y - 5)
        .attr('width', bbox.width + 20)
        .attr('height', bbox.height + 10)
        .style('fill', 'lightgrey')
        .style('stroke', 'black')
        .style('stroke-width', '1px');
    });
  }, [queryResults, metadata, height]);

  // fetch metadata
  useEffect(() => {
    fetchMetadata();
  }, [table, datasource, schema]);

  // fetch data
  useEffect(() => {
    if (!metadata || !from || !to || !measures.length) {
      return;
    }
    debouncedFetchData(from, to, metadata);
  }, [from, to, metadata, measures, height, width, schema, table, accuracy]);

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
              <Box>
                <Typography variant="overline">Parameters</Typography>
                <Grid container spacing={2} sx={{ pb: 1 }} alignItems={'center'}>
                  <Grid size={12}>
                    <DateTimePicker
                      label="From"
                      maxDate={dayjs(to)}
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
                      <Typography gutterBottom>Min. Accuracy: {accuracy}</Typography>
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
              </Box>
              <Divider />
              <Box>
                <Typography variant="overline">Datasource</Typography>
                <List component="nav" aria-label="datasource">
                  <ListItemButton
                    disabled={loading}
                    selected={datasource === 'influx'}
                    onClick={(event) => handleDatasourceChange(event, 'influx')}
                  >
                    <ListItemText primary="influx" />
                  </ListItemButton>
                  <ListItemButton
                    disabled={true}
                    selected={datasource === 'postgres'}
                    onClick={(event) => handleDatasourceChange(event, 'postgres')}
                  >
                    <ListItemText primary="postgres" />
                  </ListItemButton>
                </List>
              </Box>
              <Divider />
              <Box>
                <Typography variant="overline">Schema</Typography>
                <List component="nav" aria-label="schema">
                  <ListItemButton
                    disabled={loading}
                    selected={schema === 'more'}
                    onClick={(event) => handleSchemaChange(event, 'more')}
                  >
                    <ListItemText primary="more" />
                  </ListItemButton>
                </List>
              </Box>
              <Divider />
              <Box>
                <Typography variant="overline">Table</Typography>
                <List component="nav" aria-label="table">
                  <ListItemButton
                    disabled={loading}
                    selected={table === 'intel_lab_exp'}
                    onClick={(event) => handleTableChange(event, 'intel_lab_exp')}
                  >
                    <ListItemText primary="intel_lab_exp" />
                  </ListItemButton>
                  <ListItemButton
                    disabled={loading}
                    selected={table === 'manufacturing_exp'}
                    onClick={(event) => handleTableChange(event, 'manufacturing_exp')}
                  >
                    <ListItemText primary="manufacturing_exp" />
                  </ListItemButton>
                </List>
              </Box>
              <Divider />
              <Box>
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
              </Box>
            </Card>
          </Grid>
          <Grid size={9}>
            {!measures.length ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                    Select at least one measure to display
                  </Typography>
                </CardContent>
              </Card>
            ) : !queryResults ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography sx={{ color: 'text.secondary', fontSize: 14, textAlign: 'center' }}>
                    No data
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Card variant="outlined">
                <CardContent>
                  {Object.values(queryResults.data).map((_, index) => (
                    <Fragment key={`svg${index}`}>
                      <Typography variant='body1' sx={{ color: 'text.secondary', fontSize: 14 }}>
                        {measures[index]?.name}
                      </Typography>
                      <svg id={`svg${index}`} width={width} height={height / measures.length} />
                    </Fragment>
                  ))}
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default Dashboard;
