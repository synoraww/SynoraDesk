package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	detachedFlag := flag.Bool("detached", false, "Run in detached window mode")
	typeFlag := flag.String("type", "server", "Type of detached view")
	serverFlag := flag.String("server", "", "Server identifier for detached mode")
	subtabFlag := flag.String("subtab", "ide", "Subtab for detached mode")
	fileFlag := flag.String("file", "", "File path for editor")
	titleFlag := flag.String("title", "", "Window title")
	flag.Parse()

	app := NewApp()
	windowTitle := "SynoraDesk"
	width := 1400
	height := 900
	minWidth := 0
	minHeight := 0

	if *detachedFlag {
		app.detachedConfig = DetachedWindowConfig{
			IsDetached: true,
			Type:       *typeFlag,
			Server:     *serverFlag,
			Subtab:     *subtabFlag,
			FilePath:   *fileFlag,
			Title:      *titleFlag,
		}
		if *titleFlag != "" {
			windowTitle = fmt.Sprintf("SynoraDesk - %s", *titleFlag)
		} else if *serverFlag != "" {
			windowTitle = fmt.Sprintf("SynoraDesk - %s", *serverFlag)
		} else {
			windowTitle = "SynoraDesk - Cửa sổ riêng"
		}
		width = 1260
		height = 800
	} else {
		// Load persisted window dimensions if available from fixed directory
		fixedDataDir := GetFixedAppDataDir()
		windowStatePath := filepath.Join(fixedDataDir, "data", "window_state.json")
		if data, err := os.ReadFile(windowStatePath); err == nil {
			var state struct {
				Width       int  `json:"width"`
				Height      int  `json:"height"`
				X           int  `json:"x"`
				Y           int  `json:"y"`
				IsMaximised bool `json:"is_maximised"`
			}
			if err := json.Unmarshal(data, &state); err == nil {
				if state.Width > 0 && state.Height > 0 {
					width = state.Width
					height = state.Height
				}
			}
		}
	}

	var singleInstanceLock *options.SingleInstanceLock
	if !*detachedFlag {
		singleInstanceLock = &options.SingleInstanceLock{
			UniqueId: "synoradesk-single-instance-guard-v1",
			OnSecondInstanceLaunch: func(secondInstanceData options.SecondInstanceData) {
				if app.ctx != nil {
					wailsruntime.WindowUnminimise(app.ctx)
					wailsruntime.Show(app.ctx)
				}
			},
		}
	}

	// Fixed WebView2 user data directory to prevent folder generation named after the exe
	webviewDataPath := GetFixedWebviewUserDataPath()
	go CleanLegacyExeFolders()

	err := wails.Run(&options.App{
		Title:              windowTitle,
		Width:              width,
		Height:             height,
		MinWidth:           minWidth,
		MinHeight:          minHeight,
		SingleInstanceLock: singleInstanceLock,
		Frameless:          true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 11, G: 15, B: 25, A: 255},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent:              false,
			WindowIsTranslucent:               false,
			DisableWindowIcon:                 false,
			DisableFramelessWindowDecorations: false,
			IsZoomControlEnabled:              true,
			DisablePinchZoom:                  false,
			ZoomFactor:                        1.0,
			WebviewUserDataPath:               webviewDataPath,
			Theme:                             windows.Dark,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
