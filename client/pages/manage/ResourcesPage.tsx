import { useState } from 'react';
import { Link } from 'react-router';
import type { Side } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { SIDE_LABEL, SPECIALISATION_LABEL } from './labels';

export function ResourcesPage() {
  const people = useAsync(() => api.listResources(), []);
  const lists = useAsync(() => api.getLists(), []);
  const [side, setSide] = useState<Side | 'all'>('all');
  const [roleId, setRoleId] = useState<number | null>(null);

  const all = people.data ?? [];
  const shown = all.filter((p) => (side === 'all' || p.side === side) && (roleId === null || p.role?.id === roleId));

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>Resources</h1>
          <p className="meta-line">Your tech team, who can be assigned to phases, and your business-side contacts.</p>
        </div>
        <Link to="/manage/resources/new" className="button"><PlusIcon />Add person</Link>
      </div>

      {people.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{people.error.message}</span>
        </div>
      ) : null}

      <section className="card">
        <h2>People</h2>
        <div className="filters">
          <label>
            Side
            <select value={side} onChange={(e) => setSide(e.target.value as Side | 'all')}>
              <option value="all">Everyone</option>
              <option value="tech">{SIDE_LABEL.tech}</option>
              <option value="business">{SIDE_LABEL.business}</option>
            </select>
          </label>
          <label>
            Role
            <select
              value={roleId === null ? '' : String(roleId)}
              onChange={(e) => setRoleId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">All roles</option>
              {(lists.data?.role ?? []).map((r) => (
                <option key={r.id} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
          </label>
        </div>

        {!people.data && !people.error ? <p className="muted">Loading…</p> : null}
        {people.data && all.length === 0 ? <p className="muted">No one yet. Add your team and your business-side contacts.</p> : null}
        {people.data && all.length > 0 && shown.length === 0 ? <p className="muted">No one matches these filters.</p> : null}

        {shown.length > 0 ? (
          <table aria-label="People">
            <thead>
              <tr><th>Name</th><th>Side</th><th>Role</th><th>Capacity</th><th>Contact</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/manage/resources/${p.id}`}>{p.name}</Link></td>
                  <td>{SIDE_LABEL[p.side]}</td>
                  <td>
                    {p.role?.name ?? '—'}
                    {p.specialisation ? ` · ${SPECIALISATION_LABEL[p.specialisation]}` : ''}
                  </td>
                  <td>{p.side === 'tech' ? `${p.capacity}%` : '—'}</td>
                  <td>{[p.phone, p.email].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{p.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
