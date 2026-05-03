interface LandingPageProps {
  onLaunch: () => void;
}

const featureHighlights = [
  {
    title: "Live conditions",
    body: "Bring wind, humidity, gusts, and ignition location into one operational view before routes are chosen.",
  },
  {
    title: "Spread uncertainty",
    body: "Run Monte Carlo wildfire spread so decisions account for probability, not a single brittle forecast.",
  },
  {
    title: "Route viability",
    body: "Compare baseline and optimized paths by survival score, cutoff time, and population at risk.",
  },
  {
    title: "Evacuation order",
    body: "Prioritize zones by urgency so response teams can explain who moves first and why.",
  },
];

const problemStatements = [
  "Wind shifts faster than static evacuation plans can update.",
  "Route closures and fire arrival times are hard to compare under pressure.",
  "Residents need safer paths, not just nearest roads.",
  "Incident teams need defensible decisions they can brief quickly.",
];

export function LandingPage({ onLaunch }: LandingPageProps) {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-label="evacu8 wildfire evacuation intelligence">
        <nav className="landing-nav" aria-label="Landing navigation">
          <a className="landing-brand" href="#top" aria-label="evacu8 home">
            evacu8
          </a>
          <div className="landing-nav__links">
            <a href="#features">Features</a>
            <a href="#problem">Problem</a>
            <button type="button" onClick={onLaunch}>
              Launch demo
            </button>
          </div>
        </nav>

        <div className="landing-hero__content" id="top">
          <span className="landing-kicker">Wildfire Evacuation Intelligence</span>
          <h1>evacu8</h1>
          <p>
            Turn live fire conditions, spread uncertainty, and route viability into clear
            evacuation decisions before minutes become miles.
          </p>
          <div className="landing-hero__actions">
            <button className="landing-primary" type="button" onClick={onLaunch}>
              Enter command center
            </button>
            <a className="landing-secondary" href="#features">
              See the system
            </a>
          </div>
        </div>

      </section>

      <section className="landing-signal-grid" aria-label="Core system signals">
        <div>
          <strong>Live wind</strong>
          <span>NOAA-ready inputs</span>
        </div>
        <div>
          <strong>5-15 runs</strong>
          <span>uncertainty modeled</span>
        </div>
        <div>
          <strong>Route scores</strong>
          <span>safer path ranking</span>
        </div>
        <div>
          <strong>Zone priority</strong>
          <span>actionable ordering</span>
        </div>
      </section>

      <section className="landing-section landing-section--features" id="features">
        <div className="landing-section__intro">
          <span className="landing-kicker">What judges should notice</span>
          <h2>Not a map demo. A decision system.</h2>
          <p>
            evacu8 connects simulation, live conditions, and evacuation logistics into a
            workflow responders can use when the situation changes.
          </p>
        </div>
        <div className="landing-feature-grid">
          {featureHighlights.map((feature, index) => (
            <article className="landing-feature-card" key={feature.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-problem" id="problem">
        <div className="landing-problem__copy">
          <span className="landing-kicker">The problem</span>
          <h2>Evacuation planning breaks when fire behavior changes.</h2>
          <p>
            Current tools often make teams stitch together weather, fire spread, road
            capacity, shelters, and evacuation zones while lives depend on fast choices.
            evacu8 makes those tradeoffs visible in one place.
          </p>
        </div>
        <div className="landing-problem__list" aria-label="Problems evacu8 addresses">
          {problemStatements.map((statement) => (
            <div key={statement}>
              <span aria-hidden="true" />
              <p>{statement}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-final">
        <div>
          <span className="landing-kicker">Demo ready</span>
          <h2>Open the command center and show the full workflow.</h2>
        </div>
        <button className="landing-primary" type="button" onClick={onLaunch}>
          Launch evacu8
        </button>
      </section>
    </main>
  );
}
