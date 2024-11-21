import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

const ProtectedRoute = () => {
  return (
    <Box sx={{p:1}}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Outlet />
      </LocalizationProvider>
    </Box>
  );
};

export default ProtectedRoute;
