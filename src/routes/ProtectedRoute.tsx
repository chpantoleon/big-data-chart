import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

const ProtectedRoute = () => {
  return (
    <Box>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Outlet />
      </LocalizationProvider>
    </Box>
  );
};

export default ProtectedRoute;
