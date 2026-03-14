package events

import (
	"context"
	"fmt"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"go.uber.org/zap"
)

// MQTTPublisher implements Publisher using the Eclipse Paho MQTT client.
type MQTTPublisher struct {
	client mqtt.Client
	logger *zap.Logger
}

// NewMQTTPublisher creates, connects and returns an MQTTPublisher.
// brokerURL examples:
//   - tcp://broker.hivemq.com:1883        (TCP, no TLS)
//   - ssl://broker.hivemq.com:8883        (TLS)
//   - wss://broker.hivemq.com:8884/mqtt   (WebSocket TLS)
func NewMQTTPublisher(brokerURL, username, password, clientID string, logger *zap.Logger) (*MQTTPublisher, error) {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(brokerURL)
	opts.SetClientID(clientID)
	if username != "" {
		opts.SetUsername(username)
		opts.SetPassword(password)
	}
	opts.SetConnectTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)
	opts.SetCleanSession(true)
	opts.SetKeepAlive(30 * time.Second)
	opts.OnConnectionLost = func(_ mqtt.Client, err error) {
		logger.Warn("MQTT connection lost", zap.Error(err))
	}
	opts.OnReconnecting = func(_ mqtt.Client, _ *mqtt.ClientOptions) {
		logger.Info("MQTT reconnecting…")
	}

	client := mqtt.NewClient(opts)
	token := client.Connect()
	if !token.WaitTimeout(10 * time.Second) {
		return nil, fmt.Errorf("MQTT connect timeout to %s", brokerURL)
	}
	if err := token.Error(); err != nil {
		return nil, fmt.Errorf("MQTT connect to %s: %w", brokerURL, err)
	}

	logger.Info("connected to MQTT broker", zap.String("broker", brokerURL))
	return &MQTTPublisher{client: client, logger: logger}, nil
}

// Publish serialises event + payload and publishes with QoS 0 (at-most-once).
func (p *MQTTPublisher) Publish(_ context.Context, topic, event string, payload interface{}) error {
	data, err := marshalMessage(event, payload)
	if err != nil {
		return fmt.Errorf("marshal event %s: %w", event, err)
	}

	token := p.client.Publish(topic, 0, false, data)
	if !token.WaitTimeout(5 * time.Second) {
		p.logger.Warn("MQTT publish timeout – message dropped",
			zap.String("topic", topic), zap.String("event", event))
		return nil // non-fatal: best-effort delivery
	}
	if err := token.Error(); err != nil {
		p.logger.Error("MQTT publish error", zap.String("event", event), zap.Error(err))
	}
	return nil
}

// Close disconnects the MQTT client gracefully.
func (p *MQTTPublisher) Close() {
	p.client.Disconnect(500)
}
