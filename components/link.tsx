import NextLink from "next/link";
import type { ComponentProps } from "react";

// Link com prefetch DESLIGADO por padrao. O prefetch do Next e credential-less e,
// atras do proxy do Coolify (que remove o header next-router-prefetch), acaba
// cacheando um redirect pro /login e quebrando a navegacao. Sem prefetch, o clique
// faz uma navegacao real (com cookie) e funciona. Passe prefetch para sobrepor.
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
