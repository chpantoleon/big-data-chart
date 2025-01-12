import React from 'react'
import { createBrowserRouter } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';
import CustomDashboard from 'pages/CustomDashboard';

const LoginPage = React.lazy(() => import('pages/Login'))

const router = createBrowserRouter(
  [
    {
      path: '/login',
      element: <LoginPage />,
      index: true
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: '/',
          element: <CustomDashboard />
        },
      ],
    },
    {
      path: '*',
      element: <p>404 Error - Nothing here...</p>
    }
  ]
);

export default router;
