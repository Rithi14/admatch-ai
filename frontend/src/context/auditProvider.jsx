import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuditContext } from './auditContext';
import { useToast } from '../hooks/useToast';
import * as api from '../services/auditApi';
import * as store from '../services/storage';
import { describeError } from '../services/apiClient';
import { MODES } from '../utils/constants';
import { pluralize } from '../utils/formatters';

const sortNewest = (items) =>
  [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const newId = () =>
  `fail_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function initialMode() {
  return store.loadPrefs().mode || api.DEFAULT_MODE;
}

export function AuditProvider({ children }) {
  const { success, error, warning } = useToast();

  const [mode, setModeState] = useState(initialMode);
  const [audits, setAudits] = useState([]);
  const [allFailed, setAllFailed] = useState(() => store.loadFailed());
  const [recStatus, setRecStatus] = useState(() => store.loadRecStatus());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const loadToken = useRef(0);

  const failed = useMemo(
    () => allFailed.filter((item) => item.mode === mode),
    [allFailed, mode]
  );

  // Load audits for the selected mode.
  const refresh = useCallback(async () => {
    const token = ++loadToken.current;

    setLoading(true);
    setLoadError(null);

    try {
      const result = await api.listAudits(mode);

      if (token !== loadToken.current) {
        return;
      }

      setAudits(sortNewest(result.items));

      if (result.corrupted) {
        warning(
          'Saved data was unreadable',
          'Your previous browser data could not be read and was reset. A backup copy was kept in browser storage.'
        );
      } else if (result.skipped > 0) {
        warning(
          'Some records were skipped',
          `${pluralize(result.skipped, 'saved audit')} had an invalid format and could not be shown.`
        );
      }
    } catch (err) {
      if (token !== loadToken.current) {
        return;
      }

      setAudits([]);
      setLoadError(describeError(err));
    } finally {
      if (token === loadToken.current) {
        setLoading(false);
      }
    }
  }, [mode, warning]);

  useEffect(() => {
    refresh();

    return () => {
      loadToken.current += 1;
    };
  }, [refresh]);

  // Change application mode.
  const setMode = useCallback((next) => {
    if (next !== MODES.demo && next !== MODES.live) {
      return;
    }

    setModeState(next);
    setSubmitError(null);

    try {
      store.savePrefs({ mode: next });
    } catch {
      // The preference may not persist.
    }
  }, []);

  // Save failed audit attempts.
  const persistFailed = useCallback((next) => {
    setAllFailed(next);

    try {
      store.saveFailed(next);
    } catch {
      // Non-critical storage error.
    }
  }, []);

  const removeFailed = useCallback(
    (id) => {
      persistFailed(allFailed.filter((item) => item.id !== id));
    },
    [allFailed, persistFailed]
  );

  // Create a new audit.
  const runAudit = useCallback(
    async (values) => {
      setAnalyzing(true);
      setSubmitError(null);

      try {
        const audit = await api.createAudit(mode, values);

        setAudits((previous) => [audit, ...previous]);

        success('Audit complete', `Match score ${audit.score}/100.`);

        return audit;
      } catch (err) {
        const message = describeError(err);

        setSubmitError(message);

        const attempt = {
          id: newId(),
          createdAt: new Date().toISOString(),
          status: 'failed',
          mode,
          input: {
            headline: values.headline,
            body: values.body,
            cta: values.cta || '',
            url: values.url,
            audience: values.audience || '',
            goal: values.goal || '',
            industry: values.industry || '',
          },
          pageText: values.pageText || '',
          error: message,
        };

        persistFailed([attempt, ...allFailed].slice(0, 20));

        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    [mode, success, allFailed, persistFailed]
  );

  // Retry a failed audit.
  const retryFailed = useCallback(
    async (id) => {
      const attempt = allFailed.find((item) => item.id === id);

      if (!attempt) {
        return null;
      }

      setAnalyzing(true);
      setSubmitError(null);

      try {
        const audit = await api.createAudit(attempt.mode, {
          ...attempt.input,
          pageText: attempt.pageText,
        });

        if (attempt.mode === mode) {
          setAudits((previous) => [audit, ...previous]);
        }

        persistFailed(allFailed.filter((item) => item.id !== id));

        success('Retry succeeded', `Match score ${audit.score}/100.`);

        return audit;
      } catch (err) {
        const message = describeError(err);

        setSubmitError(message);

        persistFailed(
          allFailed.map((item) =>
            item.id === id
              ? {
                  ...item,
                  error: message,
                  createdAt: new Date().toISOString(),
                }
              : item
          )
        );

        error('Retry failed', message);

        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    [allFailed, mode, success, error, persistFailed]
  );

  // Save recommendation progress.
  const persistRecs = useCallback(
    (next) => {
      setRecStatus(next);

      try {
        store.saveRecStatus(next);
      } catch (err) {
        error('Progress not saved', describeError(err));
      }
    },
    [error]
  );

  const toggleRecommendation = useCallback(
    (auditId, recId) => {
      const forAudit = {
        ...(recStatus[auditId] || {}),
      };

      if (forAudit[recId]) {
        delete forAudit[recId];
      } else {
        forAudit[recId] = true;
      }

      const next = { ...recStatus };

      if (Object.keys(forAudit).length > 0) {
        next[auditId] = forAudit;
      } else {
        delete next[auditId];
      }

      persistRecs(next);
    },
    [recStatus, persistRecs]
  );

  const resetRecommendationProgress = useCallback(() => {
    persistRecs({});
  }, [persistRecs]);

  // Delete one audit.
  const removeAudit = useCallback(
    async (id) => {
      try {
        await api.deleteAudit(mode, id);

        setAudits((previous) => previous.filter((audit) => audit.id !== id));

        if (recStatus[id]) {
          const next = { ...recStatus };
          delete next[id];
          persistRecs(next);
        }

        success('Audit deleted');
        return true;
      } catch (err) {
        error('Could not delete the audit', describeError(err));
        return false;
      }
    },
    [mode, recStatus, persistRecs, success, error]
  );

  // Delete all audits for the current mode.
  const removeAllAudits = useCallback(async () => {
    try {
      await api.clearAudits(mode);

      const ids = new Set(audits.map((audit) => audit.id));

      setAudits([]);
      persistFailed(allFailed.filter((item) => item.mode !== mode));

      const next = Object.fromEntries(
        Object.entries(recStatus).filter(([id]) => !ids.has(id))
      );

      persistRecs(next);
      success('History cleared');

      return true;
    } catch (err) {
      error('Could not clear history', describeError(err));
      return false;
    }
  }, [mode, audits, allFailed, recStatus, persistFailed, persistRecs, success, error]);

  // Restore sample audits.
  const restoreSamples = useCallback(async () => {
    try {
      const result = await api.restoreSamples(mode);

      setAudits(sortNewest(result.items));

      success('Sample audits restored', 'They are clearly labelled “Sample”.');

      return true;
    } catch (err) {
      error('Could not restore samples', describeError(err));
      return false;
    }
  }, [mode, success, error]);

  // Reset locally saved data.
  const resetAllLocalData = useCallback(() => {
    store.clearAllLocalData();

    setAllFailed([]);
    setRecStatus({});
    setModeState(api.DEFAULT_MODE);
    setSubmitError(null);

    success(
      'Local data reset',
      'Saved demo audits, progress and preferences were removed from this browser.'
    );
  }, [success]);

  // Find an audit or failed attempt by ID.
  const findAudit = useCallback(
    (id) =>
      audits.find((audit) => audit.id === id) ||
      failed.find((item) => item.id === id) ||
      null,
    [audits, failed]
  );

  const clearSubmitError = useCallback(() => {
    setSubmitError(null);
  }, []);

  // Shared state for components using useAudit().
  const value = useMemo(
    () => ({
      mode,
      isDemo: mode === MODES.demo,
      setMode,
      audits,
      failed,
      recStatus,
      loading,
      loadError,
      analyzing,
      submitError,
      storagePersistent: store.isPersistent(),
      refresh,
      runAudit,
      retryFailed,
      removeFailed,
      removeAudit,
      removeAllAudits,
      restoreSamples,
      resetAllLocalData,
      toggleRecommendation,
      resetRecommendationProgress,
      findAudit,
      clearSubmitError,
    }),
    [
      mode,
      setMode,
      audits,
      failed,
      recStatus,
      loading,
      loadError,
      analyzing,
      submitError,
      refresh,
      runAudit,
      retryFailed,
      removeFailed,
      removeAudit,
      removeAllAudits,
      restoreSamples,
      resetAllLocalData,
      toggleRecommendation,
      resetRecommendationProgress,
      findAudit,
      clearSubmitError,
    ]
  );

  return (
    <AuditContext.Provider value={value}>
      {children}
    </AuditContext.Provider>
  );
}

export default AuditProvider;