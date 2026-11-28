package main

import (
	"fmt"
	goruntime "runtime"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// getDiskFreeBytes returns available free bytes for the volume containing dirPath.
func getDiskFreeBytes(dirPath string) uint64 {
	ptr, err := windows.UTF16PtrFromString(dirPath)
	if err != nil {
		return 0
	}
	var freeBytesAvailable uint64
	if err := windows.GetDiskFreeSpaceEx(ptr, &freeBytesAvailable, nil, nil); err != nil {
		return 0
	}
	return freeBytesAvailable
}

// getWindowsBuildDetails queries the Windows registry to get the exact OS edition,
// display version (e.g. 24H2), and build number with UBR (e.g. 26100.9974).
func getWindowsBuildDetails() (productName, displayVersion, buildNumber string) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, registry.QUERY_VALUE)
	if err != nil {
		return "Windows", "", goruntime.GOOS
	}
	defer k.Close()

	pn, _, _ := k.GetStringValue("ProductName")
	dv, _, _ := k.GetStringValue("DisplayVersion")
	if dv == "" {
		dv, _, _ = k.GetStringValue("ReleaseId")
	}
	cb, _, _ := k.GetStringValue("CurrentBuild")
	if cb == "" {
		cb, _, _ = k.GetStringValue("CurrentBuildNumber")
	}
	ubr, _, err := k.GetIntegerValue("UBR")
	if err == nil && ubr > 0 {
		cb = fmt.Sprintf("%s.%d", cb, ubr)
	}

	return pn, dv, cb
}

// getWebView2Version queries known registry locations to find the installed
// Microsoft Edge WebView2 runtime version.
func getWebView2Version() string {
	keys := []struct {
		root registry.Key
		path string
	}{
		{registry.LOCAL_MACHINE, `SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`},
		{registry.CURRENT_USER, `Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`},
		{registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`},
	}
	for _, kInfo := range keys {
		k, err := registry.OpenKey(kInfo.root, kInfo.path, registry.QUERY_VALUE)
		if err == nil {
			pv, _, err := k.GetStringValue("pv")
			k.Close()
			if err == nil && pv != "" {
				return pv
			}
		}
	}
	return "Installed"
}
