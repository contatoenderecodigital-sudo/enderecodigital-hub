"use client";

/**
 * Mapa da prospecção: escolhe o centro e o raio da busca.
 *
 * Leaflet puro, importado dentro do useEffect. Duas razões: ele mexe em
 * `window` já no import e derrubaria o SSR, e assim não entra no bundle de
 * quem nunca abre esta tela.
 *
 * Tiles do OpenStreetMap via CARTO: sem chave e sem custo por carregamento.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import type { Map as LeafletMap, Circle, Marker } from "leaflet";

export interface Centro {
  lat: number;
  lng: number;
  nome: string;
}

const RAIO_MIN = 1;
const RAIO_MAX = 200;

/** Zoom que faz o círculo caber na tela. Empírico, mas previsível. */
function zoomParaRaio(raioKm: number): number {
  if (raioKm <= 2) return 13;
  if (raioKm <= 5) return 12;
  if (raioKm <= 12) return 11;
  if (raioKm <= 25) return 10;
  if (raioKm <= 50) return 9;
  if (raioKm <= 100) return 8;
  return 7;
}

const PONTO_CENTRO =
  '<div style="width:16px;height:16px;border-radius:999px;background:#0B1838;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>';
const PONTO_EMPRESA =
  '<div style="width:9px;height:9px;border-radius:999px;background:#C9A961;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>';

