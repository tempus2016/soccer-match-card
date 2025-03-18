class SoccerMatchCard extends HTMLElement {

  // Called when Lovelace sets up the card with its config
  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define an entity");
    }

    this._config = config;

    // Clear old content
    this.innerHTML = '';

    // Create a card element
    const card = document.createElement('ha-card');
    card.header = this._config.title || 'Soccer Match Card';

    // Create content container
    const content = document.createElement('div');
    content.style.padding = '16px';
    content.innerHTML = `
      <p>Entity: ${this._config.entity}</p>
      <p>More match info will go here...</p>
    `;

    card.appendChild(content);
    this.appendChild(card);
  }

  // Return the config if needed
  getCardSize() {
    return 1;
  }

  // Called when Home Assistant state changes
  set hass(hass) {
    this._hass = hass;

    if (!this._config || !this._hass) return;

    const entityState = this._hass.states[this._config.entity];

    if (!entityState) {
      this.innerHTML = `<ha-card><div style="padding: 16px;">Entity not found: ${this._config.entity}</div></ha-card>`;
      return;
    }

    // Example of showing entity state
    this.innerHTML = `
      <ha-card header="${this._config.title || 'Soccer Match'}">
        <div style="padding: 16px;">
          <strong>Match Info:</strong>
          <pre>${entityState.state}</pre>
        </div>
      </ha-card>
    `;
  }

  // This tells Lovelace where the config editor is
  static async getConfigElement() {
    await import('./soccer-match-card-editor.js');
    return document.createElement('soccer-match-card-editor');
  }

  // Default config example when adding a new card
  static getStubConfig() {
    return {
      entity: '',
      title: 'Soccer Match'
    };
  }
}

customElements.define('soccer-match-card', SoccerMatchCard);
