import { LitElement, html, css } from "https://unpkg.com/lit-element?module";

class SoccerMatchCard extends LitElement {

  static get properties() {
    return {
      hass: {},
      config: {},
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define an entity");
    }
    this.config = config;
  }

  static get styles() {
    return css`
      .card {
        padding: 16px;
      }
      h1 {
        font-size: 20px;
        margin: 0 0 10px 0;
      }
      .info {
        font-size: 14px;
        color: var(--secondary-text-color);
      }
    `;
  }

  getCardSize() {
    return 1;
  }

  render() {
    if (!this.hass || !this.config) {
      return html`<ha-card>Loading...</ha-card>`;
    }

    const entityState = this.hass.states[this.config.entity];

    if (!entityState) {
      return html`<ha-card>Entity not found: ${this.config.entity}</ha-card>`;
    }

    return html`
      <ha-card header="${this.config.title || 'Soccer Match'}">
        <div class="card">
          <div class="info">
            Match Info:<br />
            ${entityState.state}
          </div>
        </div>
      </ha-card>
    `;
  }

  // Link the editor here
  static getConfigElement() {
    return document.createElement("soccer-match-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "",
      title: "Soccer Match"
    };
  }
}

customElements.define("soccer-match-card", SoccerMatchCard);
