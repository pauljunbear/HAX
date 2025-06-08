describe('Onboarding Tour', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should show onboarding tour for first-time visitors', () => {
    // Clear any existing tour state
    cy.clearLocalStorage()
    
    // Check if tour starts automatically
    cy.get('[data-testid="onboarding-tour"]').should('be.visible')
    
    // Verify each step of the tour
    const tourSteps = [
      'upload-section',
      'effects-panel',
      'canvas-area',
      'export-options'
    ]
    
    tourSteps.forEach((step, index) => {
      cy.get(`[data-testid="tour-step-${step}"]`).should('be.visible')
      if (index < tourSteps.length - 1) {
        cy.get('[data-testid="tour-next"]').click()
      }
    })
    
    // Complete tour
    cy.get('[data-testid="tour-complete"]').click()
    cy.get('[data-testid="onboarding-tour"]').should('not.exist')
  })

  it('should allow skipping the tour', () => {
    cy.get('[data-testid="tour-skip"]').click()
    cy.get('[data-testid="onboarding-tour"]').should('not.exist')
  })

  it('should remember completed tour state', () => {
    // Complete the tour
    cy.get('[data-testid="tour-complete"]').click()
    
    // Refresh page
    cy.reload()
    
    // Tour should not appear again
    cy.get('[data-testid="onboarding-tour"]').should('not.exist')
  })

  it('should be keyboard accessible', () => {
    cy.get('body').tab()
    cy.focused().should('have.attr', 'data-testid', 'tour-next')
    
    // Navigate through tour with keyboard
    cy.focused().type('{enter}') // Next
    cy.focused().should('have.attr', 'data-testid', 'tour-next')
    
    cy.focused().type('{enter}') // Next
    cy.focused().should('have.attr', 'data-testid', 'tour-complete')
    
    cy.focused().type('{enter}') // Complete
    cy.get('[data-testid="onboarding-tour"]').should('not.exist')
  })
}) 