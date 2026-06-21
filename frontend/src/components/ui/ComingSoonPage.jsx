export default function ComingSoonPage({ title, description, features = [] }) {
  return (
    <div className="lp-card lp-coming-soon">
      <div className="lp-coming-soon-badge">Coming soon</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {features.length > 0 && (
        <ul className="lp-coming-soon-list">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
