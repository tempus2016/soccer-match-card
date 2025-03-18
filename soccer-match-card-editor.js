import { LitElement, html } from "https://unpkg.com/lit-element?module";

class SoccerMatchCardEditor extends LitElement {

  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  setConfig(config) {
    this._config = config;
  }

  render() {
    if (!this.hass) return html``;

    return html`
      <ha-form>
        <!-- Entity selector for sensor domains -->
        <ha-selector
          .label=${"Entity"}
          .hass=${this.hass}
          .configValue=${"entity"}
          .selector=${{
            entity: { domain: "sensor" },
          }}
          .value=${this._config.entity}
          @value-changed=${this._valueChanged}
        ></ha-selector>

        <!-- Title input -->
        <ha-textfield
          label="Title"
          .value=${this._config.title || ""}
          configValue="title"
          @input=${this._valueChanged}
        ></ha-textfield>
      </ha-form>
    `;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target;
    const configValue = target.getAttribute("configValue");
    const value = ev.detail?.value !== undefined ? ev.detail.value : target.value;

    if (this._config[configValue] === value) {
      return;
    }

    this._config = {
      ...this._config,
      [configValue]: value,
    };

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
      })
    );
  }
}

customElements.define("soccer-match-card-editor", SoccerMatchCardEditor);
