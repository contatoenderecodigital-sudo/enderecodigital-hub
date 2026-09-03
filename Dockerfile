# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# As migracoes e o seed da vitrine vao junto. Sem isto so da para mexer no
# banco por tunel a partir da maquina do Sandro, e no dia da demonstracao ele
# nao vai estar na frente do PC de casa. Sao arquivos .sql e dois .mjs, nao
# pesam nada, e o pg e o bcryptjs ja vem tracados pelo standalone.
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
# O standalone empacota o bcryptjs dentro dos chunks do servidor, entao ele
# nao sobra em node_modules e o seed morria no MODULE_NOT_FOUND na hora de
# gravar os PIN da equipe. O pg sobra porque o Next o trata como externo.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
