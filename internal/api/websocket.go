package api

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"

	"pterodesk/internal/security"
)

const maxWSMessageBytes = 10 * 1024 * 1024 // 10 MiB cap per WebSocket frame

// WSEvent represents an event in the Pterodactyl Wings WebSocket protocol
type WSEvent struct {
	Event string        `json:"event"`
	Args  []interface{} `json:"args"`
}

// TokenRefresher is a callback function that fetches an updated WebSocket JWT
type TokenRefresher func(ctx context.Context) (*WebSocketAuth, error)

// ConsoleListener receives streamed console output, stats, and status events
type ConsoleListener interface {
	OnConsoleOutput(line string)
	OnStats(statsJSON string)
	OnStatus(status string)
	OnError(err error)
}

// ServerWebSocket manages an active WebSocket connection to Wings for a single server
type ServerWebSocket struct {
	serverID       string
	socketURL      string
	token          string
	origin         string
	refresher      TokenRefresher
	listener       ConsoleListener
	logger         zerolog.Logger
	conn           *websocket.Conn
	mu             sync.Mutex
	ctx            context.Context
	cancel         context.CancelFunc
	closed         bool
	reconnectDelay time.Duration
}

// NewServerWebSocket creates a new managed WebSocket connection to Wings
func NewServerWebSocket(
	serverID string,
	socketURL string,
	token string,
	origin string,
	refresher TokenRefresher,
	listener ConsoleListener,
	logger zerolog.Logger,
) *ServerWebSocket {
	return &ServerWebSocket{
		serverID:       serverID,
		socketURL:      socketURL,
		token:          token,
		origin:         origin,
		refresher:      refresher,
		listener:       listener,
		logger:         logger.With().Str("component", "wings_ws").Str("server_id", serverID).Logger(),
		reconnectDelay: 2 * time.Second,
	}
}

// Connect begins the WebSocket connection lifecycle in the background
func (sws *ServerWebSocket) Connect(parentCtx context.Context) error {
	sws.mu.Lock()
	if sws.conn != nil {
		sws.mu.Unlock()
		return nil
	}
	sws.ctx, sws.cancel = context.WithCancel(parentCtx)
	sws.closed = false
	sws.mu.Unlock()

	go sws.runLoop()
	return nil
}

// Close gracefully closes the WebSocket connection
func (sws *ServerWebSocket) Close() {
	sws.mu.Lock()
	defer sws.mu.Unlock()

	if sws.closed {
		return
	}
	sws.closed = true

	if sws.cancel != nil {
		sws.cancel()
	}

	if sws.conn != nil {
		_ = sws.conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		_ = sws.conn.Close()
		sws.conn = nil
	}
	sws.logger.Info().Msg("Wings WebSocket connection closed")
}

// SendCommand dispatches a console command to the running server
func (sws *ServerWebSocket) SendCommand(command string) error {
	return sws.sendEvent("send command", []interface{}{command})
}

// SendPower dispatches a power signal ("start", "stop", "restart", "kill")
func (sws *ServerWebSocket) SendPower(signal string) error {
	switch signal {
	case "start", "stop", "restart", "kill":
		return sws.sendEvent("send power", []interface{}{signal})
	default:
		return fmt.Errorf("invalid power signal: %q", signal)
	}
}

// RequestLogs requests historical console logs from Wings
func (sws *ServerWebSocket) RequestLogs() error {
	return sws.sendEvent("send logs", nil)
}

// RequestStats requests current resource usage stats
func (sws *ServerWebSocket) RequestStats() error {
	return sws.sendEvent("send stats", nil)
}

func (sws *ServerWebSocket) sendEvent(event string, args []interface{}) error {
	sws.mu.Lock()
	defer sws.mu.Unlock()

	if sws.conn == nil {
		return fmt.Errorf("websocket is not connected")
	}

	payload := WSEvent{
		Event: event,
		Args:  args,
	}
	return sws.conn.WriteJSON(payload)
}

func (sws *ServerWebSocket) runLoop() {
	for {
		select {
		case <-sws.ctx.Done():
			return
		default:
		}

		err := sws.connectAndRead()
		if err != nil {
			sws.logger.Warn().Err(err).Msg("WebSocket disconnected, reconnecting...")
			if sws.listener != nil {
				sws.listener.OnError(err)
			}
		}

		sws.mu.Lock()
		if sws.closed {
			sws.mu.Unlock()
			return
		}
		sws.mu.Unlock()

		select {
		case <-sws.ctx.Done():
			return
		case <-time.After(sws.reconnectDelay):
			// Refresh token before reconnecting
			if sws.refresher != nil {
				if auth, err := sws.refresher(sws.ctx); err == nil && auth != nil {
					sws.mu.Lock()
					sws.socketURL = auth.Socket
					sws.token = auth.Token
					sws.mu.Unlock()
				}
			}
		}
	}
}

func (sws *ServerWebSocket) connectAndRead() error {
	if _, err := security.ValidateHTTPURL(sws.socketURL, true); err != nil {
		return fmt.Errorf("invalid websocket URL: %w", err)
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: false,
		},
	}

	header := http.Header{}
	if sws.origin != "" {
		header.Set("Origin", sws.origin)
	}

	conn, _, err := dialer.DialContext(sws.ctx, sws.socketURL, header)
	if err != nil {
		return fmt.Errorf("dial failed: %w", err)
	}
	conn.SetReadLimit(maxWSMessageBytes)

	sws.mu.Lock()
	sws.conn = conn
	token := sws.token
	sws.mu.Unlock()

	defer func() {
		sws.mu.Lock()
		if sws.conn == conn {
			_ = conn.Close()
			sws.conn = nil
		}
		sws.mu.Unlock()
	}()

	// Authenticate immediately with the JWT token
	authPayload := WSEvent{
		Event: "auth",
		Args:  []interface{}{token},
	}
	if err := conn.WriteJSON(authPayload); err != nil {
		return fmt.Errorf("failed to send auth: %w", err)
	}

	// Read messages
	for {
		var msg WSEvent
		if err := conn.ReadJSON(&msg); err != nil {
			return err
		}

		sws.handleIncomingMessage(msg)
	}
}

func (sws *ServerWebSocket) handleIncomingMessage(msg WSEvent) {
	switch msg.Event {
	case "auth success":
		sws.logger.Debug().Msg("WebSocket authenticated successfully")
		// Request initial log buffer and stats
		_ = sws.RequestLogs()
		_ = sws.RequestStats()

	case "console output":
		if sws.listener != nil && len(msg.Args) > 0 {
			if str, ok := msg.Args[0].(string); ok {
				sws.listener.OnConsoleOutput(str)
			}
		}

	case "status":
		if sws.listener != nil && len(msg.Args) > 0 {
			if str, ok := msg.Args[0].(string); ok {
				sws.listener.OnStatus(str)
			}
		}

	case "stats":
		if sws.listener != nil && len(msg.Args) > 0 {
			if str, ok := msg.Args[0].(string); ok {
				sws.listener.OnStats(str)
			} else {
				if bytes, err := json.Marshal(msg.Args[0]); err == nil {
					sws.listener.OnStats(string(bytes))
				}
			}
		}

	case "token expiring":
		sws.logger.Info().Msg("WebSocket token expiring, refreshing...")
		if sws.refresher != nil {
			go func() {
				refreshCtx, cancel := context.WithTimeout(sws.ctx, 15*time.Second)
				defer cancel()
				auth, err := sws.refresher(refreshCtx)
				if err == nil && auth != nil {
					_ = sws.sendEvent("auth", []interface{}{auth.Token})
				}
			}()
		}
	}
}
