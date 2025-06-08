describe('Accessibility and Onboarding', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should pass accessibility checks on the main page', () => {
    cy.checkA11y()
  })

  it('should have working skip to content link', () => {
    cy.skipToContent()
  })

  it('should have proper ARIA labels on all interactive elements', () => {
    cy.get('button, [role="button"], a, input, select, textarea').each(($el) => {
      cy.wrap($el).should('have.attr', 'aria-label').or('have.attr', 'aria-labelledby')
    })
  })

  it('should maintain focus management during modal interactions', () => {
    // Open a modal (assuming there's a button to open it)
    cy.get('[data-testid="open-modal"]').click()
    
    // Check if focus is trapped in modal
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('body').tab()
    cy.focused().should('be.within', '[role="dialog"]')
    
    // Close modal and check focus returns
    cy.get('[data-testid="close-modal"]').click()
    cy.get('[data-testid="open-modal"]').should('be.focused')
  })

  it('should have proper heading hierarchy', () => {
    cy.get('h1, h2, h3, h4, h5, h6').each(($el, index, $list) => {
      if (index > 0) {
        const currentLevel = parseInt($el.prop('tagName')[1])
        const prevLevel = parseInt($list[index - 1].tagName[1])
        expect(currentLevel - prevLevel).to.be.lessThan(2)
      }
    })
  })
}) 