import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { Gantt } from '../../gantt/Gantt';
import { groupedPortfolioRows } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName, phaseName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';

export function PortfolioPage() {
  const t = useT();
  const { lang, dir } = useLang();
  const { lists } = useLists();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const year = Number(params.get('year')) || new Date().getFullYear();
  const portfolio = useAsync(() => api.getPortfolio(year), [year]);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();

  const goToYear = (y: number) => setParams({ year: String(y) });
  const data = portfolio.data?.year === year ? portfolio.data : undefined;
  const rows = data
    ? groupedPortfolioRows(data.projects, (name) => phaseName(name, lists, lang), (mainProject) => listName(mainProject, lang))
    : [];
  // The year arrows point outwards, away from the year, so they swap in a right-to-left page.
  const [previousArrow, nextArrow] = dir === 'rtl' ? ['›', '‹'] : ['‹', '›'];

  return (
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to="/" className="crumb">{t('present.backToStart')}</Link>
          <h1>{t('present.title')}</h1>
        </div>
        <div className="year-nav">
          <button type="button" className="button secondary" aria-label={t('present.previousYear')} onClick={() => goToYear(year - 1)}>
            {previousArrow}
          </button>
          <strong>{year}</strong>
          <button type="button" className="button secondary" aria-label={t('present.nextYear')} onClick={() => goToYear(year + 1)}>
            {nextArrow}
          </button>
        </div>
      </div>

      {portfolio.error ? <div className="errors" role="alert">{messagesOf(portfolio.error, t)[0]}</div> : null}
      {!data && !portfolio.error ? <p className="muted">{t('common.loading')}</p> : null}

      {data ? (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-value" data-testid="stat-active">{data.stats.active}</div>
              <div className="stat-label">{t('present.activeNow')}</div>
            </div>
            <div className="stat">
              <div className="stat-value" data-testid="stat-finished">{data.stats.finishedThisYear}</div>
              <div className="stat-label">{t('present.finishedIn', { year })}</div>
            </div>
            <div className="stat">
              <div className="stat-value" data-testid="stat-starting">{data.stats.startingThisYear}</div>
              <div className="stat-label">{t('present.startingIn', { year })}</div>
            </div>
          </div>

          <section className="card">
            {rows.length === 0 ? (
              <p className="muted">{t('present.noProjects', { year })}</p>
            ) : (
              <div className="chart-scroll" ref={chartRef}>
                <Gantt
                  rows={rows}
                  range={{ start: `${year}-01-01`, end: `${year}-12-31` }}
                  width={chartWidth}
                  today={data.today}
                  onRowClick={(id) => navigate(`/present/projects/${id}`)}
                />
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
