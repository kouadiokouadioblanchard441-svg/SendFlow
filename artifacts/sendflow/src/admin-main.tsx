import { createRoot } from 'react-dom/client';
import PrivateAccessApp from './admin-app';
import './lib/api-client-bootstrap';
import './index.css';

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(<PrivateAccessApp />);
