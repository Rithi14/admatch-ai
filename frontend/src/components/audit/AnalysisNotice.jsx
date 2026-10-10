import ErrorMessage from '../common/ErrorMessage';

/**
 * Honest labelling of how a result was produced.
 * Demo results are never described as verified AI or live website analysis.
 */
export default function AnalysisNotice({ audit }) {
  const { analysis, mode } = audit;

  if (mode === 'demo') {
    return (
      <ErrorMessage
        variant="warning"
        title={audit.isSample ? 'Sample audit · demo analysis' : 'Demo analysis · not verified'}
        message={`${analysis.note || 'Produced by a keyword-matching demo.'} ${audit.isSample ? 'This is built-in example data, not a real customer audit. ' : ''}Treat the score and quotes as illustrations.`}
      />
    );
  }
  if (!analysis.verified) {
    return (
      <ErrorMessage
        variant="warning"
        title="Backend result not marked as verified"
        message={`Produced by “${analysis.engineLabel}”. The backend did not state that its evidence was verified, so check findings against the real landing page. ${analysis.note || ''}`}
      />
    );
  }
  return (
    <ErrorMessage
      variant="info"
      title={`Analysed by ${analysis.engineLabel}`}
      message={analysis.note || 'The backend reports that quotations were validated against the fetched page.'}
    />
  );
}
