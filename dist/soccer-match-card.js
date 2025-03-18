class SoccerMatchCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.teamLogos = {};
    this.logosLoaded = false;
    this.previousHomeTeam = '';
    this.previousAwayTeam = '';
    this.previousStateObj = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }

    this.config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;

    if (!this.config) return;

    const entityId = this.config.entity;
    if (!entityId) return;

    const stateObj = this._hass.states[entityId];
    if (!stateObj) return;

    const hasChanged = this.hasEntityChanged(stateObj);
    if (!hasChanged) return;

    const attributes = stateObj.attributes;
    const homeTeam = attributes.home_team || 'Home Team';
    const awayTeam = attributes.away_team || 'Away Team';

    if (
      !this.logosLoaded ||
      homeTeam !== this.previousHomeTeam ||
      awayTeam !== this.previousAwayTeam
    ) {
      this.previousHomeTeam = homeTeam;
      this.previousAwayTeam = awayTeam;
      this.loadTeamLogos(homeTeam, awayTeam);
    }

    this.render();
  }

  hasEntityChanged(newState) {
    if (!this.previousStateObj) {
      this.previousStateObj = newState;
      return true;
    }

    const prev = this.previousStateObj;
    const curr = newState;

    const changed =
      prev.state !== curr.state ||
      prev.attributes.home_team !== curr.attributes.home_team ||
      prev.attributes.away_team !== curr.attributes.away_team ||
      prev.attributes.start_time !== curr.attributes.start_time ||
      prev.attributes.location !== curr.attributes.location ||
      prev.attributes.league !== curr.attributes.league;

    if (changed) {
      this.previousStateObj = curr;
    }

    return changed;
  }

  async loadTeamLogos(homeTeam, awayTeam) {
    const homeLogo = await this.fetchTeamLogo(homeTeam);
    const awayLogo = await this.fetchTeamLogo(awayTeam);

    this.teamLogos[homeTeam] = homeLogo;
    this.teamLogos[awayTeam] = awayLogo;

    this.logosLoaded = true;

    this.render();
  }

  async fetchTeamLogo(teamName) {
    if (this.teamLogos[teamName]) {
      return this.teamLogos[teamName];
    }

    const apiKey = '3'; // Use your API key here
    const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch team info for ${teamName}`);

      const data = await response.json();
      const team = data.teams ? data.teams[0] : null;

      if (team && team.strBadge) {
        const logoUrl = team.strBadge;
        this.teamLogos[teamName] = logoUrl;
        return logoUrl;
      } else {
        console.warn(`No logo found for team: ${teamName}`);
        return 'https://via.placeholder.com/100';
      }

    } catch (error) {
      console.error(`Error fetching logo for ${teamName}:`, error);
      return 'https://via.placeholder.com/100';
    }
  }

render() {
  this.shadowRoot.innerHTML = `
    <ha-card>
      <div style="color:white; padding: 16px;">
        ✅ League: Premiership
      </div>
    </ha-card>
  `;
}

  

  setStyle() {
    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        border-radius: 12px;
        overflow: hidden;
        background: linear-gradient(to bottom, #002147 0%, #004080 100%);
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }

      .match-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px;
      }

      .header {
        width: 100%;
        text-align: center;
        background-color: #d71920;
        color: #fff;
        font-size: 18px;
        font-weight: bold;
        padding: 8px 0;
        letter-spacing: 1px;
      }

      .teams-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin: 16px 0;
      }

      .team {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
      }

      .team-logo {
        width: 80px;
        height: 80px;
        margin-bottom: 8px;
        object-fit: contain;
      }

      .team-name {
        font-size: 16px;
        font-weight: 600;
        text-align: center;
      }

      .vs-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 0.5;
        color: #fff;
      }

      .vs {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 8px;
      }

      .kickoff-time {
        font-size: 14px;
        color: #ccc;
      }

      .location {
        margin-top: 16px;
        font-size: 14px;
        color: #ddd;
        text-align: center;
      }
    `;
    this.shadowRoot.appendChild(style);
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
    this._config = config || {};
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
      <style>
        .form {
          padding: 16px;
        }
      </style>
      <div class="form">
        <ha-entity-picker
          label="Select Sensor Entity"
          .hass=${this._hass}
          .value=${entity}
          .configValue=${"entity"}
          include-domains="sensor"
        ></ha-entity-picker>
      </div>
    `;

    this.shadowRoot
      .querySelector('ha-entity-picker')
      ?.addEventListener('value-changed', (e) => this._valueChanged(e));
  }

  _valueChanged(ev) {
    const target = ev.target;
    if (!this._config || !target) return;

    const value = target.value;

    if (this._config[target.configValue] === value) return;

    this._config = {
      ...this._config,
      [target.configValue]: value,
    };

    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
    }));
  }
}

customElements.define('soccer-match-card-editor', SoccerMatchCardEditor);
