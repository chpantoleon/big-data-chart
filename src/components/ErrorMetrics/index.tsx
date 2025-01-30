import Typography from '@mui/material/Typography';
import { BarChart } from '@mui/x-charts/BarChart';
import { useEffect, useRef, useState } from 'react';

interface ErrorMetricsProps {
  // Update the series type to accept any properties
  series: { measure: string; [key: string]: any }[];
  selectedMetric: {label: string, id: string};
  selectedMethodInstances: string[];
  formatInstanceId: (instanceId: string) => string; // Add this prop
}

const ErrorMetrics = ({ 
  series, 
  selectedMetric, 
  selectedMethodInstances,
  formatInstanceId 
}: ErrorMetricsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 140 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          // Subtract legend height (64px) from total height
          height: containerRef.current.offsetHeight - 64,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const colors = ['#f44336', '#2196f3', '#4caf50', '#ffeb3b', '#ff9800', '#9c27b0', '#00bcd4', '#e91e63'];

  const legendItems = selectedMethodInstances.map((instanceId, index) => {
    return {
      dataKey: `${instanceId}_${selectedMetric.id}`,
      label: formatInstanceId(instanceId),
      color: colors[index % colors.length],
    };
  });

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Fixed height legend */}
      <div style={{ overflow: 'auto', padding: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {legendItems.map((item, index) => (
            <div key={item.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, backgroundColor: item.color }} />
              <Typography variant="subtitle2">{item.label}</Typography>
            </div>
          ))}
        </div>
      </div>
      
      {/* Scrollable chart area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <BarChart
          layout={'horizontal'}
          dataset={series}
          series={legendItems}
          yAxis={[{ scaleType: 'band', dataKey: 'measure' }]}
          xAxis={[{ label: selectedMetric.label }]}
          width={dimensions.width}
          height={dimensions.height}
          skipAnimation
          margin={{ top: 20, left: 100, right: 50, bottom: 50 }}
          slots={{
            noDataOverlay: () => null,
            legend: () => null // Disable default legend since we have our custom one
          }}
        />
      </div>
    </div>
  );
};

export default ErrorMetrics;