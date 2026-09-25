import { Route, Routes } from 'react-router';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { CreateProjectPage } from './pages/manage/CreateProjectPage';
import { EditProjectPage } from './pages/manage/EditProjectPage';
import { ManageDashboardPage } from './pages/manage/ManageDashboardPage';
import { PersonPage } from './pages/manage/PersonPage';
import { ProjectPage } from './pages/manage/ProjectPage';
import { ResourcesPage } from './pages/manage/ResourcesPage';
import { SettingsPage } from './pages/manage/SettingsPage';
import { FocusPage } from './pages/present/FocusPage';
import { PortfolioPage } from './pages/present/PortfolioPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/manage" element={<ManageDashboardPage />} />
      <Route path="/manage/settings" element={<SettingsPage />} />
      <Route path="/manage/resources" element={<ResourcesPage />} />
      <Route path="/manage/resources/new" element={<PersonPage />} />
      <Route path="/manage/resources/:id" element={<PersonPage />} />
      <Route path="/manage/projects/new" element={<CreateProjectPage />} />
      <Route path="/manage/projects/:id" element={<ProjectPage />} />
      <Route path="/manage/projects/:id/edit" element={<EditProjectPage />} />
      <Route path="/present" element={<PortfolioPage />} />
      <Route path="/present/projects/:id" element={<FocusPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
