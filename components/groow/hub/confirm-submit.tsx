"use client";

// Botão de submit para ações DESTRUTIVAS: confirma antes de enviar e, enquanto
// a action roda, useFormStatus marca pending (evita duplo clique e feedback mudo).
import { useFormStatus } from "react-dom";

export default function ConfirmSubmit({
  children,
  message,
  style,
  pendingLabel,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  message: string;
  style?: React.CSSProperties;
  pendingLabel?: React.ReactNode;
  "aria-label"?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      disabled={pending}
      aria-disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      style={{ ...style, opacity: pending ? 0.65 : 1, cursor: pending ? "not-allowed" : "pointer" }}
    >
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}
