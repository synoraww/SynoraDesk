//go:build !debug

package main

func runDebugLockResetIfRequested() {
	// Intentionally a no-op in production builds; debug lock reset is excluded.
}
