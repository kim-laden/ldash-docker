FROM python:3.12-slim-bookworm
# server.py uses only the Python standard library. Python 3.12 matches the
# live service. On 3.13 every request stalls in server.py's log_message,
# which calls log_request and recurses until Python gives up.
RUN useradd --uid 1000 --home-dir /home/ldash --create-home --shell /usr/sbin/nologin ldash \
    && mkdir -p /data/vaults \
    && chown -R ldash:ldash /data \
    && chmod 700 /data /data/vaults
WORKDIR /app
COPY server.py /app/server.py
ENV LDASH_ACCOUNT_DATA=/data \
    LDASH_ACCOUNT_VAULTS=/data/vaults \
    LDASH_ACCOUNT_BIND=0.0.0.0:8741 \
    LDASH_ACCOUNT_PUBLIC=http://127.0.0.1:18084/docker/ldash/ldash \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
USER ldash
VOLUME ["/data"]
EXPOSE 8741
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8741/v1/health', timeout=4).status == 200 else 1)"]
CMD ["python", "/app/server.py"]
