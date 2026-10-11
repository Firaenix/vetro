# MQTT with Home Assistant Container

MQTT sends messages through a **broker**. The broker receives a message on a **topic** (a name such as `vetro/command/open-app`) and forwards it to subscribed clients. Mosquitto is the broker; Vetro and Home Assistant are clients. Run Mosquitto as a second Docker container on your Home Assistant server. An add-on is not required.

These files are a setup template to copy to your Docker server. They do not install anything automatically. In Vetro, use the **Docker server's LAN IP** as the broker address.

## 1. Start Mosquitto

Copy this directory to the server running Home Assistant. Open a terminal there and create separate accounts:

```sh
docker compose run --rm --no-deps mosquitto mosquitto_passwd -c /mosquitto/config/passwords vetro
docker compose run --rm --no-deps mosquitto mosquitto_passwd /mosquitto/config/passwords homeassistant
chmod 644 config/passwords
docker compose up -d
docker compose logs --tail=50 mosquitto
```

The commands ask for passwords interactively and save hashes in a local file excluded from Git. Use `-c` only when creating the file: using it again replaces existing accounts. If you already have a broker, skip this step and use its connection details.

Port 1883 must be available on the server and reachable from the TV and Home Assistant. This template uses TCP without TLS on your home network; no router port forwarding is needed. TLS requires a broker listener and certificate configuration. Vetro's TLS switch does not configure the broker.

## 2. Connect Home Assistant

Open **Settings → Devices & services → Add integration → MQTT** and enter:

- Broker: the Docker server's LAN IP.
- Port: `1883`.
- Username: `homeassistant`, with the password you created.

Inside a container, `localhost` refers to that container. Using the server's LAN IP avoids changes to Home Assistant's Docker network.

## 3. Connect Vetro

Open **MQTT** in Vetro's sidebar. Enter the same broker address and port, username `vetro` and its password. Keep the default topic prefix `vetro`, enable the connection and save.

A connected state means the broker accepted the MQTT connection, rather than just a TCP socket opening. Vetro does not return the saved password to the page or include it in diagnostic exports. Leaving the password field blank preserves the saved password.

Every 10 seconds, Vetro publishes available metrics and Home Assistant discovery configurations for five sensors: SoC temperature, CPU load, CPU frequency, RAM used and uptime. Some metrics may be unavailable on your TV. Discovery records are retained. Metrics use QoS 0; the sent counter does not confirm delivery.

### Availability and TV identity

Vetro stores a separate client identity for each TV and keeps it across configuration changes. Older configurations use a machine identity or a generated identity saved on the TV. The UI reports a temporary identity if saving fails.

Telemetry uses `<prefix>/<identity>/<metric>`. The retained availability topic is `<prefix>/<identity>/availability`. Vetro publishes `online` when connected; the broker publishes the QoS 0 Last Will, `offline`, after an unexpected disconnect. Home Assistant entities use this availability topic.

When reconfiguring or disabling MQTT, Vetro clears discovery records published by the current connection and sends `offline` before disconnecting. These QoS 0 writes are not broker acknowledgements. Legacy entities using the fixed `vetro` identity require manual cleanup; Vetro does not delete records that could belong to another installation. Explicit remapper topics do not change.

## 4. Try an automation

In Vetro, create a rule with an **MQTT** trigger, topic `vetro/command/open-app`, exact payload `open`, and an **Open app** action. Choose the application to launch. In Home Assistant's developer tools, run:

```yaml
action: mqtt.publish
data:
  topic: vetro/command/open-app
  payload: open
  retain: false
```

Vetro subscribes only to the exact topics of enabled rules. Retained messages and messages marked as duplicates do not trigger actions. Trigger frequency and queue size are limited. Rules that directly connect an input topic to an output topic are rejected to prevent loops. Use separate topics for commands and state.

A physical remote button can also publish an MQTT message. Enable physical input interception in **Remote** first. Incoming MQTT rules work in the background while the TV and Vetro service are running. MQTT commands do not use the remote WebSocket API.

## Validation status

Protocol handling, trigger validation and discovery cleanup have local fixture tests. A real broker connected to the TV, including authentication and TLS, still needs testing.

References: [Home Assistant MQTT](https://www.home-assistant.io/integrations/mqtt/), [Mosquitto configuration](https://mosquitto.org/man/mosquitto-conf-5.html), [Mosquitto passwords](https://mosquitto.org/man/mosquitto_passwd-1.html).
