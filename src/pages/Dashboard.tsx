import {MouseEvent, SyntheticEvent} from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Grid from "@mui/material/Grid2";
import Typography from "@mui/material/Typography";
import apiService from "api/apiService";
import {useEffect, useState, useRef} from "react";
import {useDebouncedCallback} from 'use-debounce';
import axios from "axios";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';

import Chart from "components/Chart/Chart";
import {Metadata, metadataDtoToDomain} from "../interfaces/metadata";
import {QueryResultsDto} from "../interfaces/data";
import {Query, queryToQueryDto} from "../interfaces/query";

const Dashboard = () => {
  const [loading, setLoading] = useState<boolean>(false)

  const [from, setFrom] = useState<Dayjs>(dayjs(1330144930991));
  const [to, setTo] = useState<Dayjs>(dayjs(1330244930991));
  const [height, setHeight] = useState<number>(400)
  const [width, setWidth] = useState<number>(800)
  const [accuracy, setAccuracy] = useState<number>(950)

  const [measures, setMeasures] = useState<number[]>([]);

  const [datasource, setDatasource] = useState<string>("influx")
  const [schema, setSchema] = useState<string>("more")
  const [table, setTable] = useState<string>("intel_lab_exp")

  const [metadata, setMetadata] = useState<Metadata>()
  const [queryResults, setQueryResults] = useState<QueryResultsDto>()

  const abortControllerRef = useRef<AbortController | null>(null);

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
      console.log(prev)
      if (prev <= 0) {
        return 0;
      }
      return prev - 5;
  });

  const increaseAccuracy = () =>
    setAccuracy(prev => {
      if (prev >= 950) {
        return 950;
      }
      return prev + 5;
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
  }, [table])

  useEffect(() => {
    fetchMetadata()
  }, [table])

  useEffect(() => {
    if (!metadata) {
      return;
    }
    // debouncedFetchData(from, to)
  }, [metadata, measures, height, width, schema, table, accuracy])

  return (
    <Box sx={{flexGrow: 1}}>
      <Grid container spacing={2}>
        <Grid size={4} sx={{borderBottomRight: 1}}>
          <Paper elevation={1}>
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
                  disabled={loading}
                  selected={datasource === 'postgres'}
                  onClick={(event) => handleDatasourceChange(event, 'postgres')}
                >
                  <ListItemText primary="postgres"/>
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
                value={measures}
                onChange={handleSelectMeasures}
                renderValue={(selected) => (<>Add Measure</>)}
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
              <Box sx={{marginTop: 2, display: "flex", flexWrap: "wrap", gap: 1}}>
                {measures.map((measure) => {
                  const option = metadata?.measures.find((opt) => opt === measure);
                  return (
                    option !== undefined && (
                      <Chip
                        key={measure}
                        label={measure}
                        onDelete={() => handleMeasureRemove(measure)}
                        variant="outlined"
                      />
                    )
                  );
                })}
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid size={8}>
          <Paper elevation={1}>
            <Box
              display={'flex'}
              flexDirection={'row'}
              justifyContent={'space-between'}
            >
              <Box>
                <DateTimePicker
                  label="From"
                  value={from}
                  onChange={(newValue) => {
                    if (newValue) {
                      setFrom(newValue);
                    }
                  }}
                />
                <DateTimePicker
                  label="To"
                  value={to}
                  onChange={(newValue) => {
                    if (newValue) {
                      setTo(newValue);
                    }
                  }}
                />
              </Box>
              <Box
                display={'flex'}
                flexDirection={'row'}
                justifyContent={'space-between'}
                alignItems={'center'}
                flexGrow={2}
              >
                <Typography>Min. Accuracy:</Typography>
                <Button
                  size={'small'}
                  variant="contained"
                  onClick={decreaseAccuracy}
                >-</Button>
                <Slider
                  onChangeCommitted={handleAccuracyChange}
                  value={accuracy}
                  min={0}
                  max={1000}
                  step={5}
                  shiftStep={5}
                  aria-label="Accuracy"
                  valueLabelDisplay="auto"
                />
                <Button
                  size={'small'}
                  variant="contained"
                  onClick={increaseAccuracy}
                >+</Button>
              </Box>
            </Box>

          </Paper>
          <Paper elevation={1}>

            <Box>
              <Chart
                series={[queryResults?.data["1"]!]}
                // fetchData={async (from, to) => await debouncedFetchData(from, to)}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
