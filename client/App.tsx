import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { CreateProjectPage } from './pages/manage/CreateProjectPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/manage/projects/new" element={<CreateProjectPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
