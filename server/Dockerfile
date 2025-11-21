FROM node:20

RUN apt update && apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

WORKDIR /app
COPY package*.json pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .

CMD [ "pnpm", "run", "dev" ]