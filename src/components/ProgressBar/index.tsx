import { BarChart } from '@mui/x-charts/BarChart';

interface ProgressBarProps {
  series: any[],
}

const ResponseTimes = ({series}: ProgressBarProps) => {
  return (
    <BarChart
      layout={'horizontal'}
      dataset={series}
      series={[
        { dataKey: 'query', stack: 'query', label: 'Query Time' },
        { dataKey: 'response', stack: 'response', label: 'Total Response Time' },
      ]}
      yAxis={[{ scaleType: 'band', dataKey: 'dataset' }]}
      xAxis={[{ label: 'response time (ms)' }]}
      width={300}
      height={150}
      skipAnimation
      resolveSizeBeforeRender
      margin={{ top: 25, left: 55 }}
      slots={{
        noDataOverlay: ()=>(<></>)
      }}
      slotProps={{
        legend: {
          direction: 'row',
          position: { vertical: 'top', horizontal: 'right' },
          padding: 0,
          itemMarkWidth: 10,
          itemMarkHeight: 10,
          labelStyle: {
            fontSize: 14,
          },
        },
      }}
    />
  );
}

export default ResponseTimes;
