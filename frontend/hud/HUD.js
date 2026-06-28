class HUD {
  constructor() {
    this.timeline   = new Timeline();
    this.population = new PopulationDisplay();
    this.rankings   = new CivRankings();
    this.statusBox  = new StatusBox();
    this.heatmap    = new EconomicHeatmap();
  }

  init() {
    this.timeline.init();
    this.population.init();
    this.rankings.init();
    this.statusBox.init();
    this.heatmap.init();
  }
}

window.HUD = HUD;
