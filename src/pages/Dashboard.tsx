import {
  Box,
  LinearProgress,
  Slider,
  Typography,
} from "@mui/material";
import apiService from "api/apiService";
import { useEffect, useState, useRef } from "react";
import { useDebouncedCallback } from 'use-debounce';
import axios from "axios";

import Chart from "components/Chart/Chart";

const Dashboard = () => {
  const [loading, setLoading] = useState<boolean>(false)
  const [from, setFrom] = useState<number>(1330144930991)
  const [to, setTo] = useState<number>(1330244930991)
  const [height, setHeight] = useState<number>(400)
  const [width, setWidth] = useState<number>(800)
  const [schema, setSchema] = useState<string>("more")
  const [table, setTable] = useState<string>("intel_lab_exp")
  const [accuracy, setAccuracy] = useState<number>(0.95)
  const [data, setData] = useState<any>(null)
  const [points, setPoints] = useState([])
  const [requested, setRequested] = useState<[number, number][]>([[from, to]])

  const ref = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = async (from: number, to: number) => {
    if (!height || !width) {
      return;
    }

    setRequested([...requested, [from, to]])

    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort the previous request
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true)
    setFrom(from)
    setTo(to)

    const request = {
      query: {
        from: from, // datepicker
        to: to, // datepicker
        measures: [1], // multiselect
        viewPort:{
          width: width,
          height: height
        },
        accuracy: accuracy // number input
      },
      schema: schema, // select
      table : table // select
    };
    try {
      const response = await apiService.getData('influx', request, controller.signal);
      if (response) {
        setData(response.data.queryResults)
        setPoints(response.data.queryResults.data["1"].map((point: any) => ({y: point.value, x: point.timestamp})))
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

  const handleAccuracyChange = (event: React.SyntheticEvent | Event, value: number | number[]) => {
    if (typeof value === 'number') {
      setAccuracy(value);
    }
  }

  const debouncedFetchData = useDebouncedCallback((from, to) => fetchData(from, to), 100)

  const timestampToDate = (timestamp?: number): Date | null => timestamp ? new Date(timestamp) : null

  useEffect(() => {
    debouncedFetchData(from, to)
  }, [height, width, schema, table, accuracy])

  return (
    <Box>
      <Box display={"flex"} justifyContent={"space-between"} alignItems={"top"}>
        <Box>
          <Typography>Dimensions: [{width}, {height}]</Typography>
          <Typography>From: {String(timestampToDate(from)?.toLocaleString())}</Typography>
          <Typography>To: {String(timestampToDate(to)?.toLocaleString())}</Typography>
          {data && (
            <Typography>Error: {data!.error["1"]}</Typography>
          )}
          <Box>
            <Typography>Accuracy:</Typography>
            <Slider
              onChangeCommitted={handleAccuracyChange}
              defaultValue={0.95}
              min={0}
              max={0.95}
              step={0.05}
              shiftStep={0.05}
              marks
              aria-label="Accuracy"
              valueLabelDisplay="auto"
            />
          </Box>
        </Box>
        <Box>
          {data && (
            <>
              <Typography>Measure Stats</Typography>
              {/* <Typography>Count: {data!.measureStats["1"].count}</Typography> */}
              <Typography>Average: {data!.measureStats["1"].average}</Typography>
              <Typography>Min: {data!.measureStats["1"].min}</Typography>
              <Typography>Max: {data!.measureStats["1"].max}</Typography>
              <Typography>Sum: {data!.measureStats["1"].sum}</Typography>
            </>
          )}
        </Box>
      </Box>

      <Box display={"flex"} alignItems={"center"} flexDirection={'column'}>
        {loading && <LinearProgress />}
        <Chart
          title={"test"}
          series={[points]}
          fetchData={async (from, to) => await debouncedFetchData(from, to)}
        />
      </Box>
      <ul>
      {requested.map((e: any, i: any) => (
          <li key={i}>From: {e[0]} To: {e[1]} Diff: {e[1]-e[0]} Dir: {i > 1 ? e[0] < requested[i-1][0] ? `left` : `right` : ''}</li>
        ))}
        </ul>
    </Box>
  );
};

export default Dashboard;
