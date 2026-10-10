import React from 'react';

function ProofGraph({ graph }) {
  if (!graph || !Array.isArray(graph.nodes)) {
    return (
      <div className="proof-graph-empty">
        <p>ProofGraph is not available for this audit.</p>
        <p>Run a new audit to generate claim-to-evidence connections.</p>
      </div>
    );
  }

  const nodes = graph.nodes;
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const summary = graph.summary || {};

  const claims = nodes.filter((node) => node.type === 'claim');
  const evidenceNodes = nodes.filter((node) => node.type === 'evidence');
  const sections = nodes.filter((node) => node.type === 'section');

  const getConnections = (nodeId, edgeType) =>
    edges
      .filter((edge) => edge.type === edgeType && edge.source === nodeId)
      .map((edge) => nodes.find((node) => node.id === edge.target))
      .filter(Boolean);

  const statusLabel = (status) => {
    if (status === 'found') return 'Verified';
    if (status === 'partial') return 'Partial match';
    if (status === 'not_found') return 'Not verified';
    return status || 'Unknown';
  };

  return (
    <div className="proof-graph-container">
      <p className="proof-graph-intro">
        Trace each advertising claim to its supporting evidence and the
        landing-page section where that evidence appears.
      </p>

      <div className="proof-graph-stats">
        <div className="proof-graph-stat">
          <strong>{summary.claimCount ?? claims.length}</strong>
          <span>Claims</span>
        </div>
        <div className="proof-graph-stat">
          <strong>{summary.evidenceCount ?? evidenceNodes.length}</strong>
          <span>Evidence</span>
        </div>
        <div className="proof-graph-stat">
          <strong>{summary.sectionCount ?? sections.length}</strong>
          <span>Sections</span>
        </div>
        <div className="proof-graph-stat">
          <strong>{summary.connectionCount ?? edges.length}</strong>
          <span>Connections</span>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="proof-graph-empty">
          No advertising claims were found in this graph.
        </div>
      ) : (
        <div className="proof-graph-flow">
          {claims.map((claim) => {
            const linkedEvidence = getConnections(claim.id, 'supported_by');

            return (
              <article className="proof-graph-chain" key={claim.id}>
                <div className="proof-graph-node proof-graph-claim">
                  <span className="proof-graph-node-label">
                    <span aria-hidden="true">●</span> AD CLAIM
                  </span>
                  <strong>{claim.label}</strong>
                  <span
                    className={`proof-graph-status status-${claim.status || 'unknown'}`}
                  >
                    {statusLabel(claim.status)}
                  </span>
                </div>

                <div className="proof-graph-connector">
                  <span aria-hidden="true">↓</span>
                  <span>Supported by</span>
                </div>

                {linkedEvidence.length === 0 ? (
                  <div className="proof-graph-node proof-graph-unverified">
                    <span className="proof-graph-node-label">EVIDENCE</span>
                    <strong>No supporting evidence connected</strong>
                    <span>
                      The claim has no verified evidence node in this graph.
                    </span>
                  </div>
                ) : (
                  linkedEvidence.map((item) => {
                    const linkedSections = getConnections(item.id, 'located_in');

                    return (
                      <div className="proof-graph-evidence-group" key={item.id}>
                        <div className="proof-graph-node proof-graph-evidence">
                          <span className="proof-graph-node-label">
                            <span aria-hidden="true">✓</span> EVIDENCE
                          </span>
                          <strong>{item.text || item.label}</strong>
                          <span className="proof-graph-status status-found">
                            {statusLabel(item.status)}
                          </span>
                        </div>

                        <div className="proof-graph-connector">
                          <span aria-hidden="true">↓</span>
                          <span>Located in</span>
                        </div>

                        {linkedSections.length === 0 ? (
                          <div className="proof-graph-node proof-graph-section">
                            <span className="proof-graph-node-label">
                              PAGE SECTION
                            </span>
                            <strong>Source section not linked</strong>
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
                              <strong>{section.label}</strong>
                              {section.text && <p>{section.text}</p>}
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