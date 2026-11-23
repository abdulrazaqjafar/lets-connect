FROM freeradius/freeradius-server:3.2.3

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends freeradius-postgresql gettext-base \
  && rm -rf /var/lib/apt/lists/*

COPY clients.conf /etc/freeradius/clients.conf
COPY sql.template /etc/freeradius/sql.template
COPY default-site /etc/freeradius/sites-available/default
COPY entrypoint.sh /entrypoint.sh

RUN ln -sf /etc/freeradius/mods-available/sql /etc/freeradius/mods-enabled/sql \
  && ln -sf /etc/freeradius/sites-available/default /etc/freeradius/sites-enabled/default \
  && chmod +x /entrypoint.sh \
  && chown -R freerad:freerad /etc/freeradius

EXPOSE 1812/udp 1813/udp

ENTRYPOINT ["/entrypoint.sh"]
