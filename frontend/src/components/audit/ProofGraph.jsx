import React from 'react';

function ProofGraph({ graph, mode }) {
  if (!graph || !Array.isArray(graph.nodes)) {
    return (
      <div className="proof-graph-empty">
        <h3>Proof Graph Unavailable</h3>
        <p>
          This audit does not contain proof graph data.
          Run a new audit to generate claim and evidence connections.
        </p>
      </div>
    );
  }

  const nodes = graph.nodes;
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const summary = graph.summary || {};

  const claims = nodes.filter((node) => node.type === 'claim');
  const evidenceNodes = nodes.filter(
    (node) => node.type === 'evidence'
  );
  const sections = nodes.filter((node) => node.type === 'section');

  const getConnections = (nodeId, edgeTypes) => {
    const acceptedTypes = Array.isArray(edgeTypes)
      ? edgeTypes
      : [edgeTypes];

    return edges
      .filter(
        (edge) =>
          edge.source === nodeId &&
          acceptedTypes.includes(edge.type)
      )
      .map((edge) =>
        nodes.find((node) => node.id === edge.target)
      )
      .filter(Boolean);
  };

  const normalizeStatus = (status) => {
    const value = String(status || 'unknown').toLowerCase();

    if (['found', 'verified', 'supported'].includes(value)) return 'found';
    if (['partial', 'partially_supported', 'weak'].includes(value)) return 'partial';
    if (['not_found', 'unsupported', 'missing'].includes(value)) return 'not_found';
    if (value === 'contradicted') return 'contradicted';
    return 'unknown';
  };

  const statusLabel = (status) => {
    switch (normalizeStatus(status)) {
      case 'found':
        return 'Evidence found';
      case 'partial':
        return 'Partial evidence';
      case 'not_found':
        return 'Not verified';
      case 'contradicted':
        return 'Potential contradiction';
      default:
        return 'Needs review';
    }
  };

  const getStatusClass = (status) => `status-${normalizeStatus(status)}`;

  return (
    <div className="proof-graph-container">
      <p className="proof-graph-intro">
        Connections show text matches returned by the audit; they do not
        establish that an advertising claim is factually true.
        {mode === 'demo' && ' Demo results use browser keyword matching and are not verified AI analysis.'}
      </p>

      <div className="proof-graph-stats">
        <div className="proof-graph-stat">
          <strong>
            {summary.claimCount ?? claims.length}
          </strong>
          <span>Claims</span>
        </div>

        <div className="proof-graph-stat">
          <strong>
            {summary.evidenceCount ?? evidenceNodes.length}
          </strong>
          <span>Evidence</span>
        </div>

        <div className="proof-graph-stat">
          <strong>
            {summary.sectionCount ?? sections.length}
          </strong>
          <span>Sections</span>
        </div>

        <div className="proof-graph-stat">
          <strong>
            {summary.connectionCount ?? edges.length}
          </strong>
          <span>Connections</span>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="proof-graph-empty">
          <h3>No Claims Found</h3>
          <p>
            The proof graph contains no advertising claim nodes.
          </p>
        </div>
      ) : (
        <div className="proof-graph-flow">
          {claims.map((claim) => {
            const linkedEvidence = getConnections(claim.id, [
              'supported_by',
              'partially_supported_by',
            ]);

            return (
              <article
                className="proof-graph-chain"
                key={claim.id}
              >
                <div className="proof-graph-node proof-graph-claim">
                  <span className="proof-graph-node-label">
                    <span aria-hidden="true">●</span> AD CLAIM
                  </span>

                  <strong>
                    {claim.label || 'Unnamed advertising claim'}
                  </strong>

                  <span
                    className={`proof-graph-status ${getStatusClass(
                      claim.status
                    )}`}
                  >
                    {statusLabel(claim.status)}
                  </span>
                </div>

                <div className="proof-graph-connector">
                  <span aria-hidden="true">↓</span>
                  <span>Evidence relationship</span>
                </div>

                {linkedEvidence.length === 0 ? (
                  <div className="proof-graph-node proof-graph-unverified">
                    <span className="proof-graph-node-label">
                      EVIDENCE
                    </span>

                    <strong>
                      No supporting quotation available
                    </strong>

                    <p>
                      The audit did not provide a found or partial
                      quotation for this claim. This does not prove
                      that the claim is false.
                    </p>
                  </div>
                ) : (
                  linkedEvidence.map((item) => {
                    const linkedSections = getConnections(
                      item.id,
                      'located_in'
                    );

                    return (
                      <div
                        className="proof-graph-evidence-group"
                        key={item.id}
                      >
                        <div
                          className={`proof-graph-node ${
                            normalizeStatus(item.status) === 'partial'
                              ? 'proof-graph-unverified'
                              : 'proof-graph-evidence'
                          }`}
                        >
                          <span className="proof-graph-node-label">
                            <span aria-hidden="true">
                              {normalizeStatus(item.status) === 'partial' ? '◐' : '✓'}
                            </span>{' '}
                            PAGE EVIDENCE
                          </span>

                          <strong>
                            {item.text ||
                              item.label ||
                              'Evidence text unavailable'}
                          </strong>

                          <span
                            className={`proof-graph-status ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>

                        <div className="proof-graph-connector">
                          <span aria-hidden="true">↓</span>
                          <span>Source location</span>
                        </div>

                        {linkedSections.length === 0 ? (
                          <div className="proof-graph-node proof-graph-section">
                            <span className="proof-graph-node-label">
                              PAGE SECTION
                            </span>

                            <strong>
                              Exact section not identified
                            </strong>

                            <p>
                              A quotation is available, but no exact
                              section connection was established.
                            </p>
                          </div>
                        ) : (
                          linkedSections.map((section) => (
                            <div
                              className="proof-graph-node proof-graph-section"
                              key={section.id}
                            >
                              <span className="proof-graph-node-label">
                                PAGE SECTION
                              </span>

                              <strong>
                                {section.label || 'Page content'}
                              </strong>

                              {section.text && (
                                <p>
                                  {section.text.length > 500
                                    ? `${section.text.slice(0, 500)}…`
                                    : section.text}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProofGraph;