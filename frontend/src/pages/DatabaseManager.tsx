import React, { useState } from 'react';
import {
  Database,
  Play,
  RotateCw,
  Table as TableIcon,
  Server,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { useI18n } from '../i18n';

export const DatabaseManagerPage: React.FC = () => {
  const { addNotification } = useUIStore();
  const { t } = useI18n();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState(3306);
  const [dbName, setDbName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [tables, setTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('SHOW TABLES;');
  const [queryResult, setQueryResult] = useState<any | null>(null);
  const [executing, setExecuting] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !dbName || !username) {
      addNotification({ type: 'warning', title: t('databaseManager.inputRequired'), message: t('databaseManager.requiredFields') });
      return;
    }

    setConnecting(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        await app.ConnectDatabase({
          host,
          port: Number(port),
          database: dbName,
          username,
          password,
        });
        setConnected(true);
        addNotification({ type: 'success', title: t('databaseManager.connected'), message: t('databaseManager.connectedMessage', { database: dbName, host }) });
        loadTables();
      }
    } catch (err: any) {
      addNotification({ type: 'error', title: t('databaseManager.connectionFailed'), message: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const loadTables = async () => {
    setLoadingTables(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        const tbls = await app.ListSQLTables();
        setTables(tbls || []);
      }
    } catch (err: any) {
      addNotification({ type: 'error', title: t('databaseManager.listTablesFailed'), message: err.message });
    } finally {
      setLoadingTables(false);
    }
  };

  const handleExecuteQuery = async (queryToRun?: string) => {
    const q = queryToRun || sqlQuery;
    if (!q.trim()) return;

    setExecuting(true);
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        const res = await app.ExecuteSQL(q);
        setQueryResult(res);
      }
    } catch (err: any) {
      setQueryResult({ error: err.message });
      addNotification({ type: 'error', title: t('databaseManager.queryError'), message: err.message });
    } finally {
      setExecuting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // @ts-ignore
      const app = window.go?.main?.App;
      if (app) {
        await app.CloseDatabase();
      }
    } finally {
      setConnected(false);
      setTables([]);
      setQueryResult(null);
    }
  };

  return (
    <div style={{ width: '100%', padding: '24px 28px', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
          {t('databaseManager.title')}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          {t('databaseManager.subtitle')}
        </p>
      </div>

      {!connected ? (
        <div
          style={{
            maxWidth: '520px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '24px',
            margin: '20px auto 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Database size={20} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
              {t('databaseManager.connectionProfile')}
            </h2>
          </div>

          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                  {t('databaseManager.host')}
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t('databaseManager.hostPlaceholder')}
                  required
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                  {t('databaseManager.port')}
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                {t('databaseManager.database')}
              </label>
              <input
                type="text"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                placeholder={t('databaseManager.databasePlaceholder')}
                required
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                {t('databaseManager.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('databaseManager.usernamePlaceholder')}
                required
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)' }}>
                {t('databaseManager.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={connecting}
              style={{
                marginTop: '10px',
                padding: '10px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: connecting ? 'not-allowed' : 'pointer',
              }}
            >
              {connecting ? t('databaseManager.connecting') : t('databaseManager.connect')}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px' }}>
          {/* Left: Table browser */}
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '680px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {t('databaseManager.tables', { count: tables.length })}
              </span>
              <button
                onClick={handleDisconnect}
                style={{
                  fontSize: '11px',
                  color: 'var(--color-error)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('databaseManager.disconnect')}
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {tables.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    const q = `SELECT * FROM \`${t}\` LIMIT 50;`;
                    setSqlQuery(q);
                    handleExecuteQuery(q);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <TableIcon size={12} color="var(--color-primary-light)" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: SQL Query Editor and Table Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '12px',
              }}
            >
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder={t('databaseManager.queryPlaceholder')}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#070A10',
                  color: '#F1F5F9',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => handleExecuteQuery()}
                  disabled={executing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: executing ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Play size={13} /> {executing ? t('databaseManager.executing') : t('databaseManager.execute')}
                </button>
              </div>
            </div>

            {/* Results Display */}
            {queryResult && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={12} />
                    <span>{t('databaseManager.time', { time: queryResult.executionTimeMs })}</span>
                    {queryResult.rowsAffected !== undefined && (
                      <span>• {t('databaseManager.affected', { count: queryResult.rowsAffected })}</span>
                    )}
                  </div>
                </div>

                {queryResult.error ? (
                  <div style={{ padding: '16px', color: 'var(--color-error)', fontSize: '13px' }}>
                    {queryResult.error}
                  </div>
                ) : queryResult.columns ? (
                  <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                          {queryResult.columns.map((c: string) => (
                            <th
                              key={c}
                              style={{
                                padding: '8px 12px',
                                textAlign: 'left',
                                borderBottom: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                                fontWeight: 600,
                              }}
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows?.map((row: any[], rIdx: number) => (
                          <tr
                            key={rIdx}
                            style={{
                              borderBottom: '1px solid var(--color-border-subtle)',
                            }}
                          >
                            {row.map((val: any, cIdx: number) => (
                              <td
                                key={cIdx}
                                style={{
                                  padding: '8px 12px',
                                  color: 'var(--color-text-secondary)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {val === null ? <span style={{ color: 'var(--color-text-muted)' }}>{t('databaseManager.nullValue')}</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    {t('databaseManager.statementSuccess')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
