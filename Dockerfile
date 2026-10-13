# Bun builds the static site, then an unprivileged nginx serves it.
# Works unchanged with `podman build` and `docker build`.
#
#   podman build -t iss-edu:local .      (or: docker build -t iss-edu:local .)
#   podman run --rm -p 8080:8080 iss-edu:local
#
# Image references are fully qualified so Podman never asks which registry to use.

# ---- Stage 0: Node executable -----------------------------------------------
# Only the node binary is borrowed from this image, for the build stage below.
FROM docker.io/library/node:26.10.0-alpine3.24 AS node

# ---- Stage 1: build ---------------------------------------------------------
# Same Bun version as local development, so bun.lock resolves identically.
FROM docker.io/oven/bun:1.4.2-alpine AS build

# Bun installs the packages and runs the scripts, but tsc and Vite should run on
# Node, as they do on a developer machine. Without a node binary on PATH, `bun run`
# executes them on Bun's own runtime, where the Vite build was OOM-killed inside a
# default 2 GiB Podman machine that was also running other containers.
COPY --from=node /usr/local/bin/node /usr/local/bin/node

# The bun user cannot write to /home/bun/app, so use a directory owned by it.
# Build as non-root: this stage runs third-party package code.
WORKDIR /build
RUN chown bun:bun /build
USER bun

# Manifests first, so the dependency layer is reused until they change.
# --frozen-lockfile fails the build if bun.lock and package.json disagree.
# --ignore-scripts stops any dependency from running install-time code; nothing in
# this project needs it (esbuild and Rollup ship prebuilt binaries as packages).
# Dev dependencies are required: tsc, Vite and Tailwind all run in this stage.
COPY --chown=bun:bun package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# Ceiling for the V8 heap during tsc and vite build. The default is derived from the
# container memory limit (about half of it), which is too low on small machines:
# the build needs roughly 500 to 650 MB of heap. Override with --build-arg if the
# project grows: podman build --build-arg NODE_HEAP_MB=1536 .
ARG NODE_HEAP_MB=768
ENV NODE_OPTIONS=--max-old-space-size=${NODE_HEAP_MB}

# .dockerignore is an allowlist, so only the files the build needs arrive here.
COPY --chown=bun:bun . .
RUN bun run build

# ---- Stage 2: runtime -------------------------------------------------------
# nginx-unprivileged runs as uid 101 and listens on 8080, so the container needs
# no capabilities. The slim variant omits modules that static hosting never uses.
FROM docker.io/nginxinc/nginx-unprivileged:1.31.5-alpine3.24-slim AS runtime

# Provenance labels. The base image carries its own revision, creation date, version, URL and
# maintainer, which would otherwise be reported for this image, so each one is set here. Version,
# revision and creation date are only known to whoever runs the build, so they default to empty:
#   podman build --build-arg IMAGE_REVISION=<git sha> --build-arg IMAGE_VERSION=<tag> .
ARG IMAGE_VERSION=""
ARG IMAGE_REVISION=""
ARG IMAGE_CREATED=""

LABEL maintainer="Behnam Ebrahimi" \
      org.opencontainers.image.title="ISS Tracker" \
      org.opencontainers.image.description="Live 3D International Space Station tracker, served as a static site by nginx" \
      org.opencontainers.image.authors="Behnam Ebrahimi" \
      org.opencontainers.image.url="https://github.com/CodeWithBehnam/ISS-edu" \
      org.opencontainers.image.documentation="https://github.com/CodeWithBehnam/ISS-edu#readme" \
      org.opencontainers.image.source="https://github.com/CodeWithBehnam/ISS-edu" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.revision="${IMAGE_REVISION}" \
      org.opencontainers.image.created="${IMAGE_CREATED}"

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build --chown=root:root /build/dist /usr/share/nginx/html

EXPOSE 8080

# The base image already sets USER 101 (nginx), so the process never runs as root.
# No HEALTHCHECK here: the OCI image format that Podman builds by default ignores
# it. compose.yaml defines the healthcheck instead.
