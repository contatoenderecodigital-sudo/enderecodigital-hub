import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

/**
 * Gravações das ligações do parceiro.
 *
 * Ficam num volume persistente montado no container (/data/gravacoes, mapeado
 * para /var/lib/ed-hub/gravacoes no disco do VPS). Sem esse volume o sistema de
 * arquivos do container é efêmero e cada deploy apagaria tudo.
 *
 * O áudio fica no formato nativo do navegador (webm/opus). Não convertemos para
 * MP3: o TurboScribe aceita webm e opus direto, o arquivo sai cerca de três
 * vezes menor e não precisamos de ffmpeg na imagem.
 */

export const BASE_GRAVACOES =
  process.env.GRAVACOES_DIR || (process.env.NODE_ENV === "production" ? "/data/gravacoes" : join(tmpdir(), "ed-gravacoes"));

/** ~40 MB. Uma hora de opus a 24kbps dá cerca de 11 MB, então sobra folga. */
export const LIMITE_BYTES = 40 * 1024 * 1024;

const EXTENSOES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Só o tipo base importa: o navegador manda `audio/webm;codecs=opus`. */
export function extensaoDe(mime: string): string | null {
  const base = mime.split(";")[0].trim().toLowerCase();
  return EXTENSOES[base] ?? null;
}

/**
 * Caminho relativo da gravação, que é o que vai para o banco. Guardar relativo
 * e não absoluto permite mudar o ponto de montagem sem reescrever o banco.
 */
export function caminhoRelativo(parceiroId: number, callId: number, ext: string): string {
  const agora = new Date();
  const pasta = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${parceiroId}/${pasta}/call-${callId}.${ext}`;
}

/**
 * Resolve o caminho relativo para absoluto recusando qualquer coisa que escape
 * da base. Sem isso um `../../etc/passwd` vindo do banco viraria leitura livre.
 */
export function caminhoAbsoluto(relativo: string): string {
  const base = resolve(BASE_GRAVACOES);
  const alvo = resolve(base, relativo);
  if (alvo !== base && !alvo.startsWith(base + sep)) {
    throw new Error("Caminho de gravação fora da pasta permitida.");
  }
  return alvo;
}

export async function salvarGravacao(
  relativo: string,
  dados: Buffer
): Promise<{ bytes: number }> {
  const alvo = caminhoAbsoluto(relativo);
  await mkdir(dirname(alvo), { recursive: true });
  await writeFile(alvo, dados);
  return { bytes: dados.byteLength };
}

export async function lerGravacao(relativo: string): Promise<Buffer> {
  return readFile(caminhoAbsoluto(relativo));
}

export async function gravacaoExiste(relativo: string): Promise<boolean> {
  try {
    const s = await stat(caminhoAbsoluto(relativo));
    return s.isFile();
  } catch {
    return false;
  }
}

/** Nome amigável para o download, já que o parceiro vai subir isso no TurboScribe. */
export function nomeDownload(nomeLead: string, criadoEm: string, ext: string): string {
  const limpo = nomeLead
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  const data = new Date(criadoEm);
  const carimbo = Number.isNaN(data.getTime())
    ? "sem-data"
    : `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
        data.getDate()
      ).padStart(2, "0")}`;
  return `ligacao-${limpo || "lead"}-${carimbo}.${ext}`;
}
