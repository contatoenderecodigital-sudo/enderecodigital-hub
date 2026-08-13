export default function PageHead({
  eyebrow,
  titulo,
  sub,
  acao,
}: {
  eyebrow: string;
  titulo: string;
  sub?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{titulo}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}
