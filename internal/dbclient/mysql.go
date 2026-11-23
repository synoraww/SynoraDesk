package dbclient

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"strconv"
	"time"

	mysql "github.com/go-sql-driver/mysql"
)

// DBConfig holds MySQL connection config
type DBConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// QueryResult represents the outcome of a SQL query
type QueryResult struct {
	Columns         []string        `json:"columns"`
	Rows            [][]interface{} `json:"rows"`
	RowsAffected    int64           `json:"rowsAffected"`
	ExecutionTimeMs int64           `json:"executionTimeMs"`
	Error           string          `json:"error,omitempty"`
}

// Client wraps a MySQL client
type Client struct {
	db *sql.DB
}

// NewClient connects to a remote MySQL/MariaDB server
func NewClient(config DBConfig) (*Client, error) {
	cfg := mysql.NewConfig()
	cfg.User = config.Username
	cfg.Passwd = config.Password
	cfg.Net = "tcp"
	cfg.Addr = net.JoinHostPort(config.Host, strconv.Itoa(config.Port))
	cfg.DBName = config.Database
	cfg.TLSConfig = "true" // Fail closed if the remote database does not support TLS.
	cfg.Timeout = 10 * time.Second
	cfg.ReadTimeout = 30 * time.Second
	cfg.WriteTimeout = 30 * time.Second
	cfg.ParseTime = true
	dsn := cfg.FormatDSN()

	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open mysql: %w", err)
	}

	conn.SetMaxOpenConns(5)
	conn.SetMaxIdleConns(2)
	conn.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := conn.PingContext(ctx); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &Client{db: conn}, nil
}

// Close closes the database connection
func (c *Client) Close() error {
	if c.db != nil {
		return c.db.Close()
	}
	return nil
}

// ListTables returns all table names in current database
func (c *Client) ListTables(ctx context.Context) ([]string, error) {
	rows, err := c.db.QueryContext(ctx, "SHOW TABLES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, nil
}

// ExecuteQuery runs a generic SQL query and returns column names and row values
func (c *Client) ExecuteQuery(ctx context.Context, query string) (*QueryResult, error) {
	startTime := time.Now()
	res := &QueryResult{}

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		// Try Exec if Query failed (e.g. for UPDATE / INSERT / DELETE)
		execRes, execErr := c.db.ExecContext(ctx, query)
		if execErr != nil {
			return nil, execErr
		}
		affected, _ := execRes.RowsAffected()
		res.RowsAffected = affected
		res.ExecutionTimeMs = time.Since(startTime).Milliseconds()
		return res, nil
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	res.Columns = cols

	for rows.Next() {
		columns := make([]interface{}, len(cols))
		columnPointers := make([]interface{}, len(cols))
		for i := range columns {
			columnPointers[i] = &columns[i]
		}

		if err := rows.Scan(columnPointers...); err != nil {
			return nil, err
		}

		rowValues := make([]interface{}, len(cols))
		for i := range columns {
			val := *columnPointers[i].(*interface{})
			if b, ok := val.([]byte); ok {
				rowValues[i] = string(b)
			} else {
				rowValues[i] = val
			}
		}
		res.Rows = append(res.Rows, rowValues)
	}

	res.ExecutionTimeMs = time.Since(startTime).Milliseconds()
	return res, nil
}
