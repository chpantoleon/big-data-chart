import { FC, useEffect, useRef, useState } from 'react'
import * as d3 from 'd3';
import { Typography } from '@mui/material';

interface LineChartProps {
  title?: string
  width?: number
  height?: number
  fetchData: (from: number, to: number) => Promise<null | undefined>
  series: {
    x: number
    y: number
  }[][]
}

const Chart: FC<LineChartProps> = ({
  series,
  title,
  fetchData,
  width = 800,
  height = 400
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; valueX: number; valueY: number } | null>(null);

  const margin = { top: 20, right: 30, bottom: 30, left: 40 };
  const containerWidth = width - margin.left - margin.right;
  const containerHeight = height - margin.top - margin.bottom;

  useEffect(() => {
    if (!svgRef.current || series[0].length === 0) return;

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
    const formattedData = series[0].map(d => [new Date(d.x), d.y] as [Date, number]);

    // Set up scales
    const x = d3
      .scaleTime()
      .domain(d3.extent(formattedData, (d: any) => d[0]) as [Date, Date])
      .range([0, containerWidth]);

    const y = d3
      .scaleLinear()
      .domain([d3.min(formattedData, (d: any) => d[1])!, d3.max(formattedData, (d: any) => d[1])!])
      .nice()
      .range([containerHeight, 0]);

    // Append a 'g' element to group everything inside the chart
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);


    // Function to add X gridlines
    const makeXGridlines = () => d3.axisBottom(x).ticks(5);

    // Function to add Y gridlines
    const makeYGridlines = () => d3.axisLeft(y).ticks(5);

    // Add X gridlines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${containerHeight})`)
      .call(
        makeXGridlines()
          .tickSize(-containerHeight) // Extend lines down to the bottom
          .tickFormat(() => '') // No tick labels
      );

    // Add Y gridlines
    g.append('g')
      .attr('class', 'grid')
      .call(
        makeYGridlines()
          .tickSize(-containerWidth) // Extend lines across the width
          .tickFormat(() => '') // No tick labels
      );

    // X Axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${containerHeight})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat('%d-%m-%Y')));

    // Y Axis
    g.append('g').call(d3.axisLeft(y));

    const line = d3
      .line()
      .x((d: any) => x(d[0]))
      .y((d: any) => y(d[1]))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(formattedData)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 2)
      .attr('d', line);

    g.selectAll("rect")
      .data(formattedData)
      .enter()
      .append("rect")
      .attr("x", (d: any) => x(d[0]))  // Center the rectangle on the x value (2px offset)
      .attr("y", (d: any) => y(d[1]))  // Center the rectangle on the y value (2px offset)
      .attr("width", 1)              // Width of rectangle
      .attr("height", 1)             // Height of rectangle
      .attr("fill", "steelblue");    // Color of rectangles

    // Apply some basic styles for the gridlines
    svg.selectAll('.grid line')
      .style('stroke', '#e0e0e0')
      .style('stroke-opacity', 0.7)
      .style('shape-rendering', 'crispEdges');

    svg.selectAll('.grid path').style('stroke-width', 0);


    // Zoom and Pan functionality
    const zoom = d3.zoom()
      .scaleExtent([1, 5]) // Set zoom scale extent (1 = no zoom, 5 = 5x zoom)
      .translateExtent([[0, 0], [containerWidth, containerHeight]])
      .on('zoom', zoomed);

    svg.call(zoom); // Apply zoom behavior to the entire svg

    async function zoomed(event: any) {
      console.log(event)
      const newX = event.transform.rescaleX(x); // Rescale the x-axis
      xAxis.call(
        d3.axisBottom(newX)
          .ticks(7)
          .tickFormat(getTickFormat(event.transform.k)));

      const [newFrom, newTo] = newX.domain().map((d: any) => {console.log(d); return +d;});

      console.log('movementX', event.sourceEvent.movementX)

      fetchData(newFrom, newTo); // Fetch new data

      g.selectAll("rect")
        .attr("x", (d: any) => newX(d[0])) // Update x position
        .attr("y", (d: any) => y(d[1]))     // Update y position
        .attr("width", 1)
        .attr("height", 1)
    }

    function getTickFormat(scale: number) {
      if (scale < 100) {
        return d3.timeFormat("%d-%m-%Y"); // Show full date and hour
      } else if (scale < 2500) {
        return d3.timeFormat("%d-%m-%Y %H:%M"); // Show seconds
      } else if (scale < 81000000) {
        return d3.timeFormat("%H:%M:%S"); // Show hour and minute
      } else {
        return d3.timeFormat("%H:%M:%S.%L"); // Show only time with seconds
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      const [mouseX, mouseY] = d3.pointer(event);

      // Get the x and y values from the scales
      const dateX = x.invert(mouseX);  // Convert to Date object
      const valueY = y.invert(mouseY);

      setTooltip({
        x: mouseX,
        y: mouseY,
        valueX: dateX.getTime(),  // Convert date to timestamp if needed
        valueY,
      });
    };

    svg.on('mousemove', handleMouseMove).on('mouseleave', () => setTooltip(null));

  }, [series, height, width, fetchData]);

  return (
    <>
      <Typography variant="h3" component="h3">{title}</Typography>
      <svg
        ref={svgRef}
        width={800}
        height={400}
        style={{ border: '1px solid black' }}
      />
      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '5px',
            borderRadius: '3px',
            pointerEvents: 'none',
          }}
        >
          <div>X: {new Date(tooltip.valueX).toLocaleString()}</div>
          <div>Y: {tooltip.valueY.toFixed(2)}</div>
        </div>
      )}
    </>
  )
}

export default Chart;
