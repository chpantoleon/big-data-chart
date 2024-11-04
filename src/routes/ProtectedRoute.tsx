import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  return (
    <Box sx={{p:1}}>
      <Outlet />
    </Box>
  );
};

export default ProtectedRoute;
