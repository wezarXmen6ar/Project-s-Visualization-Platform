import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { groupedPortfolioRows } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function PortfolioPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const year = Number(params.get('year')) || new Date().getFullYear();
  const portfolio = useAsync(() => api.getPortfolio(year), [year]);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();

  const goToYear = (y: number) => setParams({ year: String(y) });
  const data = portfolio.data?.year === year ? portfolio.data : undefined;
  const rows = data ? groupedPortfolioRows(data.projects) : [];

  return (
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to="/" className="crumb">← Start</Link>
          <h1>Project Portfolio</h1>
        </div>
        <div className="year-nav">
          <button type="button" className="button secondary" aria-label="Previous year" onClick={() => goToYear(year - 1)}>‹</button>
          <strong>{year}</strong>
          <button type="button" className="button secondary" aria-label="Next year" onClick={() => goToYear(year + 1)}>›</button>
        </div>
      </div>

      {portfolio.error ? <div className="errors" role="alert">{portfolio.error.message}</div> : null}
      {!data && !portfolio.error ? <p className="muted">Loading…</p> : null}

      {data ? (
        <>
          <div className="stats">
            <div className="stat">
              <div className="stat-value" data-testid="stat-active">{data.stats.active}</div>
              <div className="stat-label">Active now</div>
            </div>
            <div className="stat">
              <div className="stat-value" data-testid="stat-finished">{data.stats.finishedThisYear}</div>
              <div className="stat-label">Finished in {year}</div>
            </div>
            <div className="stat">
              <div className="stat-value" data-testid="stat-starting">{data.stats.startingThisYear}</div>
              <div className="stat-label">Scheduled to start in {year}</div>
            </div>
          </div>

          <section className="card">
            {rows.length === 0 ? (
              <p className="muted">No projects in {year}.</p>
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
