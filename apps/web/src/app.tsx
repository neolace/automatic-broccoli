import { BrowserRouter } from 'react-router';

import { AppRouter } from './routes/app-router';

export function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
