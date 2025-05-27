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
    const friendlyName = stateObj.attributes.friendly_name || 'Team';
    const teamName = friendlyName.replace(' Match Info', '').trim();

    // Load team logo even if no match exists
    if (!this.logosLoaded || !this.teamLogos[teamName]) {
      this.loadTeamLogo(teamName);
    }

    this.render();
  }

  async loadTeamLogo(teamName) {
    const logo = await this.fetchTeamLogo(teamName);
    this.teamLogos[teamName] = logo;
    this.logosLoaded = true;
    this.render();
  }

  // ... [keep all your existing helper methods like fetchTeamLogo, hasEntityChanged, isValidAttribute]

  render() {
    if (!this._hass || !this.config) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="color:white; padding: 16px;">❌ Waiting for hass/config...</div>
        </ha-card>
      `;
      return;
    }

    const entityId = this.config.entity;
    const stateObj = this._hass.states[entityId];

    if (!stateObj) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="color:white; padding: 16px;">❌ Entity not found: ${entityId}</div>
        </ha-card>
      `;
      return;
    }

    const attributes = stateObj.attributes;
    const friendlyName = stateObj.attributes.friendly_name || 'Team';
    const teamName = friendlyName.replace(' Match Info', '').trim();
    const teamLogo = this.teamLogos[teamName] || '/local/teamlogos/no_image_available.png';

    // Check for valid match data
    const hasValidMatch = this.isValidAttribute(attributes.home_team) && 
                         this.isValidAttribute(attributes.away_team) &&
                         attributes.starttime_datetime && 
                         !isNaN(new Date(attributes.starttime_datetime).getTime());

    if (!hasValidMatch) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div class="no-match-container">
            <div class="team-logo-container">
              <img src="${teamLogo}" alt="${teamName} Logo" class="team-logo">
              <div class="team-name">${teamName}</div>
            </div>
            <div class="no-matches-message">No Upcoming Matches</div>
          </div>
        </ha-card>
      `;
      this.setNoMatchStyle();
      return;
    }

    // Regular match display
    const homeTeam = attributes.home_team;
    const awayTeam = attributes.away_team;
    const homeTeamLogo = this.teamLogos[homeTeam] || '/local/teamlogos/no_image_available.png';
    const awayTeamLogo = this.teamLogos[awayTeam] || '/local/teamlogos/no_image_available.png';
    const league = attributes.league || '';
    const location = attributes.location || '';
    const startDatetime = new Date(attributes.starttime_datetime);
    const endDatetime = new Date(attributes.endtime_datetime);
    const now = new Date();

    // [Keep your existing match status calculation code...]
    let matchStatus = '';
    // ... [your existing match time display logic]

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="match-container">
          <div class="header">${league}</div>
          <div class="teams-row">
            <div class="team">
              <img src="${homeTeamLogo}" alt="${homeTeam} Logo" class="team-logo">
              <div class="team-name">${homeTeam}</div>
            </div>
            <div class="vs-container">
              <div class="kickoff-time">${matchStatus}</div>
            </div>
            <div class="team">
              <img src="${awayTeamLogo}" alt="${awayTeam} Logo" class="team-logo">
              <div class="team-name">${awayTeam}</div>
            </div>
          </div>
          <div class="location">${location}</div>
        </div>
      </ha-card>
    `;
    this.setMatchStyle();
  }

  setNoMatchStyle() {
    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        border-radius: 12px;
        background: linear-gradient(to bottom, #002147 0%, #004080 100%);
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
      }
      .no-match-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 20px;
        text-align: center;
      }
      .team-logo-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 20px;
      }
      .team-logo {
        width: 100px;
        height: 100px;
        object-fit: contain;
      }
      .team-name {
        font-size: 22px;
        font-weight: bold;
        margin-top: 10px;
      }
      .no-matches-message {
        font-size: 18px;
        color: #ccc;
        margin-top: 10px;
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  setMatchStyle() {
    const style = document.createElement('style');
    style.textContent = `
      ha-card {
        border-radius: 12px;
        background: linear-gradient(to bottom, #002147 0%, #004080 100%);
        color: #fff;
      }
      /* [Keep your existing match styling...] */
    `;
    this.shadowRoot.appendChild(style);
  }
}

customElements.define('soccer-match-card', SoccerMatchCard);
