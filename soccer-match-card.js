class SoccerMatchCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("You need to define an entity");
    }
    this.config = config;
    this.innerHTML = `
      <ha-card header="Soccer Match Card">
        <div style="padding: 16px;">Entity: ${this.config.entity}</div>
      </ha-card>
    `;
  }

  static getConfigElement() {
    return document.createElement('soccer-match-card-editor');
  }

  static getStubConfig() {
    return { entity: 'sensor.example_sensor' };
  }
}

customElements.define('soccer-match-card', SoccerMatchCard);

class SoccerMatchCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  render() {
    if (!this._hass) return;

    const entity = this._config?.entity || '';
    this.shadowRoot.innerHTML = `
      <style>.form { padding: 16px; }</style>
      <div class="form">
        <ha-entity-picker
          .hass=${this._hass}
          .value=${entity}
          .configValue=${"entity"}
          include-domains="sensor"
        ></ha-entity-picker>
      </div>
    `;

    this.shadowRoot.querySelector('ha-entity-picker')
      ?.addEventListener('value-changed', (e) => this._valueChanged(e));
  }

  _valueChanged(ev) {
    const target = ev.target;
    if (!target || !target.configValue) return;

    this._config = {
      ...this._config,
      [target.configValue]: target.value,
    };

    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
    }));
  }
}

customElements.define('soccer-match-card-editor', SoccerMatchCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'soccer-match-card',
  name: 'Soccer Match Card',
  description: 'Displays soccer match info with UI editor.',
});
