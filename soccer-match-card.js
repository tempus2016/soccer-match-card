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
      prev.attributes.starttime_datetime !== curr.attributes.starttime_datetime ||
      prev.attributes.endtime_datetime !== curr.attributes.endtime_datetime ||
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
    const localLogoPath = `/local/teamlogos/${teamName.toLowerCase().replace(/ /g, '_')}.png`;
    try {
      const response = await fetch(localLogoPath);
      if (response.ok) {
        return localLogoPath;
      } else {
        throw new Error('Logo not found locally');
      }
    } catch (error) {
      console.log('Logo not found locally, fetching from API...');
      const apiKey = '3';
      const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch team info for ${teamName}`);

        const data = await response.json();
        const team = data.teams ? data.teams[0] : null;

        if (team && team.strBadge) {
          const logoUrl = team.strBadge;
          const logoFilename = `${teamName.toLowerCase().replace(/ /g, '_')}.png`;
          await this._hass.callService('downloader', 'download_file', {
            overwrite: true,
            url: logoUrl,
            filename: `${logoFilename}`,
          });

          return `/local/teamlogos/${logoFilename}`;
        } else {
          console.warn(`No logo found for team: ${teamName}`);
          return '/local/teamlogos/no_image_available.png';
        }
      } catch (error) {
        console.error(`Error fetching logo for ${teamName}:`, error);
        return '/local/teamlogos/no_image_available.png';
      }
    }
  }

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

    // Check each attribute before displaying
    const league = this.isValidAttribute(attributes.league) ? attributes.league : '';
    const homeTeam = this.isValidAttribute(attributes.home_team) ? attributes.home_team : '';
    const awayTeam = this.isValidAttribute(attributes.away_team) ? attributes.away_team : '';
    const location = this.isValidAttribute(attributes.location) ? attributes.location : '';
    const startDatetime = new Date(attributes.starttime_datetime);
    const endDatetime = new Date(attributes.endtime_datetime);

    const now = new Date();

    // Check if the match is "In Play"
    const isInPlay = now >= startDatetime && now <= endDatetime;

    // Determine if the match is today or tomorrow
    const matchDate = startDatetime.toLocaleDateString();
    const today = new Date().toLocaleDateString();
    const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString(); // 24 hours from now

    let matchStatus = '';

    if (isInPlay) {
      const matchTime = startDatetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      matchStatus = `<span class="status-line start-time">In Play</span>`;
    } else if (matchDate === today) {
      const matchTime = startDatetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>Today</p></span>`;
    } else if (matchDate === tomorrow) {
      const matchTime = startDatetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>Tomorrow</p></span>`;
    } else {
      const day = startDatetime.getDate();
      const month = startDatetime.toLocaleDateString('en-US', { month: 'long' });
      const matchTime = startDatetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      matchStatus = `<span class="status-line start-time">${matchTime}</span><span class="status-line"><p>${day} ${month}</p></span>`;
    }

    // Skip rendering if essential attributes are missing
    if (!homeTeam || !awayTeam || !matchStatus || !league) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="color:white; padding: 16px;">❌ Missing match information</div>
        </ha-card>
      `;
      return;
    }

    const homeTeamLogo = this.teamLogos[homeTeam] || '/local/teamlogos/no_image_available.png';
    const awayTeamLogo = this.teamLogos[awayTeam] || '/local/teamlogos/no_image_available.png';

    // Dynamically set the margin for location
    const locationStyle = location ? '' : 'margin-bottom: 20px;';

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
              <div class="kickoff-time">${matchStatus}</div> <!-- Display the match status -->
            </div>
            <div class="team">
              <img src="${awayTeamLogo}" alt="${awayTeam} Logo" class="team-logo">
              <div class="team-name">${awayTeam}</div>
            </div>
          </div>
          <div class="location" style="${locationStyle}">${location}</div> <!-- Add conditional margin -->
        </div>
      </ha-card>
    `;

    this.setStyle();
  }

  getDaySuffix(day) {
    if (day === 11 || day === 12 || day === 13) {
      return 'th';
    }

    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  isValidAttribute(attribute) {
    return attribute && attribute.toLowerCase() !== 'unknown' && attribute !== '';
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
        font-size: 20px;
        text-align: center;
      }

      .vs-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 0.6;
        color: #fff;
      }

      .kickoff-time {
        font-size: 14px;
        text-align: center;
      }

      .status-line {
        display: block;
        text-align: center;
        font-size: 14px;
        font-weight: bold;
      }

      .status-line p {
        font-size: 16px;
        line-height: 0px;
        color: #ccc;
      }

      .start-time {
        font-size: 30px;
        height: 22px;
      }

      .location {
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
