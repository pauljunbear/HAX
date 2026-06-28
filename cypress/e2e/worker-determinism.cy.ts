/**
 * Determinism gate: the render worker must be byte-identical to the main thread.
 * Drives /devtest/worker (which renders the same stack both ways and diffs bytes)
 * and asserts PASS. Cypress waits for the async worker round-trip to settle.
 */
describe('render worker determinism', () => {
  it('worker output is byte-identical to the main thread', () => {
    cy.visit('/devtest/worker');
    cy.get('[data-testid="report"]', { timeout: 45000 })
      .should('not.contain', 'running')
      .then($el => {
        // surface the full report in the Cypress log for diagnosis
        // eslint-disable-next-line no-console
        cy.log($el.text());
      });
    cy.get('[data-testid="status"]').should('contain', 'PASS');
  });
});
