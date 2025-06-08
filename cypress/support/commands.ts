import { checkA11y } from 'cypress-axe'

// Custom command to check accessibility
Cypress.Commands.add('checkA11y', () => {
  cy.injectAxe()
  cy.checkA11y()
})

// Custom command to test skip to content functionality
Cypress.Commands.add('skipToContent', () => {
  cy.get('body').tab()
  cy.focused().should('have.attr', 'href', '#main-content')
  cy.focused().click()
  cy.get('#main-content').should('be.focused')
}) 