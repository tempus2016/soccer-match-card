class SoccerMatchCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.innerHTML = `
      <div class="form">
        <label for="entity">Entity:</label>
        <input id="entity" name="entity" type="text" value="${config.entity || ''}" />
        
        <label for="title">Title:</label>
        <input id="title" name="title" type="text" value="${config.title || ''}" />
      </div>
    `;

    this.querySelector('#entity').addEventListener('input', (e) => {
      this._config.entity = e.target.value;
      this._updateConfig();
    });

    this.querySelector('#title').addEventListener('input', (e) => {
      this._config.title = e.target.value;
      this._updateConfig();
    });
  }

  _updateConfig() {
    const event = new CustomEvent('config-changed', {
      detail: { config: this._config }
    });
    this.dispatchEvent(event);
  }

  get value() {
    return this._config;
  }
}

customElements.define('soccer-match-card-editor', SoccerMatchCardEditor);
