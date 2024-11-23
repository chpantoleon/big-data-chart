import React, {MouseEvent, SyntheticEvent, useEffect, useState, useRef} from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Chip from '@mui/material/Chip';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import apiService from "api/apiService";
import {useDebouncedCallback} from 'use-debounce';
import axios from "axios";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import AppBar from '@mui/material/AppBar';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';

import Chart from "components/Chart/Chart";
import {Metadata, metadataDtoToDomain} from "../interfaces/metadata";
import {QueryResultsDto} from "../interfaces/data";
import {Query, queryToQueryDto} from "../interfaces/query";
import {Toolbar} from "@mui/material";

const Dashboard = () => {
  const [loading, setLoading] = useState<boolean>(false)

  const [from, setFrom] = useState<Dayjs>(dayjs(1330144930991));
  const [to, setTo] = useState<Dayjs>(dayjs(1330244930991));
  const [height, setHeight] = useState<number>(400)
  const [width, setWidth] = useState<number>(800)
  const [accuracy, setAccuracy] = useState<number>(0.95)

  const [measures, setMeasures] = useState<number[]>([]);

  const [datasource, setDatasource] = useState<string>("influx")
  const [schema, setSchema] = useState<string>("more")
  const [table, setTable] = useState<string>("intel_lab_exp")

  const [metadata, setMetadata] = useState<Metadata>()
  const [queryResults, setQueryResults] = useState<QueryResultsDto>()

  const abortControllerRef = useRef<AbortController | null>(null);

  const min = 0;
  const max = 0.95;
  const step = 0.05;

  const fetchMetadata = async () => {
    setLoading(true)
    setMeasures([])
    try {
      const response = await apiService.getMetadata(
        datasource,
        schema,
        table
      );

      setMetadata(metadataDtoToDomain(response.data));
    } catch (error) {
      console.error(error)
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
        return null;
      } else {
        throw error;  // Re-throw other errors
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (from: Date, to: Date) => {
    if (!height || !width) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort the previous request
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true)

    const request: Query = {
      query: {
        from: from,
        to: to,
        measures: [1],
        viewPort: {
          width: width,
          height: height
        },
        accuracy: accuracy
      },
      schema: schema,
      table: table
    };
    try {
      const queryResultsDto = await apiService.getData(datasource, queryToQueryDto(request), controller.signal);
      if (queryResultsDto) {
        setQueryResults(queryResultsDto)
      }
    } catch (error) {
      console.error(error)
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
        return null;
      } else {
        throw error;  // Re-throw other errors
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDatasourceChange = (event: MouseEvent<HTMLElement>, datasource: string) => {
    setDatasource(datasource);
  };

  const handleSchemaChange = (event: MouseEvent<HTMLElement>, schema: string) => {
    setSchema(schema);
  };

  const handleTableChange = (event: MouseEvent<HTMLElement>, table: string) => {
    setTable(table);
  };

  const handleSelectMeasures = (event: SelectChangeEvent<number[]>) => {
    const {
      target: {value},
    } = event;
    setMeasures(typeof value === "string" ? value.split(",").map(Number) : value);
  };

  const handleMeasureRemove = (measureToRemove: number) => {
    setMeasures((prev) => prev.filter(measure => measure !== measureToRemove));
  };

  const decreaseAccuracy = () =>
    setAccuracy(prev => {
      if (prev <= min) {
        return min;
      }
      return Math.max(min, +(prev - step).toFixed(2));
  });

  const increaseAccuracy = () =>
    setAccuracy(prev => {
      if (prev >= max) {
        return max;
      }
      return Math.min(max, +(prev + step).toFixed(2));
    });

  const handleAccuracyChange = (event: SyntheticEvent | Event, value: number | number[]) => {
    if (typeof value === 'number') {
      setAccuracy(value);
    }
  }

  const debouncedFetchData = useDebouncedCallback((from, to) => fetchData(from, to), 100)

  const timestampToDate = (timestamp?: number): Date | null => timestamp ? new Date(timestamp) : null

  useEffect(() => {
    fetchMetadata()
  }, [table, datasource, schema])

  useEffect(() => {
    if (!metadata) {
      return;
    }
    // debouncedFetchData(from, to)
  }, [metadata, measures, height, width, schema, table, accuracy])

  return (
    <Box sx={{flexGrow: 1}}>
      <AppBar position="relative">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Big Data Chart
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ pt: 2, px: 1 }}>
        <Grid container spacing={2}>
          <Grid size={3}>
            <Card
              variant="outlined"
              sx={{p: 1}}
            >
              <Box>
                <Typography variant="overline">Datasource</Typography>
                <List component="nav" aria-label="datasource">
                  <ListItemButton
                    disabled={loading}
                    selected={datasource === 'influx'}
                    onClick={(event) => handleDatasourceChange(event, 'influx')}
                  >
                    <ListItemText primary="influx"/>
                  </ListItemButton>
                  <ListItemButton
                    disabled={true}
                    selected={datasource === 'postgres'}
                    onClick={(event) => handleDatasourceChange(event, 'postgres')}
                  >
                    <ListItemText primary="postgres"/>
                  </ListItemButton>
                </List>
              </Box>
              <Divider/>
              <Box>
                <Typography variant="overline">Schema</Typography>
                <List component="nav" aria-label="schema">
                  <ListItemButton
                    disabled={loading}
                    selected={schema === 'more'}
                    onClick={(event) => handleSchemaChange(event, 'more')}
                  >
                    <ListItemText primary="more"/>
                  </ListItemButton>
                </List>
              </Box>
              <Divider/>
              <Box>
                <Typography variant="overline">Table</Typography>
                <List component="nav" aria-label="table">
                  <ListItemButton
                    disabled={loading}
                    selected={table === 'intel_lab_exp'}
                    onClick={(event) => handleTableChange(event, 'intel_lab_exp')}
                  >
                    <ListItemText primary="intel_lab_exp"/>
                  </ListItemButton>
                  <ListItemButton
                    disabled={loading}
                    selected={table === 'manufacturing_exp'}
                    onClick={(event) => handleTableChange(event, 'manufacturing_exp')}
                  >
                    <ListItemText primary="manufacturing_exp"/>
                  </ListItemButton>
                </List>
              </Box>
              <Divider/>
              <Box>
                <Typography variant="overline">Measures</Typography>
                <Select
                  multiple
                  fullWidth
                  size="small"
                  value={measures}
                  onChange={handleSelectMeasures}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip color={'primary'} key={value} label={value} />
                      ))}
                    </Box>
                  )}
                >
                  {metadata?.measures.map((measure: number) => (
                    <MenuItem
                      key={measure}
                      value={measure}
                    >
                      {measure}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Card>
          </Grid>
          <Grid size={9}>
            <Card
              variant="outlined"
              sx={{p: 1}}
            >
            <Grid
              container
              spacing={2}
              sx={{ pb: 1}}
              alignItems={'center'}
            >
              <Grid size={6}>
                <DateTimePicker
                  label="From"
                  value={from}
                  slotProps={{ textField: { size: 'small' } }}
                  onChange={(newValue) => {
                    if (newValue) {
                      setFrom(newValue);
                    }
                  }}
                />
                <DateTimePicker
                  label="To"
                  value={to}
                  slotProps={{ textField: { size: 'small' } }}
                  onChange={(newValue) => {
                    if (newValue) {
                      setTo(newValue);
                    }
                  }}
                />
              </Grid>
              <Grid size={6}>
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
                    disabled={accuracy <= min}
                  >
                    <RemoveIcon fontSize="inherit" />
                  </IconButton>
                  <Slider
                    onChange={handleAccuracyChange}
                    value={accuracy}
                    min={0}
                    max={0.95}
                    step={0.05}
                    shiftStep={0.05}
                    aria-label="Accuracy"
                    valueLabelDisplay="auto"
                  />
                  <IconButton
                    aria-label="increase accuracy"
                    size="small"
                    color={'primary'}
                    onClick={increaseAccuracy}
                    disabled={accuracy >= max}
                  >
                    <AddIcon fontSize="inherit" />
                  </IconButton>
                </Box>
                </Box>
              </Grid>
            </Grid>
            </Card>
            <Divider/>
            <Card
              variant="outlined"
              sx={{p: 1}}
            >
            <Grid container sx={{ pt: 1}}>
              <Grid size={12}>
                {/*{Object.entries(queryResults?.data).map(([key, dataPoints]) => (*/}
                  <Chart
                    width={1040}
                    series={[queryResults?.data["1"]!]}
                    // fetchData={async (from: number, to: number) => await debouncedFetchData(from, to)}
                  />
                {/*))}*/}
              </Grid>
            </Grid>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default Dashboard;
