"use client";

// Botão de submit com guard de duplo envio: enquanto a action roda,
// useFormStatus marca pending e o botão fica disabled — o 2º clique não dispara nada.
import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children,
  style,
  pendingLabel,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  pendingLabel?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      style={{ ...style, opacity: pending ? 0.65 : 1, cursor: pending ? "not-allowed" : "pointer" }}
    >
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}
