import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { CreateProjectPage } from './pages/manage/CreateProjectPage';
import { ManageDashboardPage } from './pages/manage/ManageDashboardPage';
import { ProjectPage } from './pages/manage/ProjectPage';
import { FocusPage } from './pages/present/FocusPage';
import { PortfolioPage } from './pages/present/PortfolioPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/manage" element={<ManageDashboardPage />} />
      <Route path="/manage/projects/new" element={<CreateProjectPage />} />
      <Route path="/manage/projects/:id" element={<ProjectPage />} />
      <Route path="/present" element={<PortfolioPage />} />
      <Route path="/present/projects/:id" element={<FocusPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