export default function MapaRaio({
  centro,
  raioKm,
  onCentroChange,
  onRaioChange,
  pins = [],
}: {
  centro: Centro | null;
  raioKm: number;
  onCentroChange: (c: Centro | null) => void;
  onRaioChange: (r: number) => void;
  /** empresas encontradas, para aparecerem no mapa */
  pins?: { lat: number | null; lng: number | null; nome: string }[];
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circuloRef = useRef<Circle | null>(null);
  const marcadorRef = useRef<Marker | null>(null);
  const pinsRef = useRef<Marker[]>([]);
  const LRef = useRef<typeof import("leaflet") | null>(null);

  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  // O mapa é criado uma vez só. Sem guardar o callback numa ref, o handler de
  // clique ficaria preso na primeira versão da função e mandaria estado velho.
  const onCentroRef = useRef(onCentroChange);
  onCentroRef.current = onCentroChange;

  // ── monta o mapa ────────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !divRef.current || mapRef.current) return;
      LRef.current = L;

      const mapa = L.map(divRef.current, { zoomControl: true }).setView([-27.0, -52.0], 7);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(mapa);

      mapa.on("click", (ev: { latlng: { lat: number; lng: number } }) => {
        onCentroRef.current({ lat: ev.latlng.lat, lng: ev.latlng.lng, nome: "Ponto no mapa" });
      });

      mapRef.current = mapa;
      setPronto(true);
    })();
    return () => {
      vivo = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── centro e círculo ────────────────────────────────────────────────────
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapRef.current;
    if (!L || !mapa || !pronto) return;

    if (!centro) {
      circuloRef.current?.remove();
      marcadorRef.current?.remove();
      circuloRef.current = null;
      marcadorRef.current = null;
      return;
    }

    const pos: [number, number] = [centro.lat, centro.lng];

    if (!circuloRef.current) {
      circuloRef.current = L.circle(pos, {
        radius: raioKm * 1000,
        color: "#C9A961",
        weight: 2,
        dashArray: "6 6",
        fillColor: "#C9A961",
        fillOpacity: 0.12,
      }).addTo(mapa);
    } else {
      circuloRef.current.setLatLng(pos).setRadius(raioKm * 1000);
    }

    if (!marcadorRef.current) {
      const icone = L.divIcon({ className: "", html: PONTO_CENTRO, iconSize: [16, 16], iconAnchor: [8, 8] });
      marcadorRef.current = L.marker(pos, { icon: icone, draggable: true }).addTo(mapa);
      marcadorRef.current.on("dragend", () => {
        const p = marcadorRef.current!.getLatLng();
        onCentroRef.current({ lat: p.lat, lng: p.lng, nome: "Ponto no mapa" });
      });
    } else {
      marcadorRef.current.setLatLng(pos);
    }
  }, [centro, raioKm, pronto]);

  // ── enquadra quando muda centro ou raio ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !centro || !pronto) return;
    mapRef.current.setView([centro.lat, centro.lng], zoomParaRaio(raioKm));
  }, [centro, raioKm, pronto]);

  // ── pins das empresas encontradas ───────────────────────────────────────
  useEffect(() => {
    const L = LRef.current;
    const mapa = mapRef.current;
    if (!L || !mapa || !pronto) return;
    pinsRef.current.forEach((m) => m.remove());
    pinsRef.current = [];
    const icone = L.divIcon({ className: "", html: PONTO_EMPRESA, iconSize: [9, 9], iconAnchor: [5, 5] });
    pins.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      pinsRef.current.push(L.marker([p.lat, p.lng], { icon: icone }).addTo(mapa).bindTooltip(p.nome));
    });
  }, [pins, pronto]);

  const buscarCidade = useCallback(async () => {
    const termo = busca.trim();
    if (termo.length < 2) return;
    setBuscando(true);
    setErro(null);
    try {
      const r = await fetch("/api/admin/prospeccao/geocodificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cidade: termo }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setErro(d.error || "Não achei essa cidade.");
        return;
      }
      const o = d.opcoes[0];
      onCentroChange({ lat: o.lat, lng: o.lng, nome: o.nome });
    } catch {
      setErro("Falha ao buscar. Tente de novo.");
    } finally {
      setBuscando(false);
    }
  }, [busca, onCentroChange]);

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ed2-ink-2)",
          marginBottom: 10,
        }}
      >
        Localização · busque a cidade ou clique no mapa
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ed2-ink-2)",
            }}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscarCidade();
              }
            }}
            placeholder="Ex.: Xanxerê SC"
            style={{
              width: "100%",
              padding: "10px 12px 10px 36px",
              borderRadius: 12,
              border: "1px solid var(--ed2-hair)",
              background: "var(--ed2-surface)",
              color: "var(--ed2-ink)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={buscarCidade}
          disabled={buscando || busca.trim().length < 2}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 18px",
            borderRadius: 999,
            border: "none",
            background: buscando ? "rgba(201,169,97,0.5)" : "#C9A961",
            color: "#0B1838",
            fontWeight: 700,
            fontSize: 14,
            cursor: buscando ? "default" : "pointer",
          }}
        >
          {buscando ? <Loader2 size={15} /> : <MapPin size={15} />}
          Centralizar
        </button>
      </div>

      {erro ? <div style={{ fontSize: 13, color: "#c8261c", marginBottom: 8 }}>{erro}</div> : null}

      <div
        ref={divRef}
        style={{
          height: 320,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--ed2-hair)",
          background: "var(--ed2-surface)",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 12,
          padding: "12px 16px",
          borderRadius: 14,
          background: "var(--ed2-surface)",
          border: "1px solid var(--ed2-hair)",
          flexWrap: "wrap",
        }}
      >
        <MapPin size={16} style={{ color: "#C9A961", flexShrink: 0 }} />
        <div style={{ minWidth: 130 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ed2-ink)" }}>
            {centro ? centro.nome : "Nenhum ponto escolhido"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>
            {centro
              ? `${centro.lat.toFixed(4)}, ${centro.lng.toFixed(4)}`
              : "busque a cidade ou clique no mapa"}
          </div>
        </div>
        <input
          type="range"
          min={RAIO_MIN}
          max={RAIO_MAX}
          value={raioKm}
          disabled={!centro}
          onChange={(e) => onRaioChange(Number(e.target.value))}
          style={{ flex: "1 1 180px", accentColor: "#C9A961", cursor: centro ? "pointer" : "not-allowed" }}
        />
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--ed2-ink)",
            fontVariantNumeric: "tabular-nums",
            minWidth: 62,
            textAlign: "right",
          }}
        >
          {raioKm} km
        </div>
        {centro ? (
          <button
            type="button"
            onClick={() => onCentroChange(null)}
            title="Limpar o ponto e voltar a buscar só por cidade"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ed2-ink-2)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            &times;
          </button>
        ) : null}
      </div>
    </div>
  );
}
