"use client";

export default function ErroCaixa({ reset }: { reset: () => void }) {
  return (
    <section role="alert" style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 24 }}>Não foi possível conferir o caixa</h1>
      <p style={{ color: "var(--muted-2)", lineHeight: 1.6 }}>Os valores não foram carregados. Tente novamente para consultar as comandas do dia.</p>
      <button type="button" onClick={reset}>Tentar novamente</button>
    </section>
  );
}
