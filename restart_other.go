//go:build !windows

package main

import (
	"os/exec"
)

// setIndependentProcessFlags is a no-op on non-Windows platforms.
func setIndependentProcessFlags(cmd *exec.Cmd) {
}
