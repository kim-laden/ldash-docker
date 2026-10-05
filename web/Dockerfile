FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# The board as it ships in the desktop app, then the demo files on top
# (index.html with the browser bridge, demo-bridge.js, demo.css).
COPY board/ /usr/share/nginx/html/ldash/
COPY demo/ /usr/share/nginx/html/ldash/
RUN chmod -R a+rX /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/docker/ldash/ || exit 1
