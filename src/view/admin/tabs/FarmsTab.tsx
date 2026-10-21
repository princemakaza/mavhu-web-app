import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../../model/admin/adminApi';
import { EmptyState, Panel, StatCard } from '../../cbz/components/primitives';
import { ErrorNote, Loading, relativeTime } from '../shared';
import { useLoad } from '../useLoad';

/** Agribusiness borrowers on MAvHU MRV: open any farm's portal read-only. */
export function FarmsTab() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => adminApi.farms(), []);
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  const farms = data ?? [];
  return (
    <>
      <div className="cbz-grid cbz-grid--stats">
        <StatCard label="Farms on MRV" value={String(farms.length)} />
        <StatCard label="Land monitored" value={farms.reduce((s, f) => s + f.hectares, 0).toLocaleString('en-GB')} unit="ha" />
        <StatCard label="Farm users" value={String(farms.reduce((s, f) => s + f.users, 0))} />
        <StatCard label="Entries awaiting farm approval" value={String(farms.reduce((s, f) => s + f.pendingApprovals, 0))} intent="warning" />
      </div>
      <Panel title="Agri farms" subtitle="Borrowers whose land MAvHU monitors by satellite and field visit; their data feeds the banks' PCAF calculations." padded={false}>
        <div className="cbz-table-wrap">
          <table className="cbz-table">
            <thead>
              <tr>
                <th>Farm</th>
                <th className="cbz-num">Estates</th>
                <th className="cbz-num">Hectares</th>
                <th className="cbz-num">Users</th>
                <th>Latest satellite pass</th>
                <th>Financed by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {farms.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.name}
                    <div className="cbz-muted">{f.email}</div>
                  </td>
                  <td className="cbz-num">{f.estates}</td>
                  <td className="cbz-num">{f.hectares.toLocaleString('en-GB')}</td>
                  <td className="cbz-num">{f.users}</td>
                  <td>{f.latestPass ? relativeTime(f.latestPass) : 'No passes yet'}</td>
                  <td>{f.financedBy ?? '—'}</td>
                  <td>
                    <button type="button" className="cbz-btn cbz-btn--sm cbz-btn--primary" onClick={() => navigate(`/admin/farms/${f.id}`)}>
                      Open MRV view
                    </button>
                  </td>
                </tr>
              ))}
              {farms.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No agribusiness customers yet." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
