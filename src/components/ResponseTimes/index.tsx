import { BarChart } from '@mui/x-charts/BarChart';
import { useEffect, useRef, useState } from 'react';

interface ProgressBarProps {
  series: any[],
}

const ResponseTimes = ({series}: ProgressBarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 150 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <BarChart
        layout={'horizontal'}
        dataset={series}
        series={[
          { dataKey: 'query', stack: 'time', label: 'Query', color: '#4caf50' }, // Green
          { dataKey: 'rendering', stack: 'time', label: 'Rendering', color:  '#ff9800' }, // Blue
          { dataKey: 'networking', stack: 'time', label: 'Networking', color: '#2196f3' }, // Orange
        ]}
        yAxis={[{ scaleType: 'band', dataKey: 'dataset' }]}
        xAxis={[{ label: 'time (ms)' }]}
        width={dimensions.width}
        height={dimensions.height}
        skipAnimation
        resolveSizeBeforeRender
        margin={{ top: 25, left: 100 }} // Further increase left margin to avoid cutting off y-axis labels
        slots={{
          noDataOverlay: ()=>(<></>)
        }}
        slotProps={{
          legend: {
            direction: 'row',
            position: { vertical: 'top', horizontal: 'left' },
            padding: 0,
            itemMarkWidth: 10,
            itemMarkHeight: 10,
            labelStyle: {
              fontSize: 14,
            },
          },
        }}
      />
    </div>
  );
}

export default ResponseTimes;
