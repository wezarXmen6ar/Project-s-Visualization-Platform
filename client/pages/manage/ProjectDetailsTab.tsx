import { Fragment, type ReactNode } from 'react';
import type { ProjectRecord } from '../../../shared/types';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName } from '../../i18n/listNames';
import { CATEGORY_KEY, PRIORITY_KEY, SCOPE_TABLES, beneficiaryLabel, requesterLabel } from './labels';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A person's name as user content, so a Latin name reads correctly inside Arabic (and the other way round). */
function PersonName({ name }: { name: string }) {
  return <span dir="auto" data-user-content="">{name}</span>;
}

interface ProjectDetailsTabProps {
  project: ProjectRecord;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor: (name: string) => string;
}

/** The Details tab: the classification, description, scope and goals, and phases table cards, unchanged from before the tabs. */
export function ProjectDetailsTab({ project: p, nameFor }: ProjectDetailsTabProps) {
  const t = useT();
  const { lang } = useLang();
  const { formatDate } = useFormat();

  return (
    <>
      <section className="card">
        <h2>{t('project.details')}</h2>
        <dl className="details-grid">
          <Detail label={t('project.priority')}>{t(PRIORITY_KEY[p.priority])}</Detail>
          <Detail label={t('project.projectManager')}>{p.projectManager ? <PersonName name={p.projectManager.name} /> : '—'}</Detail>
          <Detail label={t('project.businessPm')}>
            {p.businessPm ? <PersonName name={p.businessPm.name} /> : <span>—</span>}
            {p.businessPm?.phone ? (
              <a className="detail-line" dir="ltr" href={`tel:${p.businessPm.phone.replace(/\s/g, '')}`}>{p.businessPm.phone}</a>
            ) : null}
            {p.businessPm?.email ? (
              <a className="detail-line" dir="ltr" href={`mailto:${p.businessPm.email}`}>{p.businessPm.email}</a>
            ) : null}
          </Detail>
          <Detail label={t('project.mainProject')}>{p.mainProject ? listName(p.mainProject, lang) : t('project.standalone')}</Detail>
          <Detail label={t('project.category')}>{p.category ? t(CATEGORY_KEY[p.category]) : '—'}</Detail>
          <Detail label={t('project.projectType')}>{p.projectType ? listName(p.projectType, lang) : '—'}</Detail>
          <Detail label={t('project.goal')}>{p.goal ? listName(p.goal, lang) : '—'}</Detail>
          <Detail label={t('project.department')}>{p.department ? listName(p.department, lang) : '—'}</Detail>
          <Detail label={t('project.requester')}>{requesterLabel(p.requester, lang)}</Detail>
          <Detail label={t('project.beneficiary')}>{beneficiaryLabel(p.beneficiary, lang)}</Detail>
        </dl>
      </section>

      <section className="card">
        <h2>{t('project.description')}</h2>
        <h3>{t('project.background')}</h3>
        <p className="prose" dir="auto" data-user-content="">{p.background || '—'}</p>
        <h3>{t('project.summary')}</h3>
        <p className="prose" dir="auto" data-user-content="">{p.summary || '—'}</p>
      </section>

      <section className="card">
        <h2>{t('project.scopeAndGoals')}</h2>
        <div className="scope-summary">
          {SCOPE_TABLES.map(({ kind, title }) => {
            const items = p.scopeItems.filter((i) => i.kind === kind).sort((a, b) => a.order - b.order);
            return (
              <div key={kind}>
                <h3>{t(title)}</h3>
                {items.length === 0 ? (
                  <p className="muted">{t('project.noneYet')}</p>
                ) : (
                  <ol>{items.map((i) => <li key={i.id} dir="auto" data-user-content="">{i.text}</li>)}</ol>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>{t('project.phases')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('project.colPhase')}</th>
              <th>{t('project.colStart')}</th>
              <th>{t('project.colEnd')}</th>
              <th>{t('project.colWorkingDays')}</th>
            </tr>
          </thead>
          <tbody>
            {p.phases.map((ph) => (
              <Fragment key={ph.id}>
                <tr>
                  <td>{nameFor(ph.name)}</td>
                  <td>{formatDate(ph.start)}</td>
                  <td>{formatDate(ph.end)}</td>
                  <td>
                    {ph.durationDays}
                    {ph.subPhases.length > 0 ? <span className="muted">{` ${t('project.fromSubPhases')}`}</span> : null}
                  </td>
                </tr>
                {ph.subPhases.map((sp) => (
                  <tr key={sp.id}>
                    <td className="sub-phase-name">
                      {/* The arrow points into the row from the phase above: down, then towards the text. Kept
                          outside the dir="auto" span, so it always sits on the reading-direction side, not inside
                          user content that may take its own direction. */}
                      <span aria-hidden="true">{lang === 'ar' ? '↲ ' : '↳ '}</span>
                      <span dir="auto" data-user-content="">{sp.name}</span>
                      {sp.withPrevious ? <span className="muted">{` · ${t('project.startsWithAbove')}`}</span> : null}
                    </td>
                    <td>{formatDate(sp.start)}</td>
                    <td>{formatDate(sp.end)}</td>
                    <td>{sp.durationDays}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
