interface AvatarProps {
  /** texto a usar (iniciais). Se não passar, deriva de `name`. */
  text?: string;
  /** nome para derivar iniciais. */
  name?: string;
  size?: number;
  /** índice de cor 1..8 - se omitido, hash do nome */
  colorIndex?: number;
  /** raio: 99 (círculo) ou 11 (quadrado arredondado, estilo wallet) */
  rounded?: "circle" | "square";
}

const GRADIENTS = [
  "linear-gradient(135deg,#C9A961,#a8893d)", // c1 gold
  "linear-gradient(135deg,#0B1838,#1d2d56)", // c2 navy
  "linear-gradient(135deg,#34C759,#1d8a3a)", // c3 green
  "linear-gradient(135deg,#FF9F0A,#c87a00)", // c4 orange
  "linear-gradient(135deg,#FF3B30,#c8261c)", // c5 red
  "linear-gradient(135deg,#5856D6,#3934a3)", // c6 purple
  "linear-gradient(135deg,#0A84FF,#0858b0)", // c7 blue
  "linear-gradient(135deg,#AF52DE,#7a3a9b)", // c8 pink
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function Avatar({ text, name = "", size = 38, colorIndex, rounded = "square" }: AvatarProps) {
  const label = text ?? initials(name);
  const idx = (colorIndex != null ? colorIndex - 1 : hash(name || label)) % GRADIENTS.length;
  const bg = GRADIENTS[idx];
  const fontSize = size <= 28 ? 10 : size <= 36 ? 11 : 12;
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: rounded === "circle" ? 99 : 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 600,
        fontSize,
        flexShrink: 0,
        background: bg,
        letterSpacing: "0.01em",
      }}
    >
      {label || "?"}
    </div>
  );
}
