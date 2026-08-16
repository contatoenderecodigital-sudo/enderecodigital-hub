"use client";

// Campo de telefone/WhatsApp padrao do hub.
// - Prefixo fixo "+55" visivel (o usuario nao digita o DDI).
// - Mascara brasileira de celular: (DD) 9XXXX-XXXX (11 digitos nacionais).
// - Aceita SO digitos e limita a 11 digitos nacionais.
// - Ao colar, limpa e pega os ultimos 11 digitos.
// - onChange devolve o numero normalizado em E.164 sem "+": "55" + 11 digitos
//   (13 digitos). Enquanto incompleto, devolve so os digitos nacionais.
// - Se `name` for passado, renderiza um input hidden com o valor normalizado,
//   pra funcionar em forms que leem por FormData (server actions / new FormData).
// - Neutro de estilo: aceita className/style pro input visivel, encaixando tanto
//   no console dark (CSS global) quanto no visual GROOW (Tailwind/ed2 inline).

import {
  useEffect,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";

const soDigitos = (s: string) => (s || "").replace(/\D/g, "");

// Extrai os digitos nacionais (max 11), tirando o DDI 55 se veio junto.
function paraNacional(raw: string): string {
  let d = soDigitos(raw);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

// (DD) XXXXX-XXXX enquanto o usuario digita.
function mascarar(nac: string): string {
  const d = nac.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// E.164 sem "+" quando ha DDD + numero; senao os digitos crus (parcial).
function normalizar(nac: string): string {
  return nac.length >= 10 ? "55" + nac : nac;
}

export type CampoTelefoneProps = {
  value?: string;
  onChange?: (normalizado: string) => void;
  /** Se passado, cria um input hidden com esse name pro FormData. */
  name?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Aplicado ao input visivel (merge por cima do padrao). */
  style?: CSSProperties;
  /** Aplicado ao input visivel. */
  className?: string;
  /** Aplicado ao container. */
  wrapperStyle?: CSSProperties;
};

export default function CampoTelefone({
  value,
  onChange,
  name,
  id,
  placeholder = "(49) 99999-9999",
  required,
  disabled,
  autoFocus,
  style,
  className,
  wrapperStyle,
}: CampoTelefoneProps) {
  const [nac, setNac] = useState<string>(() => paraNacional(value ?? ""));

  // Sincroniza quando o valor externo muda (edicao / reset do form).
  useEffect(() => {
    if (value === undefined) return;
    const ext = paraNacional(value);
    setNac((cur) => (ext !== cur ? ext : cur));
  }, [value]);

  function aplicar(novoNac: string) {
    setNac(novoNac);
    onChange?.(normalizar(novoNac));
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    aplicar(paraNacional(e.target.value));
  }

  // Ao colar: limpa tudo e pega os ultimos 11 digitos.
  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    let d = soDigitos(e.clipboardData.getData("text"));
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    aplicar(d.slice(-11));
  }

  const incompleto = nac.length > 0 && nac.length !== 10 && nac.length !== 11;
  const normalizado = normalizar(nac);

  const inputStyle: CSSProperties = {
    paddingLeft: 46,
    ...style,
    ...(incompleto ? { borderColor: "#e5484d" } : {}),
  };

  return (
    <div style={{ position: "relative", ...wrapperStyle }}>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 12,
          top: 0,
          bottom: incompleto ? 21 : 0,
          display: "flex",
          alignItems: "center",
          fontSize: 14,
          opacity: 0.6,
          pointerEvents: "none",
          fontWeight: 500,
        }}
      >
        +55
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={15}
        value={mascarar(nac)}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        className={className}
        style={inputStyle}
        aria-invalid={incompleto || undefined}
      />
      {name ? <input type="hidden" name={name} value={normalizado} /> : null}
      {incompleto ? (
        <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "#e5484d" }}>
          Numero incompleto — informe DDD + 9 digitos.
        </span>
      ) : null}
    </div>
  );
}
