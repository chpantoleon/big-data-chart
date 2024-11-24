import { FC, useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface LineChartProps {
  width?: number;
  height?: number;
  onChange: (from: number, to: number) => void;
  series: {
    timestamp: number;
    value: number;
  }[][];
}

const Chart: FC<LineChartProps> = ({
  series,
  onChange,
  width = 800,
  height = 400,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const margin = { top:20, right: 0, bottom: 20, left: 40 };
  const containerWidth = width - margin.left - margin.right;
  const containerHeight = height - margin.top - margin.bottom;

  function getTickFormat(scale: number) {
    if (scale < 100) {
      return d3.timeFormat('%d-%m-%Y'); // Show full date
    } else if (scale < 2500) {
      return d3.timeFormat('%d-%m-%Y %H:%M'); // Show date and time
    } else if (scale < 81000000) {
      return d3.timeFormat('%H:%M:%S'); // Show time
    } else {
      return d3.timeFormat('%H:%M:%S.%L'); // Show time with milliseconds
    }
  }

  useEffect(() => {
    console.log('restore zoom')
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.call(d3.zoom().transform, d3.zoomIdentity)
  }, [series])

  useEffect(() => {
    console.log('rerender')
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    if (series[0].length === 0) {
      // Display "No data" message
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('alignment-baseline', 'middle')
        .attr('font-size', '16px')
        .attr('fill', 'gray')
        .text('No data');
      return;
    }

    // Convert x to Date from timestamp
    const formattedData = series[0].map(d => [new Date(d.timestamp), d.value] as [Date, number]);

    // Set up scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(formattedData, (d: any) => d[0]) as Date[])
      .range([margin.left, width-margin.right]);

    const y = d3
      .scaleLinear()
      .domain(d3.extent(formattedData, (d: any) => d[1]) as number[])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const dataPlane = svg.append('g')

    // Function to add X gridlines
    const makeXGridlines = () => d3.axisBottom(x).ticks(7);

    // Function to add Y gridlines
    const makeYGridlines = () => d3.axisLeft(y).ticks(7);

    // Add X gridlines
    dataPlane.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        makeXGridlines()
          .tickSize(-containerHeight) // Extend lines down to the bottom
          .tickFormat(() => '') // No tick labels
      );

    // Add Y gridlines
    dataPlane.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        makeYGridlines()
          .tickSize(-containerWidth) // Extend lines across the width
          .tickFormat(() => '') // No tick labels
      );

    // X Axis
    const xAxis = svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat('%d-%m-%Y')));

    // Y Axis
    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

    const line = d3.line()
      .x((d: any) => x(d[0]))
      .y((d: any) => y(d[1]))
      .curve(d3.curveMonotoneX);

    dataPlane.append('path')
      .datum(formattedData)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1)
      .attr('d', line);

    dataPlane.selectAll("rect")
      .data(formattedData)
      .enter()
      .append('rect')
      .attr('x', (d: any) => x(d[0]))
      .attr('y', (d: any) => y(d[1]))
      .attr('width', 1)
      .attr('height', 1)
      .attr('fill', 'steelblue');

    // Apply basic styles for the gridlines
    svg.selectAll('.grid line')
      .style('stroke', '#e0e0e0')
      .style('stroke-opacity', 0.7)
      .style('shape-rendering', 'crispEdges');

    svg.selectAll('.grid path').style('stroke-width', 0);

    const zoom = d3.zoom()
      .on('zoom', (event: any) => {
        const newX = event.transform.rescaleX(x);
        xAxis.call(d3.axisBottom(newX).ticks(7).tickFormat(getTickFormat(event.transform.k)));

        const transform = event.transform;
        transform.y = 0
        dataPlane.attr("transform", transform.toString())

      }).on('end', (event: any) => {
        const newX = event.transform.rescaleX(x);
        xAxis.call(d3.axisBottom(newX).ticks(7).tickFormat(getTickFormat(event.transform.k)));
        const [start, end] = newX.domain().map((d: any) => d.getTime());
        onChange(start, end);
      });

    svg.call(zoom);
  }, [series]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
    />
  );
};

export default Chart;
